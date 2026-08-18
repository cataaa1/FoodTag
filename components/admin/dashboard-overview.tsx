"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import Link from "next/link";

import { useAdminSession } from "@/components/admin/account-panel";
import { AdminShell } from "@/components/admin/admin-shell";
import type {
  DashboardAverageTicketBucket,
  DashboardHourBucket,
  DashboardPreparationBucket,
  DashboardRevenueBucket,
  DashboardToday,
} from "@/lib/data/dashboard";
import { getContrastColor, hexToRgba, normalizeHexColor } from "@/lib/utils/color";
import { formatCurrency } from "@/lib/utils/format";
import { fetchJson } from "@/lib/utils/http";

type PublicTruckStatus = {
  isOpen: boolean;
  paused: boolean;
  reason: string | null;
  todayHoursLabel: string;
  nextOpeningLabel: string | null;
  primaryColor: string;
};

function formatDuration(valueSeconds: number | null) {
  if (valueSeconds === null) {
    return "Sin datos";
  }

  const minutes = Math.floor(valueSeconds / 60);
  const seconds = valueSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function CountChart({ color, series }: { color: string; series: DashboardHourBucket[] }) {
  const max = Math.max(...series.map((entry) => entry.count), 1);

  return (
    <div className="flex h-[156px] items-end gap-2 px-1">
      {series.map((entry) => (
        <div className="flex flex-1 flex-col items-center gap-1.5" key={entry.label}>
          <div className="text-[10px] font-black text-[#777] dark:text-[#b4b4b4]">
            {entry.count}
          </div>
          <div
            className="w-full rounded-t-[10px] transition-[height]"
            style={{
              backgroundColor: color,
              height: `${(entry.count / max) * 100}%`,
              minHeight: 6,
              opacity: entry.count ? 0.35 + 0.65 * (entry.count / max) : 0.12,
            }}
          />
          <span className="text-[10px] font-medium text-[#999]">{entry.label}</span>
        </div>
      ))}
    </div>
  );
}

function RevenueChart({ color, series }: { color: string; series: DashboardRevenueBucket[] }) {
  const max = Math.max(...series.map((entry) => entry.revenueCents), 1);

  return (
    <div className="flex h-[156px] items-end gap-2 px-1">
      {series.map((entry) => (
        <div className="flex flex-1 flex-col items-center gap-1.5" key={entry.serviceDate}>
          <div className="text-[10px] font-black text-[#777] dark:text-[#b4b4b4]">
            {entry.revenueCents ? formatCurrency(entry.revenueCents) : "-"}
          </div>
          <div
            className="w-full rounded-t-[10px] transition-[height]"
            style={{
              background: `linear-gradient(180deg, ${hexToRgba(color, 0.95)} 0%, ${hexToRgba(
                color,
                0.55,
              )} 100%)`,
              height: `${(entry.revenueCents / max) * 100}%`,
              minHeight: 6,
            }}
          />
          <span className="text-[10px] font-medium text-[#999]">{entry.label}</span>
        </div>
      ))}
    </div>
  );
}

function AverageTicketChart({
  color,
  series,
}: {
  color: string;
  series: DashboardAverageTicketBucket[];
}) {
  const max = Math.max(...series.map((entry) => entry.averageTicketCents ?? 0), 1);

  return (
    <div className="flex h-[156px] items-end gap-2 px-1">
      {series.map((entry) => {
        const value = entry.averageTicketCents ?? 0;

        return (
          <div className="flex flex-1 flex-col items-center gap-1.5" key={entry.serviceDate}>
            <div className="text-[10px] font-black text-[#777] dark:text-[#b4b4b4]">
              {entry.averageTicketCents === null ? "-" : formatCurrency(entry.averageTicketCents)}
            </div>
            <div
              className="w-full rounded-t-[10px] transition-[height]"
              style={{
                background: `linear-gradient(180deg, ${hexToRgba(color, 0.9)} 0%, ${hexToRgba(
                  color,
                  0.45,
                )} 100%)`,
                height: `${(value / max) * 100}%`,
                minHeight: 6,
              }}
            />
            <span className="text-[10px] font-medium text-[#999]">{entry.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function PreparationChart({
  color,
  series,
}: {
  color: string;
  series: DashboardPreparationBucket[];
}) {
  const max = Math.max(...series.map((entry) => entry.averagePreparationSeconds ?? 0), 1);

  return (
    <div className="flex h-[156px] items-end gap-2 px-1">
      {series.map((entry) => {
        const value = entry.averagePreparationSeconds ?? 0;

        return (
          <div className="flex flex-1 flex-col items-center gap-1.5" key={entry.serviceDate}>
            <div className="text-[10px] font-black text-[#777] dark:text-[#b4b4b4]">
              {formatDuration(entry.averagePreparationSeconds)}
            </div>
            <div
              className="w-full rounded-t-[10px] transition-[height]"
              style={{
                background: `linear-gradient(180deg, ${hexToRgba(color, 0.9)} 0%, ${hexToRgba(
                  color,
                  0.4,
                )} 100%)`,
                height: `${(value / max) * 100}%`,
                minHeight: 6,
              }}
            />
            <span className="text-[10px] font-medium text-[#999]">{entry.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardOverview() {
  const sessionQuery = useAdminSession();
  const permissions = sessionQuery.data?.permissions ?? [];
  const canViewDashboard = permissions.includes("dashboard.view");
  const canWriteMenu = permissions.includes("menu.write");
  const isPlatformAdmin = Boolean(sessionQuery.data?.isPlatformAdmin);

  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard", "today"],
    queryFn: () => fetchJson<{ dashboard: DashboardToday }>("/api/admin/dashboard/today"),
    // Metricas de venta solo para quien tiene dashboard.view; el resto del staff
    // entra igual al panel pero sin pedir este endpoint (responderia 403).
    enabled: canViewDashboard,
  });
  // Fuente publica del estado del truck: la usa cocina, que no ve el dashboard.
  const publicStatusQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<PublicTruckStatus>("/api/customer/truck-status"),
  });

  const dashboard = dashboardQuery.data?.dashboard;
  const truckStatus = dashboard?.truckStatus ?? publicStatusQuery.data;
  const accentColor = normalizeHexColor(truckStatus?.primaryColor);
  const accentTextColor = getContrastColor(accentColor);

  const truckStatusMetric = {
    label: "Estado del truck",
    value: truckStatus?.paused ? "En pausa" : truckStatus?.isOpen ? "Abierto" : "Cerrado",
    sub: truckStatus?.paused
      ? truckStatus.reason ?? "Pausa manual activa"
      : truckStatus?.isOpen
        ? truckStatus.todayHoursLabel
        : truckStatus?.nextOpeningLabel ?? "Sin proximo horario",
    color: truckStatus?.paused ? "#ef4444" : truckStatus?.isOpen ? "#22c55e" : "#eab308",
    icon: truckStatus?.paused ? "⏸" : truckStatus?.isOpen ? "⏱" : "🌙",
  };

  const salesMetrics = [
    {
      label: "Vendido hoy",
      value: dashboard ? formatCurrency(dashboard.soldTodayCents) : "-",
      sub: dashboard ? `${dashboard.approvedOrders} pagos confirmados` : "Cargando ventas",
      color: accentColor,
      icon: "💰",
    },
    {
      label: "Pedidos del dia",
      value: dashboard ? String(dashboard.totalOrders) : "-",
      sub: dashboard
        ? `${dashboard.activeOrders} activos · ${dashboard.cancelledOrders} cancelados`
        : "Cargando pedidos",
      color: "#22c55e",
      icon: "🧾",
    },
    {
      label: "Ticket promedio",
      value: dashboard
        ? dashboard.averageTicketCents === null
          ? "Sin datos"
          : formatCurrency(dashboard.averageTicketCents)
        : "-",
      sub: dashboard
        ? dashboard.averagePreparationSeconds === null
          ? "Todavia no hay pedidos listos hoy"
          : `${formatDuration(dashboard.averagePreparationSeconds)} promedio hasta listo`
        : "Cargando tiempos",
      color: "#3b82f6",
      icon: "📈",
    },
    {
      label: "Item mas vendido",
      value: dashboard?.bestSellerName ?? "Sin ventas",
      sub:
        dashboard && dashboard.bestSellerQuantity > 0
          ? `${dashboard.bestSellerQuantity} unidades hoy`
          : "Todavia no hay pedidos aprobados",
      color: "#eab308",
      icon: "🏆",
    },
  ];

  const metrics = canViewDashboard
    ? [...salesMetrics, truckStatusMetric]
    : [truckStatusMetric];

  return (
    <AdminShell
      action={
        <button
          className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-bold shadow-[0_2px_8px_rgba(0,0,0,0.14)] transition"
          onClick={() => {
            void publicStatusQuery.refetch();
            if (canViewDashboard) void dashboardQuery.refetch();
          }}
          style={{
            backgroundColor: accentColor,
            boxShadow: `0 2px 8px ${hexToRgba(accentColor, 0.28)}`,
            color: accentTextColor,
          }}
          type="button"
        >
          <RefreshCw
            className={
              dashboardQuery.isFetching || publicStatusQuery.isFetching
                ? "size-3.5 animate-spin"
                : "size-3.5"
            }
          />
          Actualizar
        </button>
      }
      subtitle={
        dashboard
          ? `Resumen operativo actualizado para ${dashboard.serviceDateLabel}`
          : canViewDashboard
            ? "Resumen operativo del dia"
            : "Estado del truck y accesos de tu rol"
      }
      title="Dashboard del dia"
    >
      <div
        className={
          canViewDashboard
            ? "grid gap-3.5 pb-6 md:grid-cols-2 xl:grid-cols-5"
            : "grid gap-3.5 pb-6 md:max-w-sm"
        }
      >
        {metrics.map((metric) => (
          <div
            className="rounded-xl border border-[#e8e8e8] bg-white p-5 transition dark:border-[#2e2e2e] dark:bg-[#1a1a1a]"
            key={metric.label}
            style={{ borderTop: `3px solid ${metric.color}` }}
          >
            <div className="mb-2 text-[22px] font-black" style={{ color: metric.color }}>
              {metric.icon}
            </div>
            <div className="mb-0.5 truncate text-[22px] font-black tracking-[-0.5px] text-[#111] dark:text-[#f5f5f5]">
              {metric.value}
            </div>
            <div className="mb-0.5 text-xs font-semibold text-[#999]">{metric.label}</div>
            <div className="truncate text-[11px] font-semibold" style={{ color: metric.color }}>
              {metric.sub}
            </div>
          </div>
        ))}
      </div>

      <section className="mb-4 rounded-xl border border-[#e8e8e8] bg-white p-5 transition dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
        <div className="mb-4 text-sm font-bold text-[#111] dark:text-[#f5f5f5]">
          Accesos rapidos
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {isPlatformAdmin ? (
            <QuickAction
              color="#a855f7"
              href="/superadmin"
              icon="🚚"
              label="Ver todos los foodtrucks"
            />
          ) : null}
          <QuickAction color="#3b82f6" href="/staff/kanban" icon="📋" label="Ir al Kanban" />
          <QuickAction color="#ef4444" href="/admin/hours" icon="⏸" label="Horarios y pausa" />
          {canWriteMenu ? (
            <QuickAction color={accentColor} href="/admin/menu" icon="🍔" label="Gestionar menu" />
          ) : (
            <QuickAction
              color={accentColor}
              href="/admin/settings"
              icon="⚙️"
              label="Ir a configuracion"
            />
          )}
        </div>
      </section>

      {canViewDashboard ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-[#e8e8e8] bg-white p-5 transition dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
            <div className="mb-1 text-sm font-bold text-[#111] dark:text-[#f5f5f5]">
              Ganancia por dia
            </div>
            <div className="mb-4 text-xs text-[#999]">Ultimos 7 dias hasta hoy</div>
            <RevenueChart
              color={accentColor}
              series={
                dashboard?.weeklyRevenue.length
                  ? dashboard.weeklyRevenue
                  : Array.from({ length: 7 }, (_, index) => ({
                      serviceDate: `empty-revenue-${index}`,
                      label: `D${index + 1}`,
                      revenueCents: 0,
                    }))
              }
            />
          </section>

          <section className="rounded-xl border border-[#e8e8e8] bg-white p-5 transition dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
            <div className="mb-1 text-sm font-bold text-[#111] dark:text-[#f5f5f5]">
              Pedidos por hora
            </div>
            <div className="mb-4 text-xs text-[#999]">Distribucion del dia actual</div>
            <CountChart
              color={accentColor}
              series={
                dashboard?.hourlyOrders.length
                  ? dashboard.hourlyOrders
                  : Array.from({ length: 11 }, (_, index) => ({
                      label: String(12 + index).padStart(2, "0"),
                      count: 0,
                    }))
              }
            />
          </section>

          <section className="rounded-xl border border-[#e8e8e8] bg-white p-5 transition dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
            <div className="mb-1 text-sm font-bold text-[#111] dark:text-[#f5f5f5]">
              Ticket promedio por dia
            </div>
            <div className="mb-4 text-xs text-[#999]">Promedio de valor por ticket en la semana</div>
            <AverageTicketChart
              color="#3b82f6"
              series={
                dashboard?.weeklyAverageTicket.length
                  ? dashboard.weeklyAverageTicket
                  : Array.from({ length: 7 }, (_, index) => ({
                      serviceDate: `empty-ticket-${index}`,
                      label: `D${index + 1}`,
                      averageTicketCents: null,
                    }))
              }
            />
          </section>

          <section className="rounded-xl border border-[#e8e8e8] bg-white p-5 transition dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
            <div className="mb-1 text-sm font-bold text-[#111] dark:text-[#f5f5f5]">
              Tiempo promedio por dia
            </div>
            <div className="mb-4 text-xs text-[#999]">Promedio real hasta que cada ticket queda listo</div>
            <PreparationChart
              color="#14b8a6"
              series={
                dashboard?.weeklyAveragePreparation.length
                  ? dashboard.weeklyAveragePreparation
                  : Array.from({ length: 7 }, (_, index) => ({
                      serviceDate: `empty-preparation-${index}`,
                      label: `D${index + 1}`,
                      averagePreparationSeconds: null,
                    }))
              }
            />
          </section>
        </div>
      ) : null}

      {canViewDashboard && dashboardQuery.isError ? (
        <div className="mt-5">
          <div className="rounded-xl border border-[#ef4444]/25 bg-[#ef4444]/10 p-5">
            <div className="text-sm font-bold text-[#ef4444]">
              No pudimos cargar el dashboard
            </div>
            <div className="mt-1 text-xs text-[#999]">
              Revisa permisos, conexión a Turso y el estado de los pedidos del dia.
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

function QuickAction({
  color,
  href,
  icon,
  label,
}: {
  color: string;
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      className="flex w-full items-center gap-2.5 rounded-[10px] bg-[#f2f2f2] px-3.5 py-3 text-[13px] font-semibold text-[#111] transition hover:bg-[#e8e8e8] dark:bg-[#242424] dark:text-[#f5f5f5] dark:hover:bg-[#2e2e2e]"
      href={href}
    >
      <span className="text-lg" style={{ color }}>
        {icon}
      </span>
      {label}
    </Link>
  );
}
