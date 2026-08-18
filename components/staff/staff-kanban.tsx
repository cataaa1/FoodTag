"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  Columns3,
  Flame,
  LayoutGrid,
  PackageCheck,
  Phone,
  RefreshCw,
  RotateCcw,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type {
  OrderItemStatus,
  OrderModificationRequest,
  OrderStatus,
  PermissionKey,
} from "@/lib/types/domain";
import { useTruckBranding } from "@/hooks/use-truck-branding";
import { getContrastColor, normalizeHexColor } from "@/lib/utils/color";
import { formatCurrency } from "@/lib/utils/format";
import { fetchJson } from "@/lib/utils/http";

type StaffOrderItem = {
  id: string;
  quantity: number;
  nameSnapshot: string;
  variantNameSnapshot: string | null;
  unitPriceCents: number;
  lineTotalCents: number;
  status: OrderItemStatus;
  notes: string | null;
  displayNotes: string | null;
};

type StaffOrder = {
  id: string;
  ticketNumber: number;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  subtotalCents: number;
  tipCents: number;
  totalCents: number;
  pulseAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  pickedUpAt: string | null;
  createdAt: string;
  items: StaffOrderItem[];
  modificationRequests: OrderModificationRequest[];
};

type KitchenColumnStatus = Extract<
  OrderStatus,
  "pending" | "preparing" | "ready"
>;
type KitchenViewMode = "tickets" | "kanban";
type KitchenTicketVariant = "tickets" | "kanban";

type OrdersResponse = {
  orders: StaffOrder[];
  permissions: PermissionKey[];
};

type TruckIdentity = {
  truckName: string;
  brandIcon: string;
  primaryColor: string;
  customerPickupCooldownSeconds: number;
  brandingVersion: string;
};

type AdvanceItemInput = {
  order: StaffOrder;
  item: StaffOrderItem;
};

type ModificationInput = {
  order: StaffOrder;
  request: OrderModificationRequest;
};

type KitchenTicketActions = {
  accentColor: string;
  accentTextColor: string;
  canAdvance: boolean;
  canApproveMod: boolean;
  canCancel: boolean;
  canPulse: boolean;
  isAdvancing: boolean;
  isApprovingModification: boolean;
  isCancelling: boolean;
  isDelivering: boolean;
  isPulsing: boolean;
  isRejectingModification: boolean;
  now: number;
  onAdvanceAll: (order: StaffOrder) => void;
  onAdvanceItem: (order: StaffOrder, item: StaffOrderItem) => void;
  onApproveModification: (
    order: StaffOrder,
    request: OrderModificationRequest,
  ) => void;
  onCancel: (order: StaffOrder, reason: string) => void;
  onDeliver: (order: StaffOrder) => void;
  onPulse: (order: StaffOrder) => void;
  onRejectModification: (
    order: StaffOrder,
    request: OrderModificationRequest,
  ) => void;
};

const EMPTY_ORDERS: StaffOrder[] = [];
const EMPTY_PERMISSIONS: PermissionKey[] = [];
const DEFAULT_PICKUP_HIDE_DELAY_MS = 15_000;

const KITCHEN_COLUMNS: Array<{
  status: KitchenColumnStatus;
  title: string;
  accent: string;
}> = [
  { status: "pending", title: "Pendientes", accent: "#a0a0a0" },
  { status: "preparing", title: "En preparación", accent: "#f97316" },
  { status: "ready", title: "Listos", accent: "#22c55e" },
];

const NEXT_ITEM_ACTION_LABELS: Record<OrderItemStatus, string> = {
  pending: "En preparación",
  preparing: "Listo",
  ready: "Entregado",
  delivered: "Entregado",
};

function getTicketColumnCount(containerWidth: number, orderCount: number) {
  if (containerWidth >= 2100) return Math.min(orderCount, 5);
  if (containerWidth >= 1180) return Math.min(orderCount, 4);
  if (containerWidth >= 860) return Math.min(orderCount, 3);
  if (containerWidth >= 560) return Math.min(orderCount, 2);

  return 1;
}

function useTicketColumnCount(orderCount: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState(() =>
    typeof window === "undefined"
      ? 1
      : getTicketColumnCount(window.innerWidth, Math.max(orderCount, 1)),
  );

  useEffect(() => {
    const container = containerRef.current;
    const updateColumnCount = () => {
      const nextWidth = container?.clientWidth ?? window.innerWidth;
      const nextCount = getTicketColumnCount(nextWidth, Math.max(orderCount, 1));

      setColumnCount(nextCount);
    };

    updateColumnCount();

    if (!container || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateColumnCount);

      return () => window.removeEventListener("resize", updateColumnCount);
    }

    const observer = new ResizeObserver(updateColumnCount);
    observer.observe(container);

    return () => observer.disconnect();
  }, [orderCount]);

  return { columnCount, containerRef };
}

