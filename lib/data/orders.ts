import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { getTruckConfig, getTruckStatus } from "@/lib/data/truck-status";
import type {
  Customer,
  CustomerOrder,
  OrderItem,
  OrderStatus,
} from "@/lib/types/domain";
import type {
  CreateOrderInput,
  CustomerSessionInput,
} from "@/lib/validators/customer";

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  updated_at: string;
};

type MenuItemRow = {
  id: string;
  name: string;
  available: number;
  has_variants: number;
  price_cents: number;
};

type MenuVariantRow = {
  id: string;
  menu_item_id: string;
  name: string;
  available: number;
  price_cents: number;
};

type OrderRow = {
  id: string;
  ticket_number: number;
  service_date: string;
  customer_id: string;
  status: OrderStatus;
  subtotal_cents: number;
  tip_cents: number;
  total_cents: number;
  pulse_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  refund_pending: number;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  menu_item_id: string;
  menu_variant_id: string | null;
  quantity: number;
  name_snapshot: string;
  variant_name_snapshot: string | null;
  unit_price_cents: number;
  line_total_cents: number;
  notes: string | null;
};

type TicketCounterRow = {
  next_ticket_number: number;
};

function normalizePhone(phone: string) {
  return phone.replace(/\s+/g, " ").trim();
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    menuItemId: row.menu_item_id,
    menuVariantId: row.menu_variant_id,
    quantity: row.quantity,
    nameSnapshot: row.name_snapshot,
    variantNameSnapshot: row.variant_name_snapshot,
    unitPriceCents: row.unit_price_cents,
    lineTotalCents: row.line_total_cents,
    notes: row.notes,
  };
}

function mapOrder(row: OrderRow, items: OrderItem[]): CustomerOrder {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    serviceDate: row.service_date,
    customerId: row.customer_id,
    status: row.status,
    subtotalCents: row.subtotal_cents,
    tipCents: row.tip_cents,
    totalCents: row.total_cents,
    pulseAt: row.pulse_at,
    readyAt: row.ready_at,
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    refundPending: Boolean(row.refund_pending),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  };
}

