"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import type { OrderHistoryItem, OrderHistoryResult, OrderHistorySortBy, OrderHistorySortDir } from "@/lib/data/order-history";
import type { OrderStatus } from "@/lib/types/domain";
import { formatCurrency } from "@/lib/utils/format";
import { fetchJson } from "@/lib/utils/http";

const STATUS_LABELS: Record<OrderStatus | "all", string> = {
  all: "Todos",
  pending: "Pendiente",
  preparing: "En preparación",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string }> = {
  pending: { bg: "rgba(251,191,36,0.15)", text: "#b45309" },
  preparing: { bg: "rgba(59,130,246,0.12)", text: "#1d4ed8" },
  ready: { bg: "rgba(34,197,94,0.12)", text: "#15803d" },
  delivered: { bg: "rgba(100,116,139,0.12)", text: "#475569" },
  cancelled: { bg: "rgba(239,68,68,0.12)", text: "#dc2626" },
};

type Filters = {
  fromDate: string;
  toDate: string;
  status: OrderStatus | "all";
  search: string;
  minCents: string;
  maxCents: string;
};

type SortState = {
  sortBy: OrderHistorySortBy;
  sortDir: OrderHistorySortDir;
};

function buildQuery(filters: Filters, page: number, sort: SortState) {
  const params = new URLSearchParams();
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.minCents) params.set("minCents", String(Number(filters.minCents) * 100));
  if (filters.maxCents) params.set("maxCents", String(Number(filters.maxCents) * 100));
  params.set("page", String(page));
  params.set("pageSize", "25");
  params.set("sortBy", sort.sortBy);
  params.set("sortDir", sort.sortDir);
  return params.toString();
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

const EMPTY_FILTERS: Filters = {
  fromDate: "",
  toDate: "",
  status: "all",
  search: "",
  minCents: "",
  maxCents: "",
};

const DEFAULT_SORT: SortState = { sortBy: "date", sortDir: "desc" };