function playModificationAlarm() {
  try {
    const audio = new AudioContext();
    const pattern = [
      { start: 0, frequency: 740 },
      { start: 0.18, frequency: 988 },
      { start: 0.36, frequency: 740 },
      { start: 0.74, frequency: 988 },
      { start: 0.92, frequency: 740 },
    ];

    pattern.forEach((beep) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const startAt = audio.currentTime + beep.start;
      const endAt = startAt + 0.16;

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(beep.frequency, startAt);
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.28, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, endAt);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(startAt);
      oscillator.stop(endAt);
    });

    window.setTimeout(() => void audio.close(), 1500);
  } catch {
    // Browsers can block autoplay until the first user gesture.
  }
}

function parseDate(value: string) {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

function formatElapsedTime(createdAt: string, now: number) {
  const created = parseDate(createdAt).getTime();
  const diffSeconds = Math.max(0, Math.floor((now - created) / 1_000));
  const minutes = Math.floor(diffSeconds / 60);
  const seconds = diffSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function shouldShowKitchenOrder(
  order: StaffOrder,
  now: number,
  pickupHideDelayMs: number,
) {
  if (order.status === "delivered") {
    return false;
  }

  if (!order.pickedUpAt) {
    return true;
  }

  return now - parseDate(order.pickedUpAt).getTime() < pickupHideDelayMs;
}

function hasPermission(permissions: PermissionKey[], permission: PermissionKey) {
  return permissions.includes(permission);
}

function getActiveModification(order: StaffOrder) {
  return order.modificationRequests.find((request) =>
    request.status === "pending" || request.status === "extra_payment_pending"
  );
}

function getBulkAction(order: StaffOrder) {
  if (order.items.some((item) => item.status === "pending")) {
    return { disabled: false, label: "Todo en preparación", tone: "orange" as const };
  }

  if (order.items.some((item) => item.status === "preparing")) {
    return { disabled: false, label: "Todo listo", tone: "green" as const };
  }

  if (order.items.some((item) => item.status === "ready")) {
    return { disabled: false, label: "Todo entregado", tone: "orange" as const };
  }

  return { disabled: true, label: "Pedido entregado", tone: "neutral" as const };
}

export function StaffKanban() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [viewMode, setViewMode] = useState<KitchenViewMode>("tickets");
  const [recentDeliveredOrders, setRecentDeliveredOrders] = useState<StaffOrder[]>([]);
  const seenPendingModificationIds = useRef<Set<string>>(new Set());

  const ordersQuery = useQuery({
    queryKey: ["staff", "orders"],
    queryFn: () => fetchJson<OrdersResponse>("/api/staff/orders"),
    // 10 s alcanza de sobra para una cocina y parte al medio las invocaciones
    // del plan gratuito. Las acciones del staff refrescan al instante igual,
    // porque cada mutacion escribe el resultado en la cache.
    refetchInterval: 10_000,
  });
  const identityQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<TruckIdentity>("/api/customer/truck-status"),
  });
  const brandingQuery = useTruckBranding(identityQuery.data?.brandingVersion);

  const orders = ordersQuery.data?.orders ?? EMPTY_ORDERS;
  const identity = identityQuery.data;
  const permissions = ordersQuery.data?.permissions ?? EMPTY_PERMISSIONS;
  const accentColor = normalizeHexColor(identity?.primaryColor);
  const accentTextColor = getContrastColor(accentColor);
  const canAdvance = hasPermission(permissions, "orders.advance");
  const canPulse = hasPermission(permissions, "orders.pulse");
  const canApproveMod = hasPermission(permissions, "orders.approve_mod");
  const pickupHideDelayMs = Math.max(
    0,
    identity?.customerPickupCooldownSeconds ??
      DEFAULT_PICKUP_HIDE_DELAY_MS / 1_000,
  ) * 1_000;

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (first, second) =>
          parseDate(first.createdAt).getTime() - parseDate(second.createdAt).getTime(),
      ),
    [orders],
  );
  const visibleOrders = useMemo(
    () =>
      sortedOrders.filter((order) =>
        shouldShowKitchenOrder(order, now, pickupHideDelayMs),
      ),
    [now, pickupHideDelayMs, sortedOrders],
  );
  const bumpTarget = useMemo(
    () => visibleOrders.find((order) => order.status !== "delivered") ?? null,
    [visibleOrders],
  );
  const unbumpTarget = useMemo(
    () =>
      recentDeliveredOrders.reduce<StaffOrder | null>((target, order) => {
        if (order.status !== "delivered") return target;
        if (!target) return order;

        const orderDeliveredAt = order.deliveredAt
          ? parseDate(order.deliveredAt).getTime()
          : 0;
        const targetDeliveredAt = target.deliveredAt
          ? parseDate(target.deliveredAt).getTime()
          : 0;

        if (orderDeliveredAt !== targetDeliveredAt) {
          return orderDeliveredAt > targetDeliveredAt ? order : target;
        }

        return order.ticketNumber > target.ticketNumber ? order : target;
      }, null),
    [recentDeliveredOrders],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const deliveredOrders = orders.filter((order) => order.status === "delivered");

    setRecentDeliveredOrders((current) => {
      const nextById = new Map(current.map((order) => [order.id, order]));

      orders.forEach((order) => {
        if (order.status !== "delivered" && nextById.has(order.id)) {
          nextById.delete(order.id);
        }
      });

      deliveredOrders.forEach((order) => {
        nextById.set(order.id, order);
      });

      return [...nextById.values()]
        .sort((first, second) => {
          const firstDeliveredAt = first.deliveredAt
            ? parseDate(first.deliveredAt).getTime()
            : 0;
          const secondDeliveredAt = second.deliveredAt
            ? parseDate(second.deliveredAt).getTime()
            : 0;

          if (firstDeliveredAt !== secondDeliveredAt) {
            return secondDeliveredAt - firstDeliveredAt;
          }

          return second.ticketNumber - first.ticketNumber;
        })
        .slice(0, 12);
    });
  }, [orders]);

  useEffect(() => {
    if (feedback !== "Nueva modificación solicitada") return;

    const timeoutId = window.setTimeout(() => setFeedback(null), 3_500);

    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  useEffect(() => {
    if (!feedback) return;

    const timeoutId = window.setTimeout(() => setFeedback(null), 3_500);

    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  useEffect(() => {
    const pendingIds = orders.flatMap((order) =>
      order.modificationRequests
        .filter((request) => request.status === "pending")
        .map((request) => request.id),
    );
    const newPendingIds = pendingIds.filter(
      (id) => !seenPendingModificationIds.current.has(id),
    );

    if (newPendingIds.length) {
      playModificationAlarm();
      setFeedback("Nueva modificación solicitada");
    }

    seenPendingModificationIds.current = new Set(pendingIds);
  }, [orders]);

  function applyOrderUpdate(updated: StaffOrder | null) {
    if (!updated) return;
    queryClient.setQueryData<OrdersResponse>(["staff", "orders"], (old) =>
      old
        ? { ...old, orders: old.orders.map((o) => (o.id === updated.id ? updated : o)) }
        : old,
    );
    void queryClient.invalidateQueries({ queryKey: ["staff", "orders"] });
  }

  const advanceItemMutation = useMutation({
    mutationFn: ({ order, item }: AdvanceItemInput) =>
      fetchJson<{ order: StaffOrder | null }>(
        `/api/staff/orders/${order.id}/items/${item.id}/advance`,
        { method: "POST" },
      ),
    onSuccess: (data) => {
      setActionError(null);
      applyOrderUpdate(data.order);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "No pudimos avanzar el item");
    },
  });

  const advanceAllMutation = useMutation({
    mutationFn: (order: StaffOrder) =>
      fetchJson<{ order: StaffOrder | null }>(
        `/api/staff/orders/${order.id}/items/advance-all`,
        { method: "POST" },
      ),
    onSuccess: (data) => {
      setActionError(null);
      applyOrderUpdate(data.order);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "No pudimos avanzar el ticket");
    },
  });

  const bumpMutation = useMutation({
    mutationFn: (order: StaffOrder) =>
      fetchJson<{ order: StaffOrder | null }>(
        `/api/staff/orders/${order.id}/bump`,
        { method: "POST" },
      ),
    onSuccess: (data) => {
      setActionError(null);
      if (data.order?.status === "delivered") {
        setRecentDeliveredOrders((current) =>
          [data.order!, ...current.filter((order) => order.id !== data.order!.id)].slice(0, 12),
        );
      }
      applyOrderUpdate(data.order);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "No pudimos bumpear el ticket");
    },
  });

  const unbumpMutation = useMutation({
    mutationFn: (order: StaffOrder) =>
      fetchJson<{ order: StaffOrder | null }>(
        `/api/staff/orders/${order.id}/unbump`,
        { method: "POST" },
      ),
    onSuccess: (data, variables) => {
      setActionError(null);
      setRecentDeliveredOrders((current) =>
        current.filter((order) => order.id !== (data.order?.id ?? variables.id)),
      );
      applyOrderUpdate(data.order);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "No pudimos hacer unbump");
    },
  });

  const pulseMutation = useMutation({
    mutationFn: (order: StaffOrder) =>
      fetchJson<{ order: StaffOrder | null }>(
        `/api/staff/orders/${order.id}/pulse`,
        { method: "POST" },
      ),
    onSuccess: (data) => {
      setActionError(null);
      applyOrderUpdate(data.order);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "No pudimos llamar al cliente");
    },
  });

  const approveModificationMutation = useMutation({
    mutationFn: ({ order, request }: ModificationInput) =>
      fetchJson<{ order: StaffOrder | null }>(
        `/api/staff/orders/${order.id}/modifications/${request.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved: true }),
        },
      ),
    onSuccess: (data) => {
      setActionError(null);
      applyOrderUpdate(data.order);
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "No pudimos aprobar la modificación",
      );
    },
  });

  const rejectModificationMutation = useMutation({
    mutationFn: ({ order, request }: ModificationInput) =>
      fetchJson<{ order: StaffOrder | null }>(
        `/api/staff/orders/${order.id}/modifications/${request.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      ),
    onSuccess: (data) => {
      setActionError(null);
      applyOrderUpdate(data.order);
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : "No pudimos rechazar la modificación",
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ order, reason }: { order: StaffOrder; reason: string }) =>
      fetchJson<{ order: StaffOrder | null }>(
        `/api/staff/orders/${order.id}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      ),
    onSuccess: (data) => {
      setActionError(null);
      applyOrderUpdate(data.order);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "No pudimos cancelar el pedido");
    },
  });

  const ticketActions: KitchenTicketActions = {
    accentColor,
    accentTextColor,
    canAdvance,
    canApproveMod,
    canCancel: hasPermission(permissions, "orders.cancel"),
    canPulse,
    isAdvancing:
      advanceItemMutation.isPending ||
      advanceAllMutation.isPending ||
      bumpMutation.isPending ||
      unbumpMutation.isPending,
    isApprovingModification: approveModificationMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isDelivering: bumpMutation.isPending,
    isPulsing: pulseMutation.isPending,
    isRejectingModification: rejectModificationMutation.isPending,
    now,
    onAdvanceAll: (order) => advanceAllMutation.mutate(order),
    onAdvanceItem: (order, item) => advanceItemMutation.mutate({ order, item }),
    onApproveModification: (order, request) =>
      approveModificationMutation.mutate({ order, request }),
    onCancel: (order, reason) => cancelMutation.mutate({ order, reason }),
    onDeliver: (order) => bumpMutation.mutate(order),
    onPulse: (order) => pulseMutation.mutate(order),
    onRejectModification: (order, request) =>
      rejectModificationMutation.mutate({ order, request }),
  };

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-[#f5f5f5]">
      <header className="sticky top-0 z-20 border-b border-[#2e2e2e] bg-[#1a1a1a] px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark
              brandIcon={identity?.brandIcon ?? "FT"}
              logoUrl={brandingQuery.data?.logoUrl ?? null}
              primaryColor={identity?.primaryColor ?? "#f97316"}
            />
            <div>
              <h1 className="text-base font-black tracking-[-0.3px]">
                {identity?.truckName ?? "FoodTag"}
              </h1>
              <p className="text-[11px] font-bold uppercase tracking-[0.8px] text-[#606060]">
                Vista cocina
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-[#22c55e]/25 bg-[#22c55e]/10 px-3 py-1.5">
              <span className="size-2 rounded-full bg-[#22c55e] shadow-[0_0_0_4px_rgba(34,197,94,0.18)]" />
              <span className="text-xs font-black text-[#22c55e]">En vivo</span>
            </div>
            <button
              className="brand-accent-hover-border flex items-center gap-2 rounded-[10px] border border-[#2e2e2e] bg-[#242424] px-4 py-2 text-[13px] font-bold text-[#a0a0a0] disabled:opacity-50"
              disabled={ordersQuery.isFetching}
              onClick={() => void ordersQuery.refetch()}
              type="button"
            >
              <RefreshCw className={ordersQuery.isFetching ? "size-4 animate-spin" : "size-4"} />
              Actualizar
            </button>
            <Link
              className="brand-accent-hover-border flex items-center gap-2 rounded-[10px] border border-[#2e2e2e] px-4 py-2 text-[13px] font-bold text-[#a0a0a0]"
              href="/admin"
            >
              <Settings className="size-4" />
              Admin
            </Link>
          </div>
        </div>

        {feedback || actionError ? (
          <div
            className={
              actionError
                ? "mt-3 rounded-[10px] border border-[#ef4444]/25 bg-[#ef4444]/10 px-4 py-2 text-sm font-bold text-[#ef4444]"
                : "mt-3 rounded-[10px] border border-[#22c55e]/25 bg-[#22c55e]/10 px-4 py-2 text-sm font-bold text-[#22c55e]"
            }
          >
            {actionError ?? feedback}
          </div>
        ) : null}
      </header>

      <section className="px-4 py-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[1px] text-[#606060]">
              Vista cocina
            </p>
            <h2 className="text-2xl font-black tracking-[-0.7px]">
              {visibleOrders.length} en cocina
            </h2>
          </div>
          <ViewModeTabs
            accentColor={accentColor}
            accentTextColor={accentTextColor}
            onChange={setViewMode}
            value={viewMode}
          />
        </div>

        <GlobalBumpBar
          bumpTarget={bumpTarget}
          canAdvance={canAdvance}
          isBumping={bumpMutation.isPending}
          isUnbumping={unbumpMutation.isPending}
          onBump={(order) => bumpMutation.mutate(order)}
          onUnbump={(order) => unbumpMutation.mutate(order)}
          unbumpTarget={unbumpTarget}
        />

        {ordersQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[2300px]:grid-cols-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                className="min-h-[260px] animate-pulse rounded-[14px] border border-[#2e2e2e] bg-[#1a1a1a]"
                key={index}
              />
            ))}
          </div>
        ) : visibleOrders.length ? (
          viewMode === "tickets" ? (
            <TicketsGrid actions={ticketActions} orders={visibleOrders} />
          ) : (
            <KitchenKanbanBoard actions={ticketActions} orders={visibleOrders} />
          )
        ) : (
          <div className="flex min-h-[56vh] items-center justify-center rounded-[16px] border border-dashed border-[#2e2e2e] bg-[#1a1a1a] p-8 text-center">
            <div>
              <p className="text-lg font-black">Sin tickets activos</p>
              <p className="mt-1 text-sm font-semibold text-[#606060]">
                Los pedidos pagos van a aparecer acá automáticamente.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function GlobalBumpBar({
  bumpTarget,
  canAdvance,
  isBumping,
  isUnbumping,
  onBump,
  onUnbump,
  unbumpTarget,
}: {
  bumpTarget: StaffOrder | null;
  canAdvance: boolean;
  isBumping: boolean;
  isUnbumping: boolean;
  onBump: (order: StaffOrder) => void;
  onUnbump: (order: StaffOrder) => void;
  unbumpTarget: StaffOrder | null;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#2e2e2e] bg-[#151515] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <GlobalTarget label="Primer ticket" order={bumpTarget} tone="green" />
        <GlobalTarget label="Ultimo entregado" order={unbumpTarget} tone="neutral" />
      </div>

      <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[360px]">
        <div className="min-w-0">
          <ActionButton
            disabled={!canAdvance || isBumping}
            icon={<PackageCheck />}
            onClick={() => {
              if (bumpTarget) onBump(bumpTarget);
            }}
            tone="green"
          >
            {isBumping ? "Entregando..." : "Bump"}
          </ActionButton>
        </div>

        <ActionButton
          disabled={!canAdvance || isUnbumping}
          icon={<RotateCcw />}
          onClick={() => {
              if (unbumpTarget) onUnbump(unbumpTarget);
          }}
          tone="neutral"
        >
          {isUnbumping ? "Volviendo..." : "Unbump"}
        </ActionButton>
      </div>
    </div>
  );
}

function GlobalTarget({
  label,
  order,
  tone,
}: {
  label: string;
  order: StaffOrder | null;
  tone: "green" | "neutral";
}) {
  const classes = {
    green: "border-[#22c55e]/25 bg-[#22c55e]/10 text-[#22c55e]",
    neutral: "border-[#2e2e2e] bg-[#242424] text-[#a0a0a0]",
  } satisfies Record<typeof tone, string>;

  return (
    <div className={`rounded-[10px] border px-3 py-2 ${classes[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.7px]">{label}</p>
      <p className="mt-0.5 text-sm font-black text-white">
        {order ? `#${String(order.ticketNumber).padStart(3, "0")}` : "Sin ticket"}
      </p>
    </div>
  );
}

function ViewModeTabs({
  accentColor,
  accentTextColor,
  onChange,
  value,
}: {
  accentColor: string;
  accentTextColor: string;
  onChange: (value: KitchenViewMode) => void;
  value: KitchenViewMode;
}) {
  return (
    <div
      aria-label="Modo de vista de cocina"
      className="flex rounded-[12px] border border-[#2e2e2e] bg-[#161616] p-1"
      role="tablist"
    >
      <ViewModeButton
        active={value === "tickets"}
        accentColor={accentColor}
        accentTextColor={accentTextColor}
        icon={<LayoutGrid />}
        label="Tickets"
        onClick={() => onChange("tickets")}
      />
      <ViewModeButton
        active={value === "kanban"}
        accentColor={accentColor}
        accentTextColor={accentTextColor}
        icon={<Columns3 />}
        label="Kanban"
        onClick={() => onChange("kanban")}
      />
    </div>
  );
}

function ViewModeButton({
  active,
  accentColor,
  accentTextColor,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  accentColor: string;
  accentTextColor: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={
        active
          ? "flex min-h-9 items-center gap-2 rounded-[9px] px-3 py-1.5 text-sm font-black shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
          : "flex min-h-9 items-center gap-2 rounded-[9px] px-3 py-1.5 text-sm font-black text-[#a0a0a0] transition hover:text-white"
      }
      onClick={onClick}
      role="tab"
      style={
        active
          ? {
              backgroundColor: accentColor,
              color: accentTextColor,
            }
          : undefined
      }
      type="button"
    >
      <span className="[&_svg]:size-4">{icon}</span>
      {label}
    </button>
  );
}

function TicketsGrid({
  actions,
  orders,
}: {
  actions: KitchenTicketActions;
  orders: StaffOrder[];
}) {
  const { columnCount, containerRef } = useTicketColumnCount(orders.length);
  const columns = useMemo(() => {
    const nextColumns = Array.from({ length: columnCount }, () => [] as StaffOrder[]);

    orders.forEach((order, index) => {
      nextColumns[index % columnCount]!.push(order);
    });

    return nextColumns;
  }, [columnCount, orders]);

  return (
    <div
      className="grid w-full items-start gap-4"
      ref={containerRef}
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      {columns.map((columnOrders, columnIndex) => (
        <div className="grid gap-4" key={columnIndex}>
          {columnOrders.map((order) => (
            <KitchenTicket actions={actions} key={order.id} order={order} />
          ))}
        </div>
      ))}
    </div>
  );
}

function KitchenKanbanBoard({
  actions,
  orders,
}: {
  actions: KitchenTicketActions;
  orders: StaffOrder[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {KITCHEN_COLUMNS.map((column) => {
        const columnOrders = orders.filter((order) => order.status === column.status);
        const columnAccent =
          column.status === "preparing" ? actions.accentColor : column.accent;

        return (
          <section
            className="min-h-[calc(100vh-200px)] rounded-[14px] border border-[#2e2e2e] bg-[#151515] p-3"
            key={column.status}
          >
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: columnAccent }}
                />
                <h3 className="text-[13px] font-black uppercase tracking-[0.8px] text-[#a0a0a0]">
                  {column.title}
                </h3>
              </div>
              <span className="flex size-7 items-center justify-center rounded-full bg-[#242424] text-xs font-black text-[#a0a0a0]">
                {columnOrders.length}
              </span>
            </div>

            <div className="space-y-3">
              {columnOrders.map((order) => (
                <KitchenTicket
                  actions={actions}
                  key={order.id}
                  order={order}
                  variant="kanban"
                />
              ))}
              {!columnOrders.length ? (
                <div className="rounded-[14px] border border-dashed border-[#2e2e2e] px-4 py-8 text-center text-sm font-semibold text-[#606060]">
                  Sin tickets
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function KitchenTicket({
  actions,
  order,
  variant = "tickets",
}: {
  actions: KitchenTicketActions;
  order: StaffOrder;
  variant?: KitchenTicketVariant;
}) {
  const {
    accentColor,
    accentTextColor,
    canAdvance,
    canApproveMod,
    canCancel,
    canPulse,
    isAdvancing,
    isApprovingModification,
    isCancelling,
    isDelivering,
    isPulsing,
    isRejectingModification,
    now,
  } = actions;
  const activeModification = getActiveModification(order);
  const pendingModification = order.modificationRequests.find(
    (request) => request.status === "pending",
  );
  const bulkAction = getBulkAction(order);
  const disabledByModification = Boolean(activeModification);
  const showBulkAction = order.status === "pending" || order.status === "preparing";
  const completedItems = order.items.filter((item) =>
    item.status === "ready" || item.status === "delivered"
  ).length;
  const ticketNumberClass =
    variant === "kanban"
      ? "ticket-font text-[30px] font-black leading-none tracking-[-0.8px]"
      : "ticket-font text-[34px] font-black leading-none tracking-[-1px]";

  return (
    <article
      className={`flex flex-col self-start overflow-hidden rounded-[14px] border border-[#2e2e2e] bg-[#1a1a1a] shadow-[0_12px_28px_rgba(0,0,0,0.22)] ${
        variant === "tickets" ? "w-full" : ""
      }`}
    >
      <div className="border-b border-[#2e2e2e] px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className={ticketNumberClass}>
              #{String(order.ticketNumber).padStart(3, "0")}
            </h1>
            <p className="mt-1 text-sm font-black text-white">{order.customerName}</p>
          </div>
          <div
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-black"
            style={{
              backgroundColor: `${accentColor}1a`,
              border: `1px solid ${accentColor}40`,
              color: accentColor,
            }}
          >
            <Clock3 className="size-3.5" />
            {formatElapsedTime(order.createdAt, now)}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-[#606060]">
          <span>
            {completedItems}/{order.items.length} listos
          </span>
          <span>{formatCurrency(order.totalCents)}</span>
        </div>
      </div>

      {activeModification ? (
        <ModificationPanel
          canApproveMod={canApproveMod}
          isApprovingModification={isApprovingModification}
          isRejectingModification={isRejectingModification}
          onApproveModification={(request) =>
            actions.onApproveModification(order, request)
          }
          onRejectModification={(request) =>
            actions.onRejectModification(order, request)
          }
          request={activeModification}
        />
      ) : null}

      <div className="divide-y divide-[#2e2e2e]">
        {order.items.map((item) => (
          <KitchenItemRow
            accentColor={accentColor}
            accentTextColor={accentTextColor}
            disabled={!canAdvance || isAdvancing || disabledByModification}
            item={item}
            key={item.id}
            onAdvance={() => actions.onAdvanceItem(order, item)}
          />
        ))}
      </div>

      <div className="grid gap-2 border-t border-[#2e2e2e] p-3.5">
        {showBulkAction ? (
          <ActionButton
            accentColor={accentColor}
            accentTextColor={accentTextColor}
            disabled={
              !canAdvance || isAdvancing || disabledByModification || bulkAction.disabled
            }
            icon={
              bulkAction.tone === "green" ? (
                <CheckCircle2 />
              ) : bulkAction.tone === "neutral" ? (
                <PackageCheck />
              ) : (
                <Flame />
              )
            }
            onClick={() => actions.onAdvanceAll(order)}
            tone={bulkAction.tone}
          >
            {isAdvancing ? "Actualizando..." : bulkAction.label}
          </ActionButton>
        ) : null}

        {order.status === "ready" ? (
          <ActionButton
            disabled={!canAdvance || isAdvancing || disabledByModification}
            icon={<PackageCheck />}
            onClick={() => actions.onDeliver(order)}
            tone="green"
          >
            {isDelivering ? "Entregando..." : "Entregar"}
          </ActionButton>
        ) : null}

        {order.status === "ready" ? (
          <ActionButton
            disabled={!canPulse || isPulsing}
            icon={<Phone />}
            onClick={() => actions.onPulse(order)}
            tone="neutral"
          >
            {isPulsing ? "Llamando..." : "Llamar ticket"}
          </ActionButton>
        ) : null}

        {order.status === "ready" && order.pickedUpAt ? (
          <p className="text-center text-xs font-bold text-[#606060]">
            Retiro confirmado por cliente. Se oculta en unos segundos.
          </p>
        ) : null}

        {order.status === "delivered" ? (
          <p className="text-center text-xs font-bold text-[#606060]">
            {order.pickedUpAt
              ? "Retiro confirmado. Sale de cocina en unos segundos."
              : "Entregado. Esperando confirmación del cliente."}
          </p>
        ) : null}

        {order.status !== "delivered" ? (
          <ActionButton
            disabled={!canCancel || isCancelling}
            icon={<X />}
            onClick={() => {
              const reason = window.prompt("¿Motivo de la cancelación?", "Cancelado por el operador");
              if (reason !== null) {
                actions.onCancel(order, reason || "Cancelado por el operador");
              }
            }}
            tone="red"
          >
            {isCancelling ? "Cancelando..." : "Cancelar pedido"}
          </ActionButton>
        ) : null}

        {pendingModification && disabledByModification ? (
          <p className="text-center text-xs font-bold text-[#eab308]">
            Resolvé la modificación para seguir avanzando.
          </p>
        ) : null}
      </div>
    </article>
  );
}

function KitchenItemRow({
  accentColor,
  accentTextColor,
  disabled,
  item,
  onAdvance,
}: {
  accentColor: string;
  accentTextColor: string;
  disabled: boolean;
  item: StaffOrderItem;
  onAdvance: () => void;
}) {
  const canAdvanceItem = item.status === "pending" || item.status === "preparing";

  return (
    <div className="px-3 py-2">
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-2.5">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-xs font-black"
          style={{
            backgroundColor: `${accentColor}18`,
            color: accentColor,
          }}
        >
          {item.quantity}x
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-black leading-snug text-white">
            {item.nameSnapshot}
          </p>
          {item.variantNameSnapshot ? (
            <p className="mt-0.5 text-[11px] font-bold text-[#eab308]">
              {item.variantNameSnapshot}
            </p>
          ) : null}

          {item.displayNotes ? (
            <p className="mt-2 rounded-[8px] bg-[#eab308]/10 px-2.5 py-1.5 text-[11px] font-bold leading-snug text-[#fef3c7]">
              {item.displayNotes}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 self-center items-center gap-2">
          {canAdvanceItem ? (
            <ActionButton
              accentColor={accentColor}
              accentTextColor={accentTextColor}
              compact
              disabled={disabled}
              icon={item.status === "preparing" ? <CheckCircle2 /> : <Flame />}
              onClick={onAdvance}
              tone={item.status === "preparing" ? "green" : "orange"}
            >
              {NEXT_ITEM_ACTION_LABELS[item.status]}
            </ActionButton>
          ) : null}
          <span className="min-w-[50px] text-right text-[11px] font-bold text-[#606060]">
            {formatCurrency(item.lineTotalCents)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ModificationPanel({
  canApproveMod,
  isApprovingModification,
  isRejectingModification,
  onApproveModification,
  onRejectModification,
  request,
}: {
  canApproveMod: boolean;
  isApprovingModification: boolean;
  isRejectingModification: boolean;
  onApproveModification: (request: OrderModificationRequest) => void;
  onRejectModification: (request: OrderModificationRequest) => void;
  request: OrderModificationRequest;
}) {
  const canResolve = canApproveMod && request.status === "pending";

  return (
    <div className="border-b border-[#eab308]/25 bg-[#3a300f] px-3 py-2.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.6px] text-[#eab308]">
            Modificación solicitada
          </p>
          <p className="mt-0.5 text-xs font-black text-[#fff7d6]">
            {request.status === "extra_payment_pending"
              ? "Esperando pago adicional"
              : "Requiere revisión"}
          </p>
        </div>
        <Badge label="Pausado" tone="yellow" />
      </div>

      <div className="space-y-1.5">
        {request.requestItems.length ? (
          request.requestItems.map((item) => (
            <p
              className="rounded-[8px] bg-black/20 px-2 py-1.5 text-[11px] font-bold text-[#fff7d6]"
              key={item.orderItemId}
            >
              {item.quantity}x {item.itemName}:{" "}
              {item.modifierLabels.length
                ? item.modifierLabels.join(", ")
                : "sin opciones marcadas"}
            </p>
          ))
        ) : (
          <p className="rounded-[8px] bg-black/20 px-2 py-1.5 text-[11px] font-bold text-[#fff7d6]">
            {request.requestText}
          </p>
        )}
      </div>

      {canResolve ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ActionButton
            compact
            disabled={isRejectingModification}
            onClick={() => onRejectModification(request)}
            tone="red"
          >
            Rechazar
          </ActionButton>
          <ActionButton
            compact
            disabled={isApprovingModification}
            onClick={() => onApproveModification(request)}
            tone="green"
          >
            Aprobar
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "yellow" }) {
  return (
    <span
      className="rounded-md px-2 py-0.5 text-[10px] font-black"
      style={{
        background: tone === "yellow" ? "rgba(234,179,8,0.15)" : undefined,
        color: tone === "yellow" ? "#eab308" : undefined,
      }}
    >
      {label}
    </span>
  );
}

function ActionButton({
  accentColor,
  accentTextColor,
  children,
  compact,
  disabled,
  icon,
  onClick,
  tone,
}: {
  accentColor?: string;
  accentTextColor?: string;
  children: ReactNode;
  compact?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onClick: () => void;
  tone: "orange" | "green" | "red" | "neutral";
}) {
  const classes = {
    orange: "shadow-[0_8px_24px_rgba(15,23,42,0.18)]",
    green: "bg-[#22c55e] text-white shadow-[0_8px_24px_rgba(34,197,94,0.18)]",
    red: "border border-[#ef4444]/25 bg-[#ef4444]/10 text-[#ef4444]",
    neutral: "border border-[#2e2e2e] bg-[#242424] text-[#f5f5f5]",
  } satisfies Record<typeof tone, string>;
  const sizeClasses = compact
    ? "min-h-8 w-auto px-2.5 py-1 text-[11px]"
    : "min-h-10 w-full px-3 py-2 text-sm";

  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-[10px] font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${sizeClasses} ${classes[tone]}`}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      style={
        tone === "orange"
          ? {
              backgroundColor: accentColor ?? "#f97316",
              color: accentTextColor ?? "#ffffff",
            }
          : undefined
      }
      type="button"
    >
      {icon ? <span className="[&_svg]:size-4">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

function BrandMark({
  brandIcon,
  logoUrl,
  primaryColor,
}: {
  brandIcon: string;
  logoUrl: string | null;
  primaryColor: string;
}) {
  return (
    <div
      className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] text-sm font-black shadow-[0_4px_16px_rgba(0,0,0,0.18)]"
      style={{
        backgroundColor: normalizeHexColor(primaryColor),
        color: getContrastColor(primaryColor),
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="size-full object-cover" src={logoUrl} />
      ) : (
        brandIcon
      )}
    </div>
  );
}
