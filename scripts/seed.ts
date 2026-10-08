import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";

import { hashPassword } from "../lib/auth/password";
import { getServerEnv } from "../lib/config/env";
import { SYSTEM_ROLES } from "../lib/constants/permissions";
import { getDb } from "../lib/db/client";
import { migrateDb } from "../lib/db/migrate";

import { buildHeroImage, buildLogoImage } from "./demo-images";
import { DEMO_TRUCKS, type DemoOrder, type DemoTruck } from "./demo-trucks";

loadEnv({ path: ".env.local" });

/**
 * Seed de demo: BORRA todos los foodtrucks de la base y carga los tres de
 * scripts/demo-trucks.ts, con menu, roles, usuarios, horarios, branding,
 * pedidos en todas las columnas del kanban y una semana de historial.
 *
 * El superadmin de plataforma no se borra: se crea o se actualiza.
 */

type Statement = { sql: string; args: Array<string | number | null> };

type OrderItemStatus = "pending" | "preparing" | "ready" | "delivered";

type MenuIndexItem = {
  id: string;
  name: string;
  priceCents: number;
  available: boolean;
  variants: Map<string, { id: string; priceCents: number; available: boolean }>;
  modifiers: Array<[label: string, defaultChecked: boolean]>;
};

/** Un pedido ya resuelto contra el menu, listo para insertar. */
type PlannedOrder = {
  id: string;
  createdAt: Date;
  serviceDate: string;
  customer: { name: string; phone: string };
  status: DemoOrder["status"];
  paymentStatus: "pending" | "approved" | "refunded";
  tipPercent: number;
  lines: Array<{
    id: string;
    item: MenuIndexItem;
    variant: { id: string; name: string; priceCents: number } | null;
    quantity: number;
    notes: string | null;
    status: OrderItemStatus;
  }>;
  readyAt: Date | null;
  deliveredAt: Date | null;
  pulseAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  refundPending: boolean;
  modificationRequest: DemoOrder["modificationRequest"];
};

const MINUTE = 60_000;
const DAY = 86_400_000;

const HISTORY_CUSTOMERS = [
  "Lucía", "Mateo", "Martina", "Benjamín", "Catalina", "Thiago", "Emma", "Felipe",
  "Delfina", "Bautista", "Abril", "Lorenzo", "Mía", "Facundo", "Renata", "Nicolás",
  "Olivia", "Franco", "Pilar", "Juan Cruz",
];

const HISTORY_CANCEL_REASONS = [
  "El cliente pidió cancelar antes de que entrara a la plancha",
  "Producto agotado después del pago; se ofreció cambio y no lo aceptó",
];

/** PRNG con semilla: el seed genera siempre el mismo historial. */
function createRandom(seed: number) {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(values: readonly T[]): T => values[Math.floor(next() * values.length)]!,
  };
}