function getServiceDate(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function nextTicketNumber(db: Database.Database, serviceDate: string) {
  const current = db
    .prepare<{ serviceDate: string }, TicketCounterRow>(
      "select next_ticket_number from ticket_counter where service_date = @serviceDate",
    )
    .get({ serviceDate });

  if (!current) {
    db.prepare(
      "insert into ticket_counter (service_date, next_ticket_number) values (@serviceDate, 2)",
    ).run({ serviceDate });
    return 1;
  }

  db.prepare(
    "update ticket_counter set next_ticket_number = next_ticket_number + 1 where service_date = @serviceDate",
  ).run({ serviceDate });

  return current.next_ticket_number;
}

export function upsertCustomer(input: CustomerSessionInput) {
  const db = getDb();
  const phone = normalizePhone(input.phone);
  const existing = db
    .prepare<{ phone: string }, CustomerRow>("select * from customer where phone = @phone")
    .get({ phone });
  const id = existing?.id ?? randomUUID();

  db.prepare(
    `
      insert into customer (id, name, phone, updated_at)
      values (@id, @name, @phone, datetime('now'))
      on conflict(phone) do update set
        name = excluded.name,
        updated_at = datetime('now')
    `,
  ).run({
    id,
    name: input.name.trim(),
    phone,
  });

  const row = db
    .prepare<{ id: string }, CustomerRow>("select * from customer where id = @id")
    .get({ id });

  if (!row) {
    throw new ApiError(500, "INTERNAL", "No se pudo crear la sesión");
  }

  return mapCustomer(row);
}

export function getCustomerById(customerId: string) {
  const row = getDb()
    .prepare<{ id: string }, CustomerRow>("select * from customer where id = @id")
    .get({ id: customerId });

  return row ? mapCustomer(row) : null;
}

export async function createCustomerOrder(
  customerId: string,
  input: CreateOrderInput,
) {
  const status = await getTruckStatus();

  if (!status.isOpen) {
    throw new ApiError(
      409,
      "TRUCK_CLOSED",
      status.paused
        ? status.reason ?? "El truck está en pausa"
        : "El truck está cerrado en este momento",
    );
  }

  const config = await getTruckConfig();
  const serviceDate = getServiceDate(config.timezone);
  const db = getDb();

  const transaction = db.transaction(() => {
    const customer = getCustomerById(customerId);

    if (!customer) {
      throw new ApiError(401, "UNAUTHORIZED", "La sesión cliente ya no existe");
    }

    const orderItems = input.items.map((entry) => {
      const menuItem = db
        .prepare<{ id: string }, MenuItemRow>(
          "select id, name, available, has_variants, price_cents from menu_item where id = @id",
        )
        .get({ id: entry.menuItemId });

      if (!menuItem || !menuItem.available) {
        throw new ApiError(409, "OUT_OF_STOCK", "Uno de los productos ya no está disponible");
      }

      let variant: MenuVariantRow | null = null;
      let unitPriceCents = menuItem.price_cents;

      if (menuItem.has_variants) {
        if (!entry.menuVariantId) {
          throw new ApiError(400, "INVALID_INPUT", `Elegí una variante para ${menuItem.name}`);
        }

        variant = db
          .prepare<{ id: string; menuItemId: string }, MenuVariantRow>(
            `
              select id, menu_item_id, name, available, price_cents
              from menu_variant
              where id = @id and menu_item_id = @menuItemId
            `,
          )
          .get({ id: entry.menuVariantId, menuItemId: menuItem.id }) ?? null;

        if (!variant || !variant.available) {
          throw new ApiError(409, "OUT_OF_STOCK", "La variante elegida ya no está disponible");
        }

        unitPriceCents = variant.price_cents;
      } else if (entry.menuVariantId) {
        throw new ApiError(400, "INVALID_INPUT", `${menuItem.name} no usa variantes`);
      }

      return {
        id: randomUUID(),
        menuItemId: menuItem.id,
        menuVariantId: variant?.id ?? null,
        quantity: entry.quantity,
        nameSnapshot: menuItem.name,
        variantNameSnapshot: variant?.name ?? null,
        unitPriceCents,
        lineTotalCents: unitPriceCents * entry.quantity,
        notes: entry.notes?.trim() || null,
      };
    });

    const subtotalCents = orderItems.reduce(
      (total, item) => total + item.lineTotalCents,
      0,
    );
    const tipCents = input.tipCents;
    const totalCents = subtotalCents + tipCents;
    const orderId = randomUUID();
    const ticketNumber = nextTicketNumber(db, serviceDate);

    db.prepare(
      `
        insert into customer_order (
          id, ticket_number, service_date, customer_id, status,
          subtotal_cents, tip_cents, total_cents
        )
        values (
          @id, @ticketNumber, @serviceDate, @customerId, 'pending',
          @subtotalCents, @tipCents, @totalCents
        )
      `,
    ).run({
      id: orderId,
      ticketNumber,
      serviceDate,
      customerId,
      subtotalCents,
      tipCents,
      totalCents,
    });

    const insertItem = db.prepare(
      `
        insert into order_item (
          id, order_id, menu_item_id, menu_variant_id, quantity,
          name_snapshot, variant_name_snapshot, unit_price_cents,
          line_total_cents, notes
        )
        values (
          @id, @orderId, @menuItemId, @menuVariantId, @quantity,
          @nameSnapshot, @variantNameSnapshot, @unitPriceCents,
          @lineTotalCents, @notes
        )
      `,
    );

    orderItems.forEach((item) => {
      insertItem.run({
        ...item,
        orderId,
      });
    });

    const order = getCustomerOrderById(customerId, orderId);

    if (!order) {
      throw new ApiError(500, "INTERNAL", "No se pudo crear el pedido");
    }

    return order;
  });

  return transaction();
}

export function getCustomerOrderById(customerId: string, orderId: string) {
  const db = getDb();
  const orderRow = db
    .prepare<{ id: string; customerId: string }, OrderRow>(
      "select * from customer_order where id = @id and customer_id = @customerId",
    )
    .get({ id: orderId, customerId });

  if (!orderRow) {
    return null;
  }

  const itemRows = db
    .prepare<{ orderId: string }, OrderItemRow>(
      "select * from order_item where order_id = @orderId order by rowid asc",
    )
    .all({ orderId });

  return mapOrder(orderRow, itemRows.map(mapOrderItem));
}
