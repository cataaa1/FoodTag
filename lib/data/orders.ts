import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { getDb } from "@/lib/db/client";
import { getTruckConfig, getTruckStatus } from "@/lib/data/truck-status";
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

function getModifiersByMenuItemId(db: Database.Database) {
  const rows = db
    .prepare<[], MenuItemModifierRow>(
      `
        select menu_item_id, label, default_checked
        from menu_item_modifier
        order by position asc
      `,
    )
    .all();
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

function getModificationRequestsForOrder(orderId: string) {
  return getDb()
    .prepare<{ orderId: string }, OrderModificationRequestRow>(
      `
        select *
        from order_modification_request
        where order_id = @orderId
        order by created_at asc
      `,
    )
    .all({ orderId })
    .map(mapModificationRequest);
}

function mapOrder(
  row: OrderRow,
  items: OrderItem[],
  modificationRequests: OrderModificationRequest[] = [],
): CustomerOrder {
  return {
    id: row.id,
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
  options: CreateCustomerOrderOptions = {},
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
        if (entry.menuVariantId) {
          variant = db
            .prepare<{ id: string; menuItemId: string }, MenuVariantRow>(
              `
                select id, menu_item_id, name, available, price_cents
                from menu_variant
                where id = @id and menu_item_id = @menuItemId
              `,
            )
            .get({ id: entry.menuVariantId, menuItemId: menuItem.id }) ?? null;
        }

        if (!variant || !variant.available) {
          variant = db
            .prepare<{ menuItemId: string }, MenuVariantRow>(
            `
              select id, menu_item_id, name, available, price_cents
              from menu_variant
              where menu_item_id = @menuItemId and available = 1
              order by position asc
              limit 1
            `,
            )
            .get({ menuItemId: menuItem.id }) ?? null;
        }

        if (!variant) {
          throw new ApiError(409, "OUT_OF_STOCK", "No hay variantes disponibles para este producto");
        }

        unitPriceCents = variant.price_cents;
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
    const paymentStatus = options.paymentStatus ?? "approved";

    db.prepare(
      `
        insert into customer_order (
          id, ticket_number, service_date, customer_id, status, payment_status,
          subtotal_cents, tip_cents, total_cents
        )
        values (
          @id, @ticketNumber, @serviceDate, @customerId, 'pending', @paymentStatus,
          @subtotalCents, @tipCents, @totalCents
        )
      `,
    ).run({
      id: orderId,
      ticketNumber,
      serviceDate,
      customerId,
      paymentStatus,
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

  return mapOrder(
    orderRow,
    itemRows.map(mapOrderItem),
    getModificationRequestsForOrder(orderId),
  );
}

function getOrderRowById(orderId: string) {
  return getDb()
    .prepare<{ id: string }, OrderRow>("select * from customer_order where id = @id")
    .get({ id: orderId });
}

function getCustomerPickupCooldownSeconds(db: Database.Database) {
  const row = db
    .prepare<[], { customer_pickup_cooldown_seconds: number }>(
      "select customer_pickup_cooldown_seconds from truck_config limit 1",
    )
    .get();

  return Math.max(0, row?.customer_pickup_cooldown_seconds ?? 15);
}

function getNextOrderItemStatus(status: OrderItemStatus) {
  const nextStatusByCurrent: Partial<Record<OrderItemStatus, OrderItemStatus>> = {
    pending: "preparing",
    preparing: "ready",
    ready: "delivered",
  };

  return nextStatusByCurrent[status] ?? null;
}

function assertOrderCanMove(current: OrderRow | undefined) {
  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Pedido no encontrado");
  }

  if (current.payment_status !== "approved") {
    throw new ApiError(409, "CONFLICT", "El pago del pedido todavia no esta aprobado");
  }

  const activeModification = getModificationRequestsForOrder(current.id).find((request) =>
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

function syncOrderStatusFromItems(db: Database.Database, orderId: string) {
  const statusCounts = db
    .prepare<
      { orderId: string },
      {
        total_count: number;
        pending_count: number;
        ready_count: number;
        delivered_count: number;
      }
    >(
      `
        select
          count(*) as total_count,
          coalesce(sum(case when status = 'pending' then 1 else 0 end), 0) as pending_count,
          coalesce(sum(case when status = 'ready' then 1 else 0 end), 0) as ready_count,
          coalesce(sum(case when status = 'delivered' then 1 else 0 end), 0) as delivered_count
        from order_item
        where order_id = @orderId
      `,
    )
    .get({ orderId });

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

  db.prepare(
    `
      update customer_order set
        status = @status,
        ready_at = case
          when @status = 'ready' and ready_at is null then datetime('now')
          else ready_at
        end,
        pulse_at = case
          when @status = 'ready' and status <> 'ready' then datetime('now')
          else pulse_at
        end,
        delivered_at = case
          when @status = 'delivered' and delivered_at is null then datetime('now')
          when @status <> 'delivered' then null
          else delivered_at
        end,
        picked_up_at = case
          when @status in ('pending', 'preparing') then null
          else picked_up_at
        end,
        updated_at = datetime('now')
      where id = @id
    `,
  ).run({
    id: orderId,
    status: nextOrderStatus,
  });
}

export function advanceStaffOrderItem(orderId: string, itemId: string) {
  const db = getDb();
  const transaction = db.transaction(() => {
    assertOrderCanMove(getOrderRowById(orderId));

    const item = db
      .prepare<{ orderId: string; itemId: string }, OrderItemRow>(
        `
          select *
          from order_item
          where id = @itemId and order_id = @orderId
        `,
      )
      .get({ orderId, itemId });

    if (!item) {
      throw new ApiError(404, "NOT_FOUND", "Item no encontrado");
    }

    const nextStatus = getNextOrderItemStatus(item.status);

    if (!nextStatus) {
      throw new ApiError(409, "CONFLICT", "Este item ya fue entregado");
    }

    db.prepare(
      `
        update order_item set
          status = @status
        where id = @itemId and order_id = @orderId
      `,
    ).run({
      orderId,
      itemId,
      status: nextStatus,
    });

    syncOrderStatusFromItems(db, orderId);

    return getStaffOrderById(orderId);
  });

  return transaction();
}

export function advanceAllStaffOrderItems(orderId: string) {
  const db = getDb();
  const transaction = db.transaction(() => {
    assertOrderCanMove(getOrderRowById(orderId));

    const itemRows = db
      .prepare<{ orderId: string }, OrderItemRow>(
        "select * from order_item where order_id = @orderId order by rowid asc",
      )
      .all({ orderId });

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

    db.prepare(
      `
        update order_item set
          status = @nextStatus
        where order_id = @orderId and status = @currentStatus
      `,
    ).run({
      orderId,
      currentStatus,
      nextStatus,
    });

    syncOrderStatusFromItems(db, orderId);

    return getStaffOrderById(orderId);
  });

  return transaction();
}

export function advanceStaffOrder(orderId: string) {
  return advanceAllStaffOrderItems(orderId);
}

export function bumpStaffOrder(orderId: string) {
  const db = getDb();
  const transaction = db.transaction(() => {
    assertOrderCanMove(getOrderRowById(orderId));

    db.prepare(
      `
        update order_item set
          status = 'delivered'
        where order_id = @orderId
      `,
    ).run({ orderId });

    syncOrderStatusFromItems(db, orderId);

    return getStaffOrderById(orderId);
  });

  return transaction();
}

export function unbumpStaffOrder(orderId: string) {
  const db = getDb();
  const transaction = db.transaction(() => {
    const current = assertOrderCanMove(getOrderRowById(orderId));

    if (current.status !== "delivered") {
      throw new ApiError(409, "CONFLICT", "Solo podes hacer unbump de pedidos entregados");
    }

    db.prepare(
      `
        update order_item set
          status = 'ready'
        where order_id = @orderId
      `,
    ).run({ orderId });

    syncOrderStatusFromItems(db, orderId);

    return getStaffOrderById(orderId);
  });

  return transaction();
}

export function confirmCustomerOrderPickup(customerId: string, orderId: string) {
  const db = getDb();
  const transaction = db.transaction(() => {
    const current = db
      .prepare<{ id: string; customerId: string }, OrderRow>(
        "select * from customer_order where id = @id and customer_id = @customerId",
      )
      .get({ id: orderId, customerId });

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "No encontramos ese ticket");
    }

    if (current.payment_status !== "approved") {
      throw new ApiError(409, "CONFLICT", "El pago del pedido todavia no esta aprobado");
    }

    if (current.status !== "ready" && current.status !== "delivered") {
      throw new ApiError(409, "CONFLICT", "Todavia no podes confirmar el retiro");
    }

    db.prepare(
      `
        update customer_order set
          picked_up_at = coalesce(picked_up_at, datetime('now')),
          updated_at = datetime('now')
        where id = @orderId
      `,
    ).run({ orderId });

    const order = getCustomerOrderById(customerId, orderId);

    if (!order) {
      throw new ApiError(500, "INTERNAL", "No pudimos confirmar el retiro");
    }

    return order;
  });

  return transaction();
}

export function pulseStaffOrder(orderId: string) {
  const db = getDb();
  const current = getOrderRowById(orderId);

  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Pedido no encontrado");
  }

  if (current.status !== "ready") {
    throw new ApiError(409, "CONFLICT", "Solo podés llamar pedidos listos");
  }

  db.prepare(
    `
      update customer_order set
        pulse_at = datetime('now'),
        updated_at = datetime('now')
      where id = @id
    `,
  ).run({ id: orderId });

  return getStaffOrderById(orderId);
}

export function cancelStaffOrder(orderId: string, reason: string) {
  const db = getDb();
  const current = getOrderRowById(orderId);

  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Pedido no encontrado");
  }

  if (current.status === "delivered" || current.status === "cancelled") {
    throw new ApiError(409, "CONFLICT", "Este pedido ya está cerrado");
  }

  db.prepare(
    `
      update customer_order set
        status = 'cancelled',
        cancelled_at = datetime('now'),
        cancel_reason = @reason,
        updated_at = datetime('now')
      where id = @id
    `,
  ).run({ id: orderId, reason });

  return getStaffOrderById(orderId);
}

export function getStaffOrders() {
  const db = getDb();
  const cooldownSeconds = getCustomerPickupCooldownSeconds(db);
  const pickupVisibleSince = `-${cooldownSeconds} seconds`;
  const orderRows = db
    .prepare<{ pickupVisibleSince: string }, StaffOrderRow>(
      `
        select
          customer_order.*,
          customer.name as customer_name,
          customer.phone as customer_phone
        from customer_order
        join customer on customer.id = customer_order.customer_id
        where customer_order.payment_status = 'approved'
          and (
            customer_order.status in ('pending', 'preparing')
            or (
              customer_order.status = 'ready'
              and (
                customer_order.picked_up_at is null
                or customer_order.picked_up_at >= datetime('now', @pickupVisibleSince)
              )
            )
            or (
              customer_order.status = 'delivered'
              and customer_order.delivered_at >= datetime('now', '-10 minutes')
            )
          )
        order by customer_order.created_at asc
      `,
    )
    .all({ pickupVisibleSince });
  const itemRows = db
    .prepare<[], OrderItemRow>(
      "select * from order_item order by rowid asc",
    )
    .all();
  const modifiersByMenuItemId = getModifiersByMenuItemId(db);

  return orderRows.map((row) => ({
    ...mapOrder(
      row,
      itemRows
        .filter((item) => item.order_id === row.id)
        .map((item) => mapStaffOrderItem(item, modifiersByMenuItemId)),
      getModificationRequestsForOrder(row.id),
    ),
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
  }));
}

export function getStaffOrderById(orderId: string) {
  const db = getDb();
  const row = db
    .prepare<{ id: string }, StaffOrderRow>(
      `
        select
          customer_order.*,
          customer.name as customer_name,
          customer.phone as customer_phone
        from customer_order
        join customer on customer.id = customer_order.customer_id
        where customer_order.id = @id
      `,
    )
    .get({ id: orderId });

  if (!row) {
    return null;
  }

  const itemRows = db
    .prepare<{ orderId: string }, OrderItemRow>(
      "select * from order_item where order_id = @orderId order by rowid asc",
    )
    .all({ orderId });
  const modifiersByMenuItemId = getModifiersByMenuItemId(db);

  return {
    ...mapOrder(
      row,
      itemRows.map((item) => mapStaffOrderItem(item, modifiersByMenuItemId)),
      getModificationRequestsForOrder(orderId),
    ),
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
  };
}

function getModificationRequestRow(orderId: string, requestId: string) {
  return getDb()
    .prepare<{ orderId: string; requestId: string }, OrderModificationRequestRow>(
      `
        select *
        from order_modification_request
        where id = @requestId and order_id = @orderId
      `,
    )
    .get({ orderId, requestId });
}

export function getModificationRequest(orderId: string, requestId: string) {
  const row = getModificationRequestRow(orderId, requestId);
  return row ? mapModificationRequest(row) : null;
}

export function createCustomerModificationRequest(input: {
  customerId: string;
  orderId: string;
  items: Array<{
    orderItemId: string;
    modifierLabels: string[];
  }>;
}) {
  const db = getDb();
  const order = getCustomerOrderById(input.customerId, input.orderId);

  if (!order) {
    throw new ApiError(404, "NOT_FOUND", "No encontramos ese ticket");
  }

  if (order.paymentStatus !== "approved") {
    throw new ApiError(409, "CONFLICT", "El pedido todavia no tiene el pago aprobado");
  }

  const config = getDb()
    .prepare<[], { allow_order_modifications: number }>(
      "select allow_order_modifications from truck_profile limit 1",
    )
    .get();

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

  const requestItems = input.items.map((entry) => {
    const orderItem = order.items.find((item) => item.id === entry.orderItemId);

    if (!orderItem) {
      throw new ApiError(400, "INVALID_INPUT", "Uno de los items no pertenece al pedido");
    }

    const allowedLabels = db
      .prepare<{ menuItemId: string }, MenuModifierRow>(
        `
          select label
          from menu_item_modifier
          where menu_item_id = @menuItemId
          order by position asc
        `,
      )
      .all({ menuItemId: orderItem.menuItemId })
      .map((modifier) => modifier.label);
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

  db.prepare(
    `
      insert into order_modification_request (
        id, order_id, customer_id, request_text, request_items_json
      )
      values (@id, @orderId, @customerId, @requestText, @requestItemsJson)
    `,
  ).run({
    id,
    orderId: input.orderId,
    customerId: input.customerId,
    requestText,
    requestItemsJson: JSON.stringify(requestItems),
  });

  const request = getModificationRequest(input.orderId, id);

  if (!request) {
    throw new ApiError(500, "INTERNAL", "No se pudo crear la modificacion");
  }

  return request;
}

export function approveModificationRequest(input: {
  orderId: string;
  requestId: string;
  staffUserId: string;
}) {
  const current = getModificationRequestRow(input.orderId, input.requestId);

  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Modificacion no encontrada");
  }

  if (current.status !== "pending") {
    throw new ApiError(409, "CONFLICT", "La modificacion ya fue resuelta");
  }

  getDb()
    .prepare(
      `
        update order_modification_request set
          status = 'approved',
          staff_response = 'Aprobada. Acercate al cajero para coordinar la modificacion.',
          extra_amount_cents = 0,
          resolved_by_staff_user_id = @staffUserId,
          resolved_at = datetime('now'),
          updated_at = datetime('now')
        where id = @requestId and order_id = @orderId
      `,
    )
    .run({
      orderId: input.orderId,
      requestId: input.requestId,
      staffUserId: input.staffUserId,
    });

  const request = getModificationRequest(input.orderId, input.requestId);

  if (!request) {
    throw new ApiError(500, "INTERNAL", "No se pudo aprobar la modificacion");
  }

  return request;
}

export function rejectModificationRequest(input: {
  orderId: string;
  requestId: string;
  staffUserId: string;
}) {
  const current = getModificationRequestRow(input.orderId, input.requestId);

  if (!current) {
    throw new ApiError(404, "NOT_FOUND", "Modificacion no encontrada");
  }

  if (current.status !== "pending" && current.status !== "extra_payment_pending") {
    throw new ApiError(409, "CONFLICT", "La modificacion ya fue resuelta");
  }

  getDb()
    .prepare(
      `
        update order_modification_request set
          status = 'rejected',
          staff_response = 'Denegada. Acercate al cajero para revisar alternativas.',
          resolved_by_staff_user_id = @staffUserId,
          resolved_at = datetime('now'),
          updated_at = datetime('now')
        where id = @requestId and order_id = @orderId
      `,
    )
    .run({
      orderId: input.orderId,
      requestId: input.requestId,
      staffUserId: input.staffUserId,
    });

  return getModificationRequest(input.orderId, input.requestId);
}

export function attachModificationPaymentPreference(input: {
  requestId: string;
  preferenceId: string;
  checkoutUrl: string | null;
}) {
  getDb()
    .prepare(
      `
        update order_modification_request set
          mp_preference_id = @preferenceId,
          mp_checkout_url = @checkoutUrl,
          updated_at = datetime('now')
        where id = @requestId
      `,
    )
    .run(input);
}

export function attachMercadoPagoPreference(orderId: string, preferenceId: string) {
  getDb()
    .prepare(
      `
        update customer_order set
          mp_preference_id = @preferenceId,
          updated_at = datetime('now')
        where id = @orderId
      `,
    )
    .run({ orderId, preferenceId });
}

export function markOrderPaymentFromMercadoPago(input: {
  orderId: string;
  paymentId: string;
  paymentStatus: "approved" | "rejected" | "cancelled" | "pending";
}) {
  const approved = input.paymentStatus === "approved";

  getDb()
    .prepare(
      `
        update customer_order set
          payment_status = @paymentStatus,
          mp_payment_id = @paymentId,
          paid_at = case when @approved = 1 then coalesce(paid_at, datetime('now')) else paid_at end,
          updated_at = datetime('now')
        where id = @orderId
      `,
    )
    .run({
      orderId: input.orderId,
      paymentId: input.paymentId,
      paymentStatus: input.paymentStatus,
      approved: approved ? 1 : 0,
    });

  return getStaffOrderById(input.orderId);
}

export function markModificationPaymentFromMercadoPago(input: {
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

  const transaction = db.transaction(() => {
    const current = db
      .prepare<{ requestId: string }, OrderModificationRequestRow>(
        "select * from order_modification_request where id = @requestId",
      )
      .get({ requestId: input.requestId });

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Modificacion no encontrada");
    }

    const shouldApplyExtra =
      approved && current.status === "extra_payment_pending" && !current.paid_at;

    db.prepare(
      `
        update order_modification_request set
          status = @status,
          mp_payment_id = @paymentId,
          paid_at = case when @approved = 1 then coalesce(paid_at, datetime('now')) else paid_at end,
          updated_at = datetime('now')
        where id = @requestId
      `,
    ).run({
      requestId: input.requestId,
      paymentId: input.paymentId,
      status: nextStatus,
      approved: approved ? 1 : 0,
    });

    if (shouldApplyExtra) {
      db.prepare(
        `
          update customer_order set
            subtotal_cents = subtotal_cents + @extraAmountCents,
            total_cents = total_cents + @extraAmountCents,
            updated_at = datetime('now')
          where id = @orderId
        `,
      ).run({
        orderId: current.order_id,
        extraAmountCents: current.extra_amount_cents,
      });
    }

    return getModificationRequest(current.order_id, input.requestId);
  });

  return transaction();
}

export function insertPaymentWebhookEvent(input: {
  externalEventId: string;
  eventType: string;
  payloadJson: string;
}) {
  const db = getDb();
  const id = randomUUID();

  try {
    db.prepare(
      `
        insert into payment_webhook_event (
          id, provider, external_event_id, event_type, payload_json
        )
        values (@id, 'mercado_pago', @externalEventId, @eventType, @payloadJson)
      `,
    ).run({
      id,
      externalEventId: input.externalEventId,
      eventType: input.eventType,
      payloadJson: input.payloadJson,
    });

    return { id, inserted: true };
  } catch {
    const existing = db
      .prepare<{ externalEventId: string }, PaymentWebhookEventRow>(
        `
          select id
          from payment_webhook_event
          where provider = 'mercado_pago' and external_event_id = @externalEventId
        `,
      )
      .get({ externalEventId: input.externalEventId });

    return { id: existing?.id ?? id, inserted: false };
  }
}

export function markPaymentWebhookEventProcessed(id: string) {
  getDb()
    .prepare(
      `
        update payment_webhook_event set
          processed_at = datetime('now')
        where id = @id
      `,
    )
    .run({ id });
}