/** Mismo formato que `datetime('now')` de SQLite: UTC, sin la T. */
function toSqlTime(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function getLocalParts(timezone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";

  return {
    serviceDate: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
  };
}

/** Fecha de servicio en la TZ del truck, igual que lib/data/orders.ts. */
function getServiceDate(timezone: string, date: Date) {
  return getLocalParts(timezone, date).serviceDate;
}

/** Convierte "esta fecha a esta hora en la TZ del truck" a un instante UTC. */
function localTimeToDate(timezone: string, serviceDate: string, hour: number, minute: number) {
  const guess = new Date(`${serviceDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  const local = getLocalParts(timezone, guess);
  const localAsUtc = Date.UTC(
    Number(local.serviceDate.slice(0, 4)),
    Number(local.serviceDate.slice(5, 7)) - 1,
    Number(local.serviceDate.slice(8, 10)),
    local.hour,
    local.minute,
  );
  return new Date(guess.getTime() - (localAsUtc - guess.getTime()));
}

function weekdayOf(serviceDate: string) {
  return new Date(`${serviceDate}T12:00:00Z`).getUTCDay();
}

async function seedPlatformAdmin() {
  const env = getServerEnv();
  const db = getDb();
  const email = env.SEED_SUPERADMIN_EMAIL ?? "superadmin@foodtag.ar";
  const password = env.SEED_SUPERADMIN_PASSWORD ?? "ChangeMe123!";

  const existing = await db.execute({
    sql: "select id from platform_admin where lower(email) = lower(@email)",
    args: { email },
  });

  await db.execute({
    sql: `
      insert into platform_admin (id, email, full_name, password_hash, active)
      values (@id, @email, 'Superadmin FoodTag', @passwordHash, 1)
      on conflict(email) do update set
        password_hash = excluded.password_hash,
        active = 1
    `,
    args: {
      id: (existing.rows[0] as { id: string } | undefined)?.id ?? randomUUID(),
      email,
      passwordHash: hashPassword(password),
    },
  });

  return { email, password };
}

/**
 * Borra todos los foodtrucks y todo lo que cuelga de ellos.
 *
 * No alcanza con `delete from truck_config`: category y menu_item ganaron su
 * truck_id con un `alter table` sin `on delete cascade`, y order_item frena el
 * borrado de menu_item (`on delete restrict`). Por eso se borra en orden, de
 * las hojas hacia el truck, todo dentro de una transaccion.
 */
async function wipeAllTrucks() {
  const db = getDb();
  const before = await db.execute("select name, slug from truck_config order by created_at asc");

  await db.batch(
    [
      // Cascadea a order_item, order_modification_request, push_subscription y beeper_event.
      "delete from customer_order",
      "delete from ticket_counter",
      "delete from audit_log",
      "delete from staff_user",
      "delete from role",
      // Cascadea a menu_variant y menu_item_modifier.
      "delete from menu_item",
      "delete from category",
      "delete from opening_hours",
      "delete from truck_profile",
      "delete from truck_config",
      // Sin pedidos ya no queda nada que los referencie.
      "delete from customer",
      "delete from login_attempt",
    ],
    "write",
  );

  return (before.rows as unknown as Array<{ name: string; slug: string | null }>).map(
    (row) => `${row.name} (/t/${row.slug ?? "?"})`,
  );
}

function buildMenuStatements(truckId: string, truck: DemoTruck) {
  const statements: Statement[] = [];
  const index = new Map<string, MenuIndexItem>();

  truck.menu.forEach((category, categoryPosition) => {
    const categoryId = randomUUID();
    statements.push({
      sql: "insert into category (id, truck_id, name, position, visible) values (?, ?, ?, ?, ?)",
      args: [categoryId, truckId, category.name, categoryPosition, category.visible === false ? 0 : 1],
    });

    category.items.forEach((item, itemPosition) => {
      const itemId = randomUUID();
      const available = item.available !== false;
      const entry: MenuIndexItem = {
        id: itemId,
        name: item.name,
        priceCents: item.priceCents,
        // Un producto de una categoria oculta no se puede pedir.
        available: available && category.visible !== false,
        variants: new Map(),
        modifiers: item.modifiers ?? [],
      };

      statements.push({
        sql: `
          insert into menu_item (
            id, truck_id, category_id, name, description, price_cents, photo_url,
            available, has_variants, position
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          itemId,
          truckId,
          categoryId,
          item.name,
          item.description,
          item.priceCents,
          // Ruta del propio sitio y no data URI: /api/menu no carga el peso de las fotos.
          item.photo ? `/menu-demo/${item.photo}.webp` : null,
          available ? 1 : 0,
          item.variants?.length ? 1 : 0,
          itemPosition,
        ],
      });

      item.variants?.forEach((variant, variantPosition) => {
        const variantId = randomUUID();
        const variantAvailable = available && variant.available !== false;
        entry.variants.set(variant.name, {
          id: variantId,
          priceCents: variant.priceCents,
          available: variantAvailable,
        });
        statements.push({
          sql: `
            insert into menu_variant (id, menu_item_id, name, price_cents, available, position)
            values (?, ?, ?, ?, ?, ?)
          `,
          args: [
            variantId,
            itemId,
            variant.name,
            variant.priceCents,
            variant.available === false ? 0 : 1,
            variantPosition,
          ],
        });
      });

      item.modifiers?.forEach(([label, defaultChecked], modifierPosition) => {
        statements.push({
          sql: `
            insert into menu_item_modifier (id, menu_item_id, label, default_checked, position)
            values (?, ?, ?, ?, ?)
          `,
          args: [randomUUID(), itemId, label, defaultChecked ? 1 : 0, modifierPosition],
        });
      });

      index.set(item.name, entry);
    });
  });

  return { statements, index };
}

