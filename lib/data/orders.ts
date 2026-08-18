import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import {
  getCurrentTruckId,
  getPublicTruckId,
  getTruckConfig,
  getTruckStatus,
} from "@/lib/data/truck-status";
import type {
  Customer,
  CustomerOrder,
  OrderItemStatus,
  OrderItem,
  OrderModificationRequest,
  OrderModificationStatus,
  OrderStatus,
} from "@/lib/types/domain";
import type {
  CreateOrderInput,
  CustomerSessionInput,
} from "@/lib/validators/customer";

type CreateCustomerOrderOptions = {
  paymentStatus?: OrderRow["payment_status"];
};

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

type MenuModifierRow = {
  label: string;
};

type MenuItemModifierRow = {
  menu_item_id: string;
  label: string;
  default_checked: number;
};

type OrderRow = {
  id: string;
  truck_id: string;
  ticket_number: number;
  service_date: string;
  customer_id: string;
  status: OrderStatus;
  payment_status: "pending" | "approved" | "rejected" | "cancelled" | "refunded";
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  paid_at: string | null;
  subtotal_cents: number;
  tip_cents: number;
  total_cents: number;
  pulse_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  picked_up_at: string | null;
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
  status: OrderItemStatus;
  notes: string | null;
};

type StaffOrderItem = OrderItem & {
  displayNotes: string | null;
};

type OrderModificationRequestRow = {
  id: string;
  order_id: string;
  customer_id: string;
  status: OrderModificationStatus;
  request_text: string;
  request_items_json: string | null;
  staff_response: string | null;
  extra_amount_cents: number;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  mp_checkout_url: string | null;
  paid_at: string | null;
  resolved_by_staff_user_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type StaffOrderRow = OrderRow & {
  customer_name: string;
  customer_phone: string;
};

type TicketCounterRow = {
  next_ticket_number: number;
};

type PaymentWebhookEventRow = {
  id: string;
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
    status: row.status,
    notes: row.notes,
  };
}

function normalizeNotePart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function modifierDefaultNotePart(modifier: MenuItemModifierRow) {
  if (modifier.default_checked) {
    return modifier.label;
  }

  const normalizedLabel = modifier.label.replace(/^con\s+/i, "").toLowerCase();
  return `Sin ${normalizedLabel}`;
}

function visibleStaffNotes(
  notes: string | null,
  modifiers: MenuItemModifierRow[],
) {
  if (!notes) {
    return null;
  }

  const hiddenDefaultParts = new Set(
    modifiers.map((modifier) => normalizeNotePart(modifierDefaultNotePart(modifier))),
  );
  const visibleParts = notes
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !hiddenDefaultParts.has(normalizeNotePart(part)));

  return visibleParts.join(", ") || null;
}

async function getModifiersByMenuItemId() {
  const result = await getDb().execute({
    sql: `
      select menu_item_modifier.menu_item_id, menu_item_modifier.label,
        menu_item_modifier.default_checked
      from menu_item_modifier
      join menu_item on menu_item.id = menu_item_modifier.menu_item_id
      where menu_item.truck_id = ?
      order by menu_item_modifier.position asc
    `,
    args: [await getCurrentTruckId()],
  });
  const rows = result.rows as unknown as MenuItemModifierRow[];
  const byMenuItemId = new Map<string, MenuItemModifierRow[]>();

  rows.forEach((row) => {
    byMenuItemId.set(row.menu_item_id, [
      ...(byMenuItemId.get(row.menu_item_id) ?? []),
      row,
    ]);
  });

  return byMenuItemId;
}

function mapStaffOrderItem(
  row: OrderItemRow,
  modifiersByMenuItemId: Map<string, MenuItemModifierRow[]>,
): StaffOrderItem {
  return {
    ...mapOrderItem(row),
    displayNotes: visibleStaffNotes(
      row.notes,
      modifiersByMenuItemId.get(row.menu_item_id) ?? [],
    ),
  };
}