export function OrderHistoryManager() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  function handleSort(col: OrderHistorySortBy) {
    setSort((prev) =>
      prev.sortBy === col
        ? { sortBy: col, sortDir: prev.sortDir === "asc" ? "desc" : "asc" }
        : { sortBy: col, sortDir: "asc" },
    );
    setPage(1);
  }

  const query = useQuery({
    queryKey: ["admin", "orders-history", appliedFilters, page, sort],
    queryFn: () =>
      fetchJson<OrderHistoryResult>(
        `/api/admin/orders/history?${buildQuery(appliedFilters, page, sort)}`,
      ),
  });

  const applyFilters = useCallback(() => {
    setPage(1);
    setAppliedFilters(filters);
  }, [filters]);

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  }

  const result = query.data;
  const orders = result?.orders ?? [];
  const hasActiveFilters = Object.values(appliedFilters).some(
    (v) => v !== "" && v !== "all",
  );

  return (
    <AdminShell subtitle="Pedidos registrados con filtros por fecha, estado y monto" title="Historial de pedidos">
      {/* Filtros */}
      <div className="mb-5 rounded-xl border border-[#e8e8e8] bg-white p-4 dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.6px] text-[#999]">
              Desde
            </span>
            <input
              className="admin-input"
              onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
              type="date"
              value={filters.fromDate}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.6px] text-[#999]">
              Hasta
            </span>
            <input
              className="admin-input"
              onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
              type="date"
              value={filters.toDate}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.6px] text-[#999]">
              Estado
            </span>
            <select
              className="admin-input"
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value as OrderStatus | "all" }))
              }
              value={filters.status}
            >
              {(Object.keys(STATUS_LABELS) as Array<OrderStatus | "all">).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.6px] text-[#999]">
              Cliente o ticket #
            </span>
            <input
              className="admin-input"
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="Nombre, teléfono o número"
              type="search"
              value={filters.search}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.6px] text-[#999]">
              Monto mínimo ($)
            </span>
            <input
              className="admin-input"
              min={0}
              onChange={(e) => setFilters((f) => ({ ...f, minCents: e.target.value }))}
              placeholder="0"
              type="number"
              value={filters.minCents}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.6px] text-[#999]">
              Monto máximo ($)
            </span>
            <input
              className="admin-input"
              min={0}
              onChange={(e) => setFilters((f) => ({ ...f, maxCents: e.target.value }))}
              placeholder="Sin límite"
              type="number"
              value={filters.maxCents}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="admin-primary-button"
            onClick={applyFilters}
            type="button"
          >
            Buscar
          </button>
          {hasActiveFilters ? (
            <button
              className="admin-muted-button"
              onClick={clearFilters}
              type="button"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </div>

      {/* Resultados */}
      {query.isError ? (
        <div className="rounded-xl border border-[#ef4444]/25 bg-[#ef4444]/10 p-5 text-sm font-bold text-[#ef4444]">
          No pudimos cargar el historial. Intentá de nuevo.
        </div>
      ) : null}

      {!query.isError && !query.isLoading && orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d9d9d9] bg-white p-10 text-center dark:border-white/10 dark:bg-[#1a1a1a]">
          <div className="text-3xl">📋</div>
          <div className="mt-3 text-lg font-black text-[#111] dark:text-[#f5f5f5]">
            Sin resultados
          </div>
          <div className="mt-2 text-sm text-[#666] dark:text-white/60">
            {hasActiveFilters
              ? "Probá con otros filtros."
              : "No hay pedidos registrados todavía."}
          </div>
        </div>
      ) : null}

      {orders.length > 0 ? (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-[#666] dark:text-white/60">
              {result?.total ?? 0} pedido{(result?.total ?? 0) !== 1 ? "s" : ""} encontrado
              {(result?.total ?? 0) !== 1 ? "s" : ""}
            </p>
            <button
              className="flex items-center gap-1.5 text-sm font-bold"
              onClick={() => query.refetch()}
              style={{ color: "var(--admin-accent)" }}
              type="button"
            >
              ↻ Actualizar
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#e8e8e8] bg-white dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <Th sortKey="ticket" sort={sort} onSort={handleSort}>Ticket</Th>
                    <Th sortKey="date" sort={sort} onSort={handleSort}>Fecha</Th>
                    <Th sortKey="customer" sort={sort} onSort={handleSort}>Cliente</Th>
                    <Th>Ítems</Th>
                    <Th sortKey="total" sort={sort} onSort={handleSort}>Total</Th>
                    <Th sortKey="status" sort={sort} onSort={handleSort}>Estado</Th>
                    <Th>Cobrado</Th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <OrderRow key={order.id} order={order} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(result?.totalPages ?? 1) > 1 ? (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                className="admin-muted-button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                type="button"
              >
                ← Anterior
              </button>
              <span className="text-sm text-[#666]">
                {page} / {result?.totalPages}
              </span>
              <button
                className="admin-muted-button"
                disabled={page >= (result?.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
                type="button"
              >
                Siguiente →
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </AdminShell>
  );
}

function Th({
  children,
  sortKey,
  sort,
  onSort,
}: {
  children?: React.ReactNode;
  sortKey?: OrderHistorySortBy;
  sort?: SortState;
  onSort?: (col: OrderHistorySortBy) => void;
}) {
  const active = sortKey && sort?.sortBy === sortKey;
  const arrow = active ? (sort!.sortDir === "asc" ? " ↑" : " ↓") : "";

  if (sortKey && onSort) {
    return (
      <th className="bg-[#f2f2f2] px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.8px] dark:bg-[#242424]">
        <button
          className="flex items-center gap-0.5 transition-colors hover:opacity-80"
          onClick={() => onSort(sortKey)}
          style={{ color: active ? "var(--admin-accent)" : "#999" }}
          type="button"
        >
          {children}{arrow}
        </button>
      </th>
    );
  }

  return (
    <th className="bg-[#f2f2f2] px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.8px] text-[#999] dark:bg-[#242424]">
      {children}
    </th>
  );
}

function OrderRow({ order }: { order: OrderHistoryItem }) {
  const colors = STATUS_COLORS[order.status];

  return (
    <tr className="border-t border-[#e8e8e8] hover:bg-[#f9f9f9] dark:border-[#2e2e2e] dark:hover:bg-[#242424]">
      <td className="ticket-font px-4 py-3 font-bold text-[#111] dark:text-[#f5f5f5]">
        #{String(order.ticketNumber).padStart(3, "0")}
      </td>
      <td className="px-4 py-3 text-xs text-[#555] dark:text-[#a0a0a0]">
        <div>{order.serviceDate}</div>
        <div className="mt-0.5 text-[#999]">{formatDate(order.createdAt).split(",")[1]?.trim() ?? ""}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-bold text-[#111] dark:text-[#f5f5f5]">{order.customerName}</div>
        <div className="ticket-font mt-0.5 text-xs text-[#999]">{order.customerPhone}</div>
      </td>
      <td className="max-w-[180px] px-4 py-3">
        <div className="truncate text-xs text-[#555] dark:text-[#a0a0a0]" title={order.itemSummary}>
          {order.itemSummary || "—"}
        </div>
        <div className="mt-0.5 text-[11px] text-[#999]">{order.itemCount} ítem{order.itemCount !== 1 ? "s" : ""}</div>
      </td>
      <td className="px-4 py-3 font-bold text-[#111] dark:text-[#f5f5f5]">
        {formatCurrency(order.totalCents)}
        {order.tipCents > 0 ? (
          <div className="text-[11px] font-normal text-[#999]">
            + {formatCurrency(order.tipCents)} propina
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <span
          className="rounded-md px-2.5 py-1 text-[11px] font-bold"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          {STATUS_LABELS[order.status]}
        </span>
        {order.cancelReason ? (
          <div className="mt-1 max-w-[120px] truncate text-[10px] text-[#999]" title={order.cancelReason}>
            {order.cancelReason}
          </div>
        ) : null}
      </td>
      <td className="px-4 py-3 text-xs text-[#555] dark:text-[#a0a0a0]">
        {order.paymentStatus === "approved" ? (
          <span className="font-bold text-[#15803d]">✓ Aprobado</span>
        ) : order.paymentStatus === "refunded" ? (
          <span className="font-bold text-[#7c3aed]">Reembolsado</span>
        ) : order.paymentStatus === "rejected" ? (
          <span className="font-bold text-[#dc2626]">Rechazado</span>
        ) : order.paymentStatus === "cancelled" ? (
          <span className="text-[#999]">Cancelado</span>
        ) : (
          <span className="text-[#999]">Pendiente</span>
        )}
      </td>
    </tr>
  );
}