function resolveLine(
  menu: Map<string, MenuIndexItem>,
  truck: DemoTruck,
  line: DemoOrder["lines"][number],
  fallbackStatus: OrderItemStatus,
) {
  const item = menu.get(line.item);
  if (!item) {
    throw new Error(`[${truck.name}] El pedido usa "${line.item}", que no esta en el menu`);
  }

  let variant: PlannedOrder["lines"][number]["variant"] = null;
  if (item.variants.size) {
    const name = line.variant ?? [...item.variants.keys()][0]!;
    const found = item.variants.get(name);
    if (!found) {
      throw new Error(`[${truck.name}] "${line.item}" no tiene la variante "${name}"`);
    }
    variant = { id: found.id, name, priceCents: found.priceCents };
  }

  return {
    id: randomUUID(),
    item,
    variant,
    quantity: line.quantity ?? 1,
    notes: line.notes ?? null,
    status: line.status ?? fallbackStatus,
  };
}

function itemStatusFor(status: DemoOrder["status"]): OrderItemStatus {
  if (status === "cancelled") return "pending";
  return status;
}

/** Los pedidos que el truck tiene "ahora mismo", definidos a mano. */
function planLiveOrders(truck: DemoTruck, menu: Map<string, MenuIndexItem>, now: Date) {
  return truck.orders.map<PlannedOrder>((order) => {
    const createdAt = new Date(now.getTime() - order.minutesAgo * MINUTE);
    const readyAt =
      order.status === "ready" || order.status === "delivered"
        ? new Date(createdAt.getTime() + (order.prepMinutes ?? 8) * MINUTE)
        : null;

    return {
      id: randomUUID(),
      createdAt,
      serviceDate: getServiceDate(truck.timezone, createdAt),
      customer: order.customer,
      status: order.status,
      paymentStatus: order.paymentStatus ?? "approved",
      tipPercent: order.tipPercent ?? 0,
      lines: order.lines.map((line) =>
        resolveLine(menu, truck, line, itemStatusFor(order.status)),
      ),
      readyAt,
      deliveredAt:
        order.status === "delivered" && readyAt ? new Date(readyAt.getTime() + 2 * MINUTE) : null,
      pulseAt:
        order.pulseMinutesAgo !== undefined
          ? new Date(now.getTime() - order.pulseMinutesAgo * MINUTE)
          : null,
      cancelledAt: order.status === "cancelled" ? new Date(createdAt.getTime() + 4 * MINUTE) : null,
      cancelReason: order.cancelReason ?? null,
      refundPending: order.refundPending ?? false,
      modificationRequest: order.modificationRequest,
    };
  });
}

/**
 * Historial: pedidos ya entregados en los 6 dias anteriores y en lo que va de
 * hoy, dentro del horario de cada dia. Los dias cerrados quedan vacios, que es
 * lo que mostraria el dashboard de un truck real.
 */