function mapModificationRequest(
  row: OrderModificationRequestRow,
): OrderModificationRequest {
  const parsedItems = row.request_items_json
    ? (JSON.parse(row.request_items_json) as OrderModificationRequest["requestItems"])
    : [];

  return {
    id: row.id,
    orderId: row.order_id,
    customerId: row.customer_id,
    status: row.status,
    requestText: row.request_text,
    requestItems: parsedItems,
    staffResponse: row.staff_response,
    extraAmountCents: row.extra_amount_cents,
    mpPreferenceId: row.mp_preference_id,
    mpPaymentId: row.mp_payment_id,
    mpCheckoutUrl: row.mp_checkout_url,
    paidAt: row.paid_at,
    resolvedByStaffUserId: row.resolved_by_staff_user_id,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getModificationRequestsForOrder(orderId: string) {
  const result = await getDb().execute({
    sql: `
      select *
      from order_modification_request
      where order_id = ?
      order by created_at asc
    `,
    args: [orderId],
  });
  return (result.rows as unknown as OrderModificationRequestRow[]).map(mapModificationRequest);
}

/**
 * Version en lote de la anterior. El kanban lista N pedidos a la vez: pedirlas
 * de a una era un N+1 que se repetia en cada poll.
 */
async function getModificationRequestsByOrderId(orderIds: string[]) {
  const byOrderId = new Map<string, OrderModificationRequest[]>();

  if (!orderIds.length) {
    return byOrderId;
  }

  const result = await getDb().execute({
    sql: `
      select *
      from order_modification_request
      where order_id in (${orderIds.map(() => "?").join(", ")})
      order by created_at asc
    `,
    args: orderIds,
  });

  for (const row of result.rows as unknown as OrderModificationRequestRow[]) {
    const request = mapModificationRequest(row);
    const current = byOrderId.get(request.orderId);

    if (current) {
      current.push(request);
    } else {
      byOrderId.set(request.orderId, [request]);
    }
  }

  return byOrderId;
}

function mapOrder(
  row: OrderRow,
  items: OrderItem[],
  modificationRequests: OrderModificationRequest[] = [],
): CustomerOrder {
  return {
    id: row.id,
    truckId: row.truck_id,
    ticketNumber: row.ticket_number,
    serviceDate: row.service_date,
    customerId: row.customer_id,
    status: row.status,
    paymentStatus: row.payment_status,
    mpPreferenceId: row.mp_preference_id,
    mpPaymentId: row.mp_payment_id,
    paidAt: row.paid_at,
    subtotalCents: row.subtotal_cents,
    tipCents: row.tip_cents,
    totalCents: row.total_cents,
    pulseAt: row.pulse_at,
    readyAt: row.ready_at,
    deliveredAt: row.delivered_at,
    pickedUpAt: row.picked_up_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    refundPending: Boolean(row.refund_pending),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
    modificationRequests,
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

function getNextOrderItemStatus(status: OrderItemStatus) {
  const nextStatusByCurrent: Partial<Record<OrderItemStatus, OrderItemStatus>> = {
    pending: "preparing",
    preparing: "ready",
    ready: "delivered",
  };

  return nextStatusByCurrent[status] ?? null;
}

export async function upsertCustomer(input: CustomerSessionInput): Promise<Customer> {
  const db = getDb();
  const phone = normalizePhone(input.phone);
  const existingResult = await db.execute({
    sql: "select * from customer where phone = ?",
    args: [phone],
  });
  const existing = existingResult.rows[0] as unknown as CustomerRow | undefined;
  const id = existing?.id ?? randomUUID();

  await db.execute({
    sql: `
      insert into customer (id, name, phone, updated_at)
      values (?, ?, ?, datetime('now'))
      on conflict(phone) do update set
        name = excluded.name,
        updated_at = datetime('now')
    `,
    args: [id, input.name.trim(), phone],
  });

  const rowResult = await db.execute({
    sql: "select * from customer where id = ?",
    args: [id],
  });
  const row = rowResult.rows[0] as unknown as CustomerRow | undefined;

  if (!row) {
    throw new ApiError(500, "INTERNAL", "No se pudo crear la sesión");
  }

  return mapCustomer(row);
}

export async function getCustomerById(customerId: string): Promise<Customer | null> {
  const result = await getDb().execute({
    sql: "select * from customer where id = ?",
    args: [customerId],
  });
  const row = result.rows[0] as unknown as CustomerRow | undefined;
  return row ? mapCustomer(row) : null;
}

export async function createCustomerOrder(
  customerId: string,
  input: CreateOrderInput,
  options: CreateCustomerOrderOptions = {},
) {
  // El pedido pertenece al truck del que el cliente esta comprando.
  const truckId = await getPublicTruckId();
  const status = await getTruckStatus(truckId);

  if (!status.isOpen) {
    throw new ApiError(
      409,
      "TRUCK_CLOSED",
      status.paused
        ? status.reason ?? "El truck está en pausa"
        : "El truck está cerrado en este momento",
    );
  }

  const config = await getTruckConfig(truckId);
  const serviceDate = getServiceDate(config.timezone);
  const db = getDb();

  const customer = await getCustomerById(customerId);
  if (!customer) {
    throw new ApiError(401, "UNAUTHORIZED", "La sesión cliente ya no existe");
  }

  const menuItemResults = await Promise.all(
    input.items.map((entry) =>
      db.execute({
        // El truck es parte del filtro a proposito: sin esto se podia mandar el
        // id de un producto de otro foodtruck y quedaba pegado a este pedido.
        sql: `
          select id, name, available, has_variants, price_cents
          from menu_item
          where id = ? and truck_id = ?
        `,
        args: [entry.menuItemId, config.id],
      }),
    ),
  );

  const orderItems: Array<{
    id: string;
    menuItemId: string;
    menuVariantId: string | null;
    quantity: number;
    nameSnapshot: string;
    variantNameSnapshot: string | null;
    unitPriceCents: number;
    lineTotalCents: number;
    notes: string | null;
  }> = [];

  for (let i = 0; i < input.items.length; i++) {
    const entry = input.items[i]!;
    const menuItem = menuItemResults[i]!.rows[0] as unknown as MenuItemRow | undefined;

    if (!menuItem || !menuItem.available) {
      throw new ApiError(409, "OUT_OF_STOCK", "Uno de los productos ya no está disponible");
    }

    let variant: MenuVariantRow | null = null;
    let unitPriceCents = menuItem.price_cents;

    if (menuItem.has_variants) {
      if (entry.menuVariantId) {
        const variantResult = await db.execute({
          sql: `
            select id, menu_item_id, name, available, price_cents
            from menu_variant
            where id = ? and menu_item_id = ?
          `,
          args: [entry.menuVariantId, menuItem.id],
        });
        variant = (variantResult.rows[0] as unknown as MenuVariantRow | undefined) ?? null;
      }

      if (!variant || !variant.available) {
        const fallbackResult = await db.execute({
          sql: `
            select id, menu_item_id, name, available, price_cents
            from menu_variant
            where menu_item_id = ? and available = 1
            order by position asc
            limit 1
          `,
          args: [menuItem.id],
        });
        variant = (fallbackResult.rows[0] as unknown as MenuVariantRow | undefined) ?? null;
      }

      if (!variant) {
        throw new ApiError(409, "OUT_OF_STOCK", "No hay variantes disponibles para este producto");
      }

      unitPriceCents = variant.price_cents;
    }

    orderItems.push({
      id: randomUUID(),
      menuItemId: menuItem.id,
      menuVariantId: variant?.id ?? null,
      quantity: entry.quantity,
      nameSnapshot: menuItem.name,
      variantNameSnapshot: variant?.name ?? null,
      unitPriceCents,
      lineTotalCents: unitPriceCents * entry.quantity,
      notes: entry.notes?.trim() || null,
    });
  }

  const subtotalCents = orderItems.reduce((total, item) => total + item.lineTotalCents, 0);
  const tipCents = input.tipCents;
  const totalCents = subtotalCents + tipCents;
  const orderId = randomUUID();
  const paymentStatus = options.paymentStatus ?? "approved";

  const counterResult = await db.execute({
    sql: "select next_ticket_number from ticket_counter where truck_id = ? and service_date = ?",
    args: [config.id, serviceDate],
  });
  const counterRow = counterResult.rows[0] as unknown as TicketCounterRow | undefined;

  let ticketNumber: number;
  if (!counterRow) {
    await db.execute({
      sql: "insert into ticket_counter (truck_id, service_date, next_ticket_number) values (?, ?, 2)",
      args: [config.id, serviceDate],
    });
    ticketNumber = 1;
  } else {
    ticketNumber = counterRow.next_ticket_number;
    await db.execute({
      sql: "update ticket_counter set next_ticket_number = next_ticket_number + 1 where truck_id = ? and service_date = ?",
      args: [config.id, serviceDate],
    });
  }

  const insertStatements = [
    {
      sql: `
        insert into customer_order (
          id, truck_id, ticket_number, service_date, customer_id, status, payment_status,
          subtotal_cents, tip_cents, total_cents
        )
        values (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
      `,
      args: [orderId, config.id, ticketNumber, serviceDate, customerId, paymentStatus, subtotalCents, tipCents, totalCents],
    },
    ...orderItems.map((item) => ({
      sql: `
        insert into order_item (
          id, order_id, menu_item_id, menu_variant_id, quantity,
          name_snapshot, variant_name_snapshot, unit_price_cents,
          line_total_cents, notes
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        item.id,
        orderId,
        item.menuItemId,
        item.menuVariantId,
        item.quantity,
        item.nameSnapshot,
        item.variantNameSnapshot,
        item.unitPriceCents,
        item.lineTotalCents,
        item.notes,
      ],
    })),
  ];

  await db.batch(insertStatements, "write");

  const order = await getCustomerOrderById(customerId, orderId);
  if (!order) {
    throw new ApiError(500, "INTERNAL", "No se pudo crear el pedido");
  }

  return order;
}

export async function getCustomerOrderById(
  customerId: string,
  orderId: string,
): Promise<CustomerOrder | null> {
  const db = getDb();
  const orderResult = await db.execute({
    sql: "select * from customer_order where id = ? and customer_id = ?",
    args: [orderId, customerId],
  });
  const orderRow = orderResult.rows[0] as unknown as OrderRow | undefined;

  if (!orderRow) {
    return null;
  }

  const [itemResult, modRequests] = await Promise.all([
    db.execute({
      sql: "select * from order_item where order_id = ? order by rowid asc",
      args: [orderId],
    }),
    getModificationRequestsForOrder(orderId),
  ]);

  return mapOrder(
    orderRow,
    (itemResult.rows as unknown as OrderItemRow[]).map(mapOrderItem),
    modRequests,
  );
}

async function getOrderRowById(orderId: string): Promise<OrderRow | undefined> {
  const result = await getDb().execute({
    sql: "select * from customer_order where id = ?",
    args: [orderId],
  });
  return result.rows[0] as unknown as OrderRow | undefined;
}

async function getCustomerPickupCooldownSeconds(truckId: string): Promise<number> {
  const result = await getDb().execute({
    sql: "select customer_pickup_cooldown_seconds from truck_config where id = ?",
    args: [truckId],
  });
  const row = result.rows[0] as unknown as { customer_pickup_cooldown_seconds: number } | undefined;
  return Math.max(0, row?.customer_pickup_cooldown_seconds ?? 15);
}

async function assertOrderCanMove(orderId: string): Promise<OrderRow> {
  const current = await getOrderRowById(orderId);

  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Pedido no encontrado");
  }

  if (current.payment_status !== "approved") {
    throw new ApiError(409, "CONFLICT", "El pago del pedido todavia no esta aprobado");
  }

  const modRequests = await getModificationRequestsForOrder(current.id);
  const activeModification = modRequests.find((request) =>
    request.status === "pending" || request.status === "extra_payment_pending"
  );

  if (activeModification) {
    throw new ApiError(
      409,
      "CONFLICT",
      "Resolve la modificacion antes de avanzar el pedido",
    );
  }

  return current;
}

async function syncOrderStatusFromItems(orderId: string): Promise<void> {
  const db = getDb();
  const statusResult = await db.execute({
    sql: `
      select
        count(*) as total_count,
        coalesce(sum(case when status = 'pending' then 1 else 0 end), 0) as pending_count,
        coalesce(sum(case when status = 'ready' then 1 else 0 end), 0) as ready_count,
        coalesce(sum(case when status = 'delivered' then 1 else 0 end), 0) as delivered_count
      from order_item
      where order_id = ?
    `,
    args: [orderId],
  });

  const statusCounts = statusResult.rows[0] as unknown as {
    total_count: number;
    pending_count: number;
    ready_count: number;
    delivered_count: number;
  } | undefined;

  if (!statusCounts || statusCounts.total_count === 0) {
    throw new ApiError(409, "CONFLICT", "El pedido no tiene items para avanzar");
  }

  const nextOrderStatus: OrderStatus =
    statusCounts.delivered_count === statusCounts.total_count
      ? "delivered"
      : statusCounts.ready_count + statusCounts.delivered_count ===
          statusCounts.total_count
        ? "ready"
        : statusCounts.pending_count < statusCounts.total_count
          ? "preparing"
          : "pending";

  await db.execute({
    sql: `
      update customer_order set
        status = ?,
        ready_at = case
          when ? = 'ready' and ready_at is null then datetime('now')
          else ready_at
        end,
        pulse_at = case
          when ? = 'ready' and status <> 'ready' then datetime('now')
          else pulse_at
        end,
        delivered_at = case
          when ? = 'delivered' and delivered_at is null then datetime('now')
          when ? <> 'delivered' then null
          else delivered_at
        end,
        picked_up_at = case
          when ? in ('pending', 'preparing') then null
          else picked_up_at
        end,
        updated_at = datetime('now')
      where id = ?
    `,
    args: [
      nextOrderStatus,
      nextOrderStatus,
      nextOrderStatus,
      nextOrderStatus,
      nextOrderStatus,
      nextOrderStatus,
      orderId,
    ],
  });
}

export async function advanceStaffOrderItem(orderId: string, itemId: string) {
  const db = getDb();
  await assertOrderCanMove(orderId);

  const itemResult = await db.execute({
    sql: "select * from order_item where id = ? and order_id = ?",
    args: [itemId, orderId],
  });
  const item = itemResult.rows[0] as unknown as OrderItemRow | undefined;

  if (!item) {
    throw new ApiError(404, "NOT_FOUND", "Item no encontrado");
  }

  const nextStatus = getNextOrderItemStatus(item.status);

  if (!nextStatus) {
    throw new ApiError(409, "CONFLICT", "Este item ya fue entregado");
  }

  await db.execute({
    sql: "update order_item set status = ? where id = ? and order_id = ?",
    args: [nextStatus, itemId, orderId],
  });

  await syncOrderStatusFromItems(orderId);
  return getStaffOrderById(orderId);
}

export async function advanceAllStaffOrderItems(orderId: string) {
  const db = getDb();
  await assertOrderCanMove(orderId);

  const itemsResult = await db.execute({
    sql: "select * from order_item where order_id = ? order by rowid asc",
    args: [orderId],
  });
  const itemRows = itemsResult.rows as unknown as OrderItemRow[];

  if (!itemRows.length) {
    throw new ApiError(409, "CONFLICT", "El pedido no tiene items para avanzar");
  }

  const currentStatus: OrderItemStatus | null = itemRows.some(
    (item) => item.status === "pending",
  )
    ? "pending"
    : itemRows.some((item) => item.status === "preparing")
      ? "preparing"
      : itemRows.some((item) => item.status === "ready")
        ? "ready"
        : null;

  if (!currentStatus) {
    throw new ApiError(409, "CONFLICT", "Todos los items ya fueron entregados");
  }

  const nextStatus = getNextOrderItemStatus(currentStatus);

  if (!nextStatus) {
    throw new ApiError(409, "CONFLICT", "El pedido no puede avanzar desde este estado");
  }

  await db.execute({
    sql: "update order_item set status = ? where order_id = ? and status = ?",
    args: [nextStatus, orderId, currentStatus],
  });

  await syncOrderStatusFromItems(orderId);
  return getStaffOrderById(orderId);
}

export async function advanceStaffOrder(orderId: string) {
  return advanceAllStaffOrderItems(orderId);
}

export async function bumpStaffOrder(orderId: string) {
  const db = getDb();
  await assertOrderCanMove(orderId);

  await db.execute({
    sql: "update order_item set status = 'delivered' where order_id = ?",
    args: [orderId],
  });

  await syncOrderStatusFromItems(orderId);
  return getStaffOrderById(orderId);
}

export async function unbumpStaffOrder(orderId: string) {
  const db = getDb();
  const current = await assertOrderCanMove(orderId);

  if (current.status !== "delivered") {
    throw new ApiError(409, "CONFLICT", "Solo podes hacer unbump de pedidos entregados");
  }

  await db.execute({
    sql: "update order_item set status = 'ready' where order_id = ?",
    args: [orderId],
  });

  await syncOrderStatusFromItems(orderId);
  return getStaffOrderById(orderId);
}

export async function confirmCustomerOrderPickup(customerId: string, orderId: string) {
  const db = getDb();
  const currentResult = await db.execute({
    sql: "select * from customer_order where id = ? and customer_id = ?",
    args: [orderId, customerId],
  });
  const current = currentResult.rows[0] as unknown as OrderRow | undefined;

  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "No encontramos ese ticket");
  }

  if (current.payment_status !== "approved") {
    throw new ApiError(409, "CONFLICT", "El pago del pedido todavia no esta aprobado");
  }

  if (current.status !== "ready" && current.status !== "delivered") {
    throw new ApiError(409, "CONFLICT", "Todavia no podes confirmar el retiro");
  }

  await db.execute({
    sql: `
      update customer_order set
        picked_up_at = coalesce(picked_up_at, datetime('now')),
        updated_at = datetime('now')
      where id = ?
    `,
    args: [orderId],
  });

  const order = await getCustomerOrderById(customerId, orderId);
  if (!order) {
    throw new ApiError(500, "INTERNAL", "No pudimos confirmar el retiro");
  }

  return order;
}

export async function pulseStaffOrder(orderId: string) {
  const db = getDb();
  const current = await getOrderRowById(orderId);

  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Pedido no encontrado");
  }

  if (current.status !== "ready") {
    throw new ApiError(409, "CONFLICT", "Solo podés llamar pedidos listos");
  }

  await db.execute({
    sql: `
      update customer_order set
        pulse_at = datetime('now'),
        updated_at = datetime('now')
      where id = ?
    `,
    args: [orderId],
  });

  return getStaffOrderById(orderId);
}

export async function cancelStaffOrder(orderId: string, reason: string) {
  const db = getDb();
  const current = await getOrderRowById(orderId);

  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Pedido no encontrado");
  }

  if (current.status === "delivered" || current.status === "cancelled") {
    throw new ApiError(409, "CONFLICT", "Este pedido ya está cerrado");
  }

  await db.execute({
    sql: `
      update customer_order set
        status = 'cancelled',
        cancelled_at = datetime('now'),
        cancel_reason = ?,
        updated_at = datetime('now')
      where id = ?
    `,
    args: [reason, orderId],
  });

  return getStaffOrderById(orderId);
}

export async function getStaffOrders() {
  const db = getDb();
  const truckId = await getCurrentTruckId();
  const cooldownSeconds = await getCustomerPickupCooldownSeconds(truckId);
  const pickupVisibleSince = `-${cooldownSeconds} seconds`;

  const [orderResult, modifiersByMenuItemId] = await Promise.all([
    db.execute({
      sql: `
        select
          customer_order.*,
          customer.name as customer_name,
          customer.phone as customer_phone
        from customer_order
        join customer on customer.id = customer_order.customer_id
        where customer_order.truck_id = ?
          and customer_order.payment_status = 'approved'
          and (
            customer_order.status in ('pending', 'preparing')
            or (
              customer_order.status = 'ready'
              and (
                customer_order.picked_up_at is null
                or customer_order.picked_up_at >= datetime('now', ?)
              )
            )
            or (
              customer_order.status = 'delivered'
              and customer_order.delivered_at >= datetime('now', '-10 minutes')
            )
          )
        order by customer_order.created_at asc
      `,
      args: [truckId, pickupVisibleSince],
    }),
    getModifiersByMenuItemId(),
  ]);

  const orderRows = orderResult.rows as unknown as StaffOrderRow[];
  const orderIds = orderRows.map((row) => row.id);

  // Solo los items de los pedidos visibles. Antes esto era un `select *` sin
  // where: leia la tabla entera de items historicos en cada poll del kanban.
  const [itemResult, modRequestsByOrderId] = await Promise.all([
    orderIds.length
      ? db.execute({
          sql: `
            select * from order_item
            where order_id in (${orderIds.map(() => "?").join(", ")})
            order by rowid asc
          `,
          args: orderIds,
        })
      : null,
    getModificationRequestsByOrderId(orderIds),
  ]);

  const itemRows = (itemResult?.rows ?? []) as unknown as OrderItemRow[];

  return orderRows.map((row) => ({
    ...mapOrder(
      row,
      itemRows
        .filter((item) => item.order_id === row.id)
        .map((item) => mapStaffOrderItem(item, modifiersByMenuItemId)),
      modRequestsByOrderId.get(row.id) ?? [],
    ),
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
  }));
}

export async function getStaffOrderById(orderId: string) {
  const db = getDb();
  const rowResult = await db.execute({
    sql: `
      select
        customer_order.*,
        customer.name as customer_name,
        customer.phone as customer_phone
      from customer_order
      join customer on customer.id = customer_order.customer_id
      where customer_order.id = ?
    `,
    args: [orderId],
  });
  const row = rowResult.rows[0] as unknown as StaffOrderRow | undefined;

  if (!row) {
    return null;
  }

  const [itemResult, modRequests, modifiersByMenuItemId] = await Promise.all([
    db.execute({
      sql: "select * from order_item where order_id = ? order by rowid asc",
      args: [orderId],
    }),
    getModificationRequestsForOrder(orderId),
    getModifiersByMenuItemId(),
  ]);

  return {
    ...mapOrder(
      row,
      (itemResult.rows as unknown as OrderItemRow[]).map((item) =>
        mapStaffOrderItem(item, modifiersByMenuItemId),
      ),
      modRequests,
    ),
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
  };
}

async function getModificationRequestRow(
  orderId: string,
  requestId: string,
): Promise<OrderModificationRequestRow | undefined> {
  const result = await getDb().execute({
    sql: `
      select *
      from order_modification_request
      where id = ? and order_id = ?
    `,
    args: [requestId, orderId],
  });
  return result.rows[0] as unknown as OrderModificationRequestRow | undefined;
}

export async function getModificationRequest(orderId: string, requestId: string) {
  const row = await getModificationRequestRow(orderId, requestId);
  return row ? mapModificationRequest(row) : null;
}

export async function createCustomerModificationRequest(input: {
  customerId: string;
  orderId: string;
  items: Array<{
    orderItemId: string;
    modifierLabels: string[];
  }>;
}) {
  const db = getDb();
  const order = await getCustomerOrderById(input.customerId, input.orderId);

  if (!order) {
    throw new ApiError(404, "NOT_FOUND", "No encontramos ese ticket");
  }

  if (order.paymentStatus !== "approved") {
    throw new ApiError(409, "CONFLICT", "El pedido todavia no tiene el pago aprobado");
  }

  const configResult = await db.execute({
    sql: `
      select allow_order_modifications from truck_profile
      where truck_config_id = ?
    `,
    args: [await getPublicTruckId()],
  });
  const config = configResult.rows[0] as unknown as { allow_order_modifications: number } | undefined;

  if (config && !config.allow_order_modifications) {
    throw new ApiError(
      409,
      "CONFLICT",
      "Este restaurante no acepta cambios despues de pedir",
    );
  }

  if (order.status !== "pending") {
    throw new ApiError(
      409,
      "CONFLICT",
      "Solo se puede modificar antes de que cocina empiece a preparar",
    );
  }

  const activeRequest = order.modificationRequests.find((request) =>
    request.status === "pending" || request.status === "extra_payment_pending"
  );

  if (activeRequest) {
    throw new ApiError(409, "CONFLICT", "Ya hay una modificacion en curso");
  }

  const id = randomUUID();

  const modifierResults = await Promise.all(
    input.items.map((entry) => {
      const orderItem = order.items.find((item) => item.id === entry.orderItemId);
      if (!orderItem) {
        throw new ApiError(400, "INVALID_INPUT", "Uno de los items no pertenece al pedido");
      }
      return db.execute({
        sql: "select label from menu_item_modifier where menu_item_id = ? order by position asc",
        args: [orderItem.menuItemId],
      });
    }),
  );

  const requestItems = input.items.map((entry, i) => {
    const orderItem = order.items.find((item) => item.id === entry.orderItemId)!;
    const allowedLabels = (modifierResults[i]!.rows as unknown as MenuModifierRow[]).map(
      (m) => m.label,
    );
    const uniqueLabels = Array.from(new Set(entry.modifierLabels));
    const invalidLabel = uniqueLabels.find((label) => !allowedLabels.includes(label));

    if (invalidLabel) {
      throw new ApiError(
        400,
        "INVALID_INPUT",
        "Solo podes cambiar opciones configuradas para productos ya pagados",
      );
    }

    return {
      orderItemId: orderItem.id,
      itemName: orderItem.nameSnapshot,
      quantity: orderItem.quantity,
      modifierLabels: uniqueLabels,
    };
  });

  const requestText = requestItems
    .map((item) => {
      const labels = item.modifierLabels.length
        ? item.modifierLabels.join(", ")
        : "sin opciones marcadas";
      return `${item.quantity}x ${item.itemName}: ${labels}`;
    })
    .join(" | ");

  await db.execute({
    sql: `
      insert into order_modification_request (
        id, order_id, customer_id, request_text, request_items_json
      )
      values (?, ?, ?, ?, ?)
    `,
    args: [id, input.orderId, input.customerId, requestText, JSON.stringify(requestItems)],
  });

  const request = await getModificationRequest(input.orderId, id);
  if (!request) {
    throw new ApiError(500, "INTERNAL", "No se pudo crear la modificacion");
  }

  return request;
}

export async function approveModificationRequest(input: {
  orderId: string;
  requestId: string;
  staffUserId: string;
}) {
  const current = await getModificationRequestRow(input.orderId, input.requestId);

  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Modificacion no encontrada");
  }

  if (current.status !== "pending") {
    throw new ApiError(409, "CONFLICT", "La modificacion ya fue resuelta");
  }

  await getDb().execute({
    sql: `
      update order_modification_request set
        status = 'approved',
        staff_response = 'Aprobada. Acercate al cajero para coordinar la modificacion.',
        extra_amount_cents = 0,
        resolved_by_staff_user_id = ?,
        resolved_at = datetime('now'),
        updated_at = datetime('now')
      where id = ? and order_id = ?
    `,
    args: [input.staffUserId, input.requestId, input.orderId],
  });

  const request = await getModificationRequest(input.orderId, input.requestId);
  if (!request) {
    throw new ApiError(500, "INTERNAL", "No se pudo aprobar la modificacion");
  }

  return request;
}

export async function rejectModificationRequest(input: {
  orderId: string;
  requestId: string;
  staffUserId: string;
}) {
  const current = await getModificationRequestRow(input.orderId, input.requestId);

  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Modificacion no encontrada");
  }

  if (current.status !== "pending" && current.status !== "extra_payment_pending") {
    throw new ApiError(409, "CONFLICT", "La modificacion ya fue resuelta");
  }

  await getDb().execute({
    sql: `
      update order_modification_request set
        status = 'rejected',
        staff_response = 'Denegada. Acercate al cajero para revisar alternativas.',
        resolved_by_staff_user_id = ?,
        resolved_at = datetime('now'),
        updated_at = datetime('now')
      where id = ? and order_id = ?
    `,
    args: [input.staffUserId, input.requestId, input.orderId],
  });

  return getModificationRequest(input.orderId, input.requestId);
}

export async function attachModificationPaymentPreference(input: {
  requestId: string;
  preferenceId: string;
  checkoutUrl: string | null;
}): Promise<void> {
  await getDb().execute({
    sql: `
      update order_modification_request set
        mp_preference_id = ?,
        mp_checkout_url = ?,
        updated_at = datetime('now')
      where id = ?
    `,
    args: [input.preferenceId, input.checkoutUrl, input.requestId],
  });
}

export async function attachMercadoPagoPreference(
  orderId: string,
  preferenceId: string,
): Promise<void> {
  await getDb().execute({
    sql: `
      update customer_order set
        mp_preference_id = ?,
        updated_at = datetime('now')
      where id = ?
    `,
    args: [preferenceId, orderId],
  });
}

export async function markOrderPaymentFromMercadoPago(input: {
  orderId: string;
  paymentId: string;
  paymentStatus: "approved" | "rejected" | "cancelled" | "pending";
}) {
  const approved = input.paymentStatus === "approved";

  await getDb().execute({
    sql: `
      update customer_order set
        payment_status = ?,
        mp_payment_id = ?,
        paid_at = case when ? = 1 then coalesce(paid_at, datetime('now')) else paid_at end,
        updated_at = datetime('now')
      where id = ?
    `,
    args: [input.paymentStatus, input.paymentId, approved ? 1 : 0, input.orderId],
  });

  return getStaffOrderById(input.orderId);
}

export async function markModificationPaymentFromMercadoPago(input: {
  requestId: string;
  paymentId: string;
  paymentStatus: "approved" | "rejected" | "cancelled" | "pending";
}) {
  const db = getDb();
  const approved = input.paymentStatus === "approved";
  const nextStatus =
    input.paymentStatus === "approved"
      ? "approved"
      : input.paymentStatus === "rejected" || input.paymentStatus === "cancelled"
        ? "extra_payment_rejected"
        : "extra_payment_pending";

  const currentResult = await db.execute({
    sql: "select * from order_modification_request where id = ?",
    args: [input.requestId],
  });
  const current = currentResult.rows[0] as unknown as OrderModificationRequestRow | undefined;

  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Modificacion no encontrada");
  }

  const shouldApplyExtra =
    approved && current.status === "extra_payment_pending" && !current.paid_at;

  await db.execute({
    sql: `
      update order_modification_request set
        status = ?,
        mp_payment_id = ?,
        paid_at = case when ? = 1 then coalesce(paid_at, datetime('now')) else paid_at end,
        updated_at = datetime('now')
      where id = ?
    `,
    args: [nextStatus, input.paymentId, approved ? 1 : 0, input.requestId],
  });

  if (shouldApplyExtra) {
    await db.execute({
      sql: `
        update customer_order set
          subtotal_cents = subtotal_cents + ?,
          total_cents = total_cents + ?,
          updated_at = datetime('now')
        where id = ?
      `,
      args: [current.extra_amount_cents, current.extra_amount_cents, current.order_id],
    });
  }

  return getModificationRequest(current.order_id, input.requestId);
}

export async function insertPaymentWebhookEvent(input: {
  externalEventId: string;
  eventType: string;
  payloadJson: string;
}): Promise<{ id: string; inserted: boolean }> {
  const db = getDb();
  const id = randomUUID();

  try {
    await db.execute({
      sql: `
        insert into payment_webhook_event (
          id, provider, external_event_id, event_type, payload_json
        )
        values (?, 'mercado_pago', ?, ?, ?)
      `,
      args: [id, input.externalEventId, input.eventType, input.payloadJson],
    });

    return { id, inserted: true };
  } catch {
    const existingResult = await db.execute({
      sql: `
        select id
        from payment_webhook_event
        where provider = 'mercado_pago' and external_event_id = ?
      `,
      args: [input.externalEventId],
    });
    const existing = existingResult.rows[0] as unknown as PaymentWebhookEventRow | undefined;

    return { id: existing?.id ?? id, inserted: false };
  }
}

export async function markPaymentWebhookEventProcessed(id: string): Promise<void> {
  await getDb().execute({
    sql: `
      update payment_webhook_event set
        processed_at = datetime('now')
      where id = ?
    `,
    args: [id],
  });
}
