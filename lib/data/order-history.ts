import { getCurrentTruckId } from "@/lib/data/truck-status";
import { getDb } from "@/lib/db/client";
import type { OrderStatus } from "@/lib/types/domain";

export type OrderHistorySortBy = "ticket" | "date" | "customer" | "total" | "status";
export type OrderHistorySortDir = "asc" | "desc";

export type OrderHistoryFilters = {
  fromDate?: string;
  toDate?: string;
  status?: OrderStatus | "all";
  search?: string;
  minCents?: number;
  maxCents?: number;
  page?: number;
  pageSize?: number;
  sortBy?: OrderHistorySortBy;
  sortDir?: OrderHistorySortDir;
};

export type OrderHistoryItem = {
  id: string;
  ticketNumber: number;
  serviceDate: string;
  status: OrderStatus;
  paymentStatus: string;
  customerName: string;
  customerPhone: string;
  subtotalCents: number;
  tipCents: number;
  totalCents: number;
  itemCount: number;
  itemSummary: string;
  cancelReason: string | null;
  paidAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

type HistoryRow = {
  id: string;
  ticket_number: number;
  service_date: string;
  status: OrderStatus;
  payment_status: string;
  customer_name: string;
  customer_phone: string;
  subtotal_cents: number;
  tip_cents: number;
  total_cents: number;
  item_count: number;
  item_summary: string;
  cancel_reason: string | null;
  paid_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
};

export type OrderHistoryResult = {
  orders: OrderHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const SORT_COLUMN_MAP: Record<OrderHistorySortBy, string> = {
  ticket: "co.ticket_number",
  date: "co.created_at",
  customer: "c.name",
  total: "co.total_cents",
  status: "co.status",
};

export async function getOrderHistory(filters: OrderHistoryFilters = {}): Promise<OrderHistoryResult> {
  const db = getDb();
  const {
    fromDate,
    toDate,
    status,
    search,
    minCents,
    maxCents,
    page = 1,
    pageSize = 25,
    sortBy = "date",
    sortDir = "desc",
  } = filters;

  // El filtro por truck va primero y no depende de los filtros del usuario:
  // el historial nunca puede mostrar pedidos de otro foodtruck.
  const conditions: string[] = ["co.truck_id = ?"];
  const args: (string | number)[] = [await getCurrentTruckId()];

  if (fromDate) {
    conditions.push("co.service_date >= ?");
    args.push(fromDate);
  }
  if (toDate) {
    conditions.push("co.service_date <= ?");
    args.push(toDate);
  }
  if (status && status !== "all") {
    conditions.push("co.status = ?");
    args.push(status);
  }
  if (minCents !== undefined) {
    conditions.push("co.total_cents >= ?");
    args.push(minCents);
  }
  if (maxCents !== undefined) {
    conditions.push("co.total_cents <= ?");
    args.push(maxCents);
  }
  if (search?.trim()) {
    conditions.push(
      "(c.name like ? or c.phone like ? or cast(co.ticket_number as text) like ?)",
    );
    const pattern = `%${search.trim()}%`;
    args.push(pattern, pattern, pattern);
  }

  const where = conditions.join(" and ");
  const orderCol = SORT_COLUMN_MAP[sortBy];
  const orderDir = sortDir === "asc" ? "asc" : "desc";
  const offset = (page - 1) * pageSize;

  const [countResult, rowsResult] = await Promise.all([
    db.execute({
      sql: `select count(*) as total
            from customer_order co
            join customer c on c.id = co.customer_id
            where ${where}`,
      args,
    }),
    db.execute({
      sql: `select
               co.id,
               co.ticket_number,
               co.service_date,
               co.status,
               co.payment_status,
               c.name as customer_name,
               c.phone as customer_phone,
               co.subtotal_cents,
               co.tip_cents,
               co.total_cents,
               coalesce(sum(oi.quantity), 0) as item_count,
               coalesce(group_concat(oi.name_snapshot, ', '), '') as item_summary,
               co.cancel_reason,
               co.paid_at,
               co.ready_at,
               co.delivered_at,
               co.cancelled_at,
               co.created_at
             from customer_order co
             join customer c on c.id = co.customer_id
             left join order_item oi on oi.order_id = co.id
             where ${where}
             group by co.id
             order by ${orderCol} ${orderDir}
             limit ? offset ?`,
      args: [...args, pageSize, offset],
    }),
  ]);

  const total = (countResult.rows[0] as unknown as { total: number } | undefined)?.total ?? 0;
  const rows = rowsResult.rows as unknown as HistoryRow[];

  return {
    orders: rows.map((row) => ({
      id: row.id,
      ticketNumber: row.ticket_number,
      serviceDate: row.service_date,
      status: row.status,
      paymentStatus: row.payment_status,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      subtotalCents: row.subtotal_cents,
      tipCents: row.tip_cents,
      totalCents: row.total_cents,
      itemCount: row.item_count,
      itemSummary: row.item_summary,
      cancelReason: row.cancel_reason,
      paidAt: row.paid_at,
      readyAt: row.ready_at,
      deliveredAt: row.delivered_at,
      cancelledAt: row.cancelled_at,
      createdAt: row.created_at,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