function planHistoryOrders(
  truck: DemoTruck,
  menu: Map<string, MenuIndexItem>,
  now: Date,
  random: ReturnType<typeof createRandom>,
  phonePrefix: string,
) {
  const orderable = [...menu.values()].filter(
    (item) => item.available && (item.variants.size === 0 || [...item.variants.values()].some((v) => v.available)),
  );
  const planned: PlannedOrder[] = [];
  // Lo de hoy termina antes que el pedido en vivo mas viejo, para no mezclarse.
  const oldestLiveMinutes = Math.max(0, ...truck.orders.map((order) => order.minutesAgo));
  const todayCutoff = new Date(now.getTime() - (oldestLiveMinutes + 10) * MINUTE);

  for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
    const serviceDate = getServiceDate(truck.timezone, new Date(now.getTime() - daysAgo * DAY));
    const hours = truck.hours[weekdayOf(serviceDate)];
    if (!hours) continue;

    const opensAt = localTimeToDate(truck.timezone, serviceDate, Number(hours[0].slice(0, 2)), Number(hours[0].slice(3, 5)));
    const closesAt = localTimeToDate(truck.timezone, serviceDate, Number(hours[1].slice(0, 2)), Number(hours[1].slice(3, 5)));
    // Se deja margen al cierre para que el pedido termine dentro del horario.
    const windowEnd = Math.min(closesAt.getTime() - 20 * MINUTE, daysAgo === 0 ? todayCutoff.getTime() : Infinity);
    const windowMs = windowEnd - opensAt.getTime();
    if (windowMs <= 0) continue;

    const fullDayMs = closesAt.getTime() - opensAt.getTime();
    const [min, max] = truck.historyOrdersPerDay;
    const count = Math.round(random.int(min, max) * Math.min(1, windowMs / fullDayMs));

    for (let i = 0; i < count; i += 1) {
      // Dos picos (almuerzo/merienda y cena) en lugar de una distribucion pareja.
      const position = Math.min(0.999, Math.max(0, (random.next() + random.next() + random.next()) / 3 + (random.next() - 0.5) * 0.4));
      const createdAt = new Date(opensAt.getTime() + position * windowMs);
      const prepMinutes = random.int(5, 16);
      const readyAt = new Date(createdAt.getTime() + prepMinutes * MINUTE);
      const cancelled = random.next() < 0.04;
      const customerIndex = random.int(0, HISTORY_CUSTOMERS.length - 1);

      const lineCount = random.int(1, 3);
      const lines = Array.from({ length: lineCount }, () => {
        const item = random.pick(orderable);
        const variants = [...item.variants.entries()].filter(([, v]) => v.available);
        const variantEntry = variants.length ? random.pick(variants) : null;
        const changed = item.modifiers.length && random.next() < 0.3 ? random.pick(item.modifiers) : null;

        return {
          id: randomUUID(),
          item,
          variant: variantEntry
            ? { id: variantEntry[1].id, name: variantEntry[0], priceCents: variantEntry[1].priceCents }
            : null,
          quantity: random.next() < 0.8 ? 1 : 2,
          // Solo lo que cambio respecto del default, igual que buildModifierNote del menu.
          notes: changed
            ? changed[1]
              ? `Sin ${changed[0].replace(/^con\s+/i, "").toLowerCase()}`
              : changed[0]
            : null,
          status: (cancelled ? "pending" : "delivered") as OrderItemStatus,
        };
      });

      planned.push({
        id: randomUUID(),
        createdAt,
        serviceDate,
        customer: {
          name: HISTORY_CUSTOMERS[customerIndex]!,
          phone: `${phonePrefix}${String(customerIndex).padStart(2, "0")}`,
        },
        status: cancelled ? "cancelled" : "delivered",
        paymentStatus: cancelled ? "refunded" : "approved",
        tipPercent: random.pick([0, 0, 5, 10, 10, 15]),
        lines,
        readyAt: cancelled ? null : readyAt,
        deliveredAt: cancelled ? null : new Date(readyAt.getTime() + random.int(1, 4) * MINUTE),
        pulseAt: null,
        cancelledAt: cancelled ? new Date(createdAt.getTime() + 3 * MINUTE) : null,
        cancelReason: cancelled ? random.pick(HISTORY_CANCEL_REASONS) : null,
        refundPending: false,
        modificationRequest: undefined,
      });
    }
  }

  return planned;
}

function buildOrderStatements(
  truckId: string,
  orders: PlannedOrder[],
  customerIds: Map<string, string>,
  staffIdByRole: Map<string, string>,
) {
  const statements: Statement[] = [];
  const nextTicketByDate = new Map<string, number>();

  for (const order of [...orders].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    let customerId = customerIds.get(order.customer.phone);
    if (!customerId) {
      customerId = randomUUID();
      customerIds.set(order.customer.phone, customerId);
      statements.push({
        sql: "insert into customer (id, name, phone) values (?, ?, ?)",
        args: [customerId, order.customer.name, order.customer.phone],
      });
    }

    // Numeracion por truck y por dia, igual que createCustomerOrder.
    const ticketNumber = nextTicketByDate.get(order.serviceDate) ?? 1;
    nextTicketByDate.set(order.serviceDate, ticketNumber + 1);

    const subtotalCents = order.lines.reduce(
      (total, line) => total + (line.variant?.priceCents ?? line.item.priceCents) * line.quantity,
      0,
    );
    // Propina como porcentaje del subtotal, redondeada a pesos enteros.
    const tipCents = Math.round((subtotalCents * order.tipPercent) / 100 / 100) * 100;
    const createdAt = toSqlTime(order.createdAt);
    const paidAt =
      order.paymentStatus === "pending" ? null : toSqlTime(new Date(order.createdAt.getTime() + MINUTE));
    const at = (date: Date | null) => (date ? toSqlTime(date) : null);
    const updatedAt =
      order.deliveredAt ?? order.cancelledAt ?? order.pulseAt ?? order.readyAt ?? order.createdAt;

    statements.push({
      sql: `
        insert into customer_order (
          id, truck_id, ticket_number, service_date, customer_id, status, payment_status,
          paid_at, subtotal_cents, tip_cents, total_cents, pulse_at, ready_at, delivered_at,
          picked_up_at, cancelled_at, cancel_reason, refund_pending, created_at, updated_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        order.id,
        truckId,
        ticketNumber,
        order.serviceDate,
        customerId,
        order.status,
        order.paymentStatus,
        paidAt,
        subtotalCents,
        tipCents,
        subtotalCents + tipCents,
        at(order.pulseAt),
        at(order.readyAt),
        at(order.deliveredAt),
        at(order.deliveredAt),
        at(order.cancelledAt),
        order.cancelReason,
        order.refundPending ? 1 : 0,
        createdAt,
        toSqlTime(updatedAt),
      ],
    });

    for (const line of order.lines) {
      const unitPriceCents = line.variant?.priceCents ?? line.item.priceCents;
      statements.push({
        sql: `
          insert into order_item (
            id, order_id, menu_item_id, menu_variant_id, quantity, name_snapshot,
            variant_name_snapshot, unit_price_cents, line_total_cents, notes, status
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          line.id,
          order.id,
          line.item.id,
          line.variant?.id ?? null,
          line.quantity,
          line.item.name,
          line.variant?.name ?? null,
          unitPriceCents,
          unitPriceCents * line.quantity,
          line.notes,
          line.status,
        ],
      });
    }

    // Rastro del beeper: el aviso automatico al pasar a listo y el re-llamado manual.
    if (order.readyAt && order.status !== "cancelled") {
      statements.push({
        sql: "insert into beeper_event (id, order_id, kind, at) values (?, ?, 'auto_ready', ?)",
        args: [randomUUID(), order.id, toSqlTime(order.readyAt)],
      });
    }
    if (order.pulseAt) {
      statements.push({
        sql: "insert into beeper_event (id, order_id, kind, at) values (?, ?, 'manual_pulse', ?)",
        args: [randomUUID(), order.id, toSqlTime(order.pulseAt)],
      });
    }

    const request = order.modificationRequest;
    if (request) {
      const line = order.lines[request.lineIndex];
      if (!line) {
        throw new Error(`Solicitud de modificacion apunta a una linea inexistente (${request.lineIndex})`);
      }
      const requestItems = [
        {
          orderItemId: line.id,
          itemName: line.item.name,
          quantity: line.quantity,
          modifierLabels: request.modifierLabels,
        },
      ];
      const requestText = requestItems
        .map((item) => `${item.quantity}x ${item.itemName}: ${item.modifierLabels.join(", ") || "sin opciones marcadas"}`)
        .join(" | ");
      const status = request.status ?? "pending";
      const requestedAt = new Date(order.createdAt.getTime() + 3 * MINUTE);
      const resolved = status !== "pending";

      statements.push({
        sql: `
          insert into order_modification_request (
            id, order_id, customer_id, status, request_text, request_items_json,
            staff_response, resolved_by_staff_user_id, resolved_at, created_at, updated_at
          )
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          randomUUID(),
          order.id,
          customerId,
          status,
          requestText,
          JSON.stringify(requestItems),
          request.staffResponse ?? null,
          resolved ? (staffIdByRole.get("cajero") ?? staffIdByRole.get("admin") ?? null) : null,
          resolved ? toSqlTime(new Date(requestedAt.getTime() + 2 * MINUTE)) : null,
          toSqlTime(requestedAt),
          toSqlTime(requestedAt),
        ],
      });
    }
  }

  // El contador queda en el siguiente numero libre de cada dia.
  for (const [serviceDate, nextTicketNumber] of nextTicketByDate) {
    statements.push({
      sql: "insert into ticket_counter (truck_id, service_date, next_ticket_number) values (?, ?, ?)",
      args: [truckId, serviceDate, nextTicketNumber],
    });
  }

  return statements;
}

/** Algunas entradas de auditoria para que la pantalla de historial no arranque vacia. */
function buildAuditStatements(
  truckId: string,
  truck: DemoTruck,
  staffIdByRole: Map<string, string>,
  staffIdByEmail: Map<string, string>,
  roleIds: Map<string, string>,
  now: Date,
) {
  const adminId = staffIdByRole.get("admin") ?? null;
  const entries: Array<{
    action: string;
    targetType: string;
    targetId: string;
    reason?: string;
    metadata: Record<string, unknown>;
    daysAgo: number;
  }> = [
    {
      action: "truck.settings.updated",
      targetType: "truck_config",
      targetId: truckId,
      metadata: { name: truck.name, slug: truck.slug },
      daysAgo: 6,
    },
    {
      action: "truck.hours.updated",
      targetType: "opening_hours",
      targetId: truckId,
      metadata: {},
      daysAgo: 5,
    },
    ...truck.customRoles.map((role) => ({
      action: "role.created",
      targetType: "role",
      targetId: roleIds.get(role.name) ?? role.name,
      metadata: { name: role.name, permissions: role.permissions },
      daysAgo: 5,
    })),
    ...truck.staff
      .filter((member) => member.role !== "admin")
      .map((member) => ({
        action: "staff-user.created",
        targetType: "staff_user",
        targetId: staffIdByEmail.get(member.email) ?? member.email,
        metadata: { email: member.email, role: member.role },
        daysAgo: 4,
      })),
  ];

  if (truck.pausedReason) {
    entries.push({
      action: "truck.paused",
      targetType: "truck_config",
      targetId: truckId,
      reason: truck.pausedReason,
      metadata: { paused: true },
      daysAgo: 0,
    });
  }

  return entries.map<Statement>((entry) => ({
    sql: `
      insert into audit_log (
        id, truck_id, actor_user_id, action, target_type, target_id, reason, metadata_json, at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      randomUUID(),
      truckId,
      adminId,
      entry.action,
      entry.targetType,
      entry.targetId,
      entry.reason ?? null,
      JSON.stringify(entry.metadata),
      toSqlTime(new Date(now.getTime() - entry.daysAgo * DAY - 30 * MINUTE)),
    ],
  }));
}

async function seedDemoTruck(
  truck: DemoTruck,
  truckIndex: number,
  staffPassword: string,
  customerIds: Map<string, string>,
) {
  const db = getDb();
  const now = new Date();
  const truckId = randomUUID();
  const random = createRandom(truckIndex + 1);
  const statements: Statement[] = [];

  statements.push(
    {
      sql: `
        insert into truck_config (
          id, name, slug, logo_url, brand_icon, primary_color, timezone,
          tip_defaults_json, beep_sound_id, customer_pickup_cooldown_seconds,
          paused_manual_at, paused_reason, created_at
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        truckId,
        truck.name,
        truck.slug,
        truck.withLogo ? buildLogoImage(truck.primaryColor) : null,
        truck.brandIcon,
        truck.primaryColor,
        truck.timezone,
        JSON.stringify([0, 5, 10, 15]),
        truck.beepSoundId,
        truck.customerPickupCooldownSeconds,
        truck.pausedReason ? toSqlTime(new Date(now.getTime() - 5 * MINUTE)) : null,
        truck.pausedReason ?? null,
        // Orden estable en la lista de trucks: el primero de DEMO_TRUCKS va primero.
        toSqlTime(new Date(now.getTime() - (7 * DAY - truckIndex * MINUTE))),
      ],
    },
    {
      sql: `
        insert into truck_profile (
          id, truck_config_id, address, hero_image_url, public_tagline,
          instagram_handle, allow_order_modifications
        )
        values (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        randomUUID(),
        truckId,
        truck.address,
        truck.withHero ? buildHeroImage(truck.primaryColor, truck.accentColor) : null,
        truck.publicTagline,
        truck.instagramHandle,
        truck.allowOrderModifications ? 1 : 0,
      ],
    },
    ...truck.hours.map<Statement>((entry, weekday) => ({
      sql: `
        insert into opening_hours (id, truck_id, weekday, opens_at, closes_at, closed)
        values (?, ?, ?, ?, ?, ?)
      `,
      args: [randomUUID(), truckId, weekday, entry?.[0] ?? null, entry?.[1] ?? null, entry ? 0 : 1],
    })),
  );

  const roleIds = new Map<string, string>();
  const roles: Array<{ name: string; permissions: readonly string[]; isSystem: boolean }> = [
    { name: "admin", permissions: SYSTEM_ROLES.admin, isSystem: true },
    { name: "cajero", permissions: SYSTEM_ROLES.cajero, isSystem: true },
    { name: "cocina", permissions: SYSTEM_ROLES.cocina, isSystem: true },
    ...truck.customRoles.map((role) => ({ ...role, isSystem: false })),
  ];
  for (const role of roles) {
    const roleId = randomUUID();
    roleIds.set(role.name, roleId);
    statements.push({
      sql: `
        insert into role (id, truck_id, name, is_system, permissions_json)
        values (?, ?, ?, ?, ?)
      `,
      args: [roleId, truckId, role.name, role.isSystem ? 1 : 0, JSON.stringify(role.permissions)],
    });
  }

  const staffIdByRole = new Map<string, string>();
  const staffIdByEmail = new Map<string, string>();
  for (const member of truck.staff) {
    const roleId = roleIds.get(member.role);
    if (!roleId) {
      throw new Error(`[${truck.name}] ${member.email} tiene el rol "${member.role}", que no existe`);
    }
    const staffId = randomUUID();
    staffIdByEmail.set(member.email, staffId);
    if (member.active !== false && !staffIdByRole.has(member.role)) {
      staffIdByRole.set(member.role, staffId);
    }
    statements.push({
      sql: `
        insert into staff_user (id, truck_id, email, full_name, password_hash, role_id, active, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        staffId,
        truckId,
        member.email,
        member.fullName,
        hashPassword(staffPassword),
        roleId,
        member.active === false ? 0 : 1,
        toSqlTime(new Date(now.getTime() - 6 * DAY)),
      ],
    });
  }

  const menu = buildMenuStatements(truckId, truck);
  statements.push(...menu.statements);

  const phonePrefix = `11444${truckIndex}0`;
  const orders = [
    ...planHistoryOrders(truck, menu.index, now, random, phonePrefix),
    ...planLiveOrders(truck, menu.index, now),
  ];
  statements.push(...buildOrderStatements(truckId, orders, customerIds, staffIdByRole));
  statements.push(...buildAuditStatements(truckId, truck, staffIdByRole, staffIdByEmail, roleIds, now));

  // Todo el truck en una transaccion: si algo falla no queda a medio crear.
  await db.batch(statements, "write");

  return {
    orders: orders.length,
    menuItems: menu.index.size,
    live: truck.orders.length,
  };
}

async function main() {
  const env = getServerEnv();
  const staffPassword = env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  // Las claves que vienen del .env no se imprimen; las de fallback si, para la demo.
  const staffPasswordLabel = env.SEED_ADMIN_PASSWORD ? "la de SEED_ADMIN_PASSWORD" : staffPassword;

  await migrateDb();
  const superadmin = await seedPlatformAdmin();

  const removed = await wipeAllTrucks();
  console.log(
    removed.length
      ? `Trucks borrados: ${removed.join(", ")}`
      : "No habia trucks cargados",
  );

  // Clientes compartidos entre trucks: el telefono es unico en toda la base.
  const customerIds = new Map<string, string>();

  for (const [index, truck] of DEMO_TRUCKS.entries()) {
    const result = await seedDemoTruck(truck, index, staffPassword, customerIds);
    console.log(
      `\n${truck.brandIcon}  ${truck.name}  ->  /t/${truck.slug}` +
        `\n   ${result.menuItems} productos, ${result.orders} pedidos (${result.live} en vivo)` +
        `\n   Usuarios (clave: ${staffPasswordLabel}):` +
        truck.staff
          .map((member) => `\n     ${member.role.padEnd(14)} ${member.email}${member.active === false ? "  [inactivo]" : ""}`)
          .join(""),
    );
  }

  console.log(
    `\nSuperadmin de plataforma: ${superadmin.email}` +
      (env.SEED_SUPERADMIN_PASSWORD ? "" : ` / ${superadmin.password}`),
  );
  console.log("Seed de demo completado");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
