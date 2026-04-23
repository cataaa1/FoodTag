"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import Link from "next/link";

import { AdminShell } from "@/components/admin/admin-shell";
import { fetchJson } from "@/lib/utils/http";

type CategoryResponse = {
  categories: Array<{ id: string; visible: boolean }>;
};

type ItemsResponse = {
  items: Array<{ id: string; name: string; available: boolean }>;
};

type HoursResponse = {
  hours: Array<{ weekday: number; closed: boolean }>;
};

type TruckStatus = {
  isOpen: boolean;
  todayHoursLabel: string;
  truckName: string;
  paused: boolean;
  reason: string | null;
};

const HOURLY = [12, 8, 15, 22, 30, 28, 19, 14, 9, 5, 2] as const;
const HOURS = ["12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22"];

function BarChart() {
  const max = Math.max(...HOURLY);

  return (
    <div className="flex h-[120px] items-end gap-1.5 px-1">
      {HOURLY.map((value, index) => (
        <div
          className="flex flex-1 flex-col items-center gap-1"
          key={`${HOURS[index]}-${value}`}
        >
          <div
            className="w-full rounded-t bg-[#f97316] transition-[height]"
            style={{
              height: `${(value / max) * 100}%`,
              minHeight: 4,
              opacity: 0.2 + 0.8 * (value / max),
            }}
          />
          <span className="text-[10px] font-medium text-[#999]">{HOURS[index]}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardOverview() {
  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => fetchJson<CategoryResponse>("/api/admin/categories"),
  });
  const itemsQuery = useQuery({
    queryKey: ["admin", "menu-items"],
    queryFn: () => fetchJson<ItemsResponse>("/api/admin/menu-items"),
  });
  const hoursQuery = useQuery({
    queryKey: ["admin", "hours"],
    queryFn: () => fetchJson<HoursResponse>("/api/admin/hours"),
  });
  const truckStatusQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<TruckStatus>("/api/customer/truck-status"),
  });

  const visibleCategories =
    categoriesQuery.data?.categories.filter((category) => category.visible).length ?? 0;
  const activeItems =
    itemsQuery.data?.items.filter((item) => item.available).length ?? 0;
  const openDays =
    hoursQuery.data?.hours.filter((entry) => !entry.closed).length ?? 0;
  const truckStatus = truckStatusQuery.data;
  const bestSeller = itemsQuery.data?.items.find((item) => item.available)?.name ?? "Classic Smash";

  const metrics = [
    {
      label: "Vendido hoy",
      value: "$0",
      sub: "Checkout real en Fase 4",
      color: "#f97316",
      icon: "💰",
    },
    {
      label: "Pedidos totales",
      value: "0",
      sub: "Ticket mock en Fase 2",
      color: "#22c55e",
      icon: "🧾",
    },
    {
      label: "Ítem más vendido",
      value: bestSeller,
      sub: `${activeItems} items activos`,
      color: "#eab308",
      icon: "🏆",
    },
    {
      label: "Categorías visibles",
      value: String(visibleCategories),
      sub: `${openDays} días con servicio`,
      color: "#3b82f6",
      icon: "📊",
    },
    {
      label: "Estado del truck",
      value: truckStatus?.isOpen ? "Abierto" : "Cerrado",
      sub: truckStatus?.paused ? "Pausa manual activa" : truckStatus?.todayHoursLabel ?? "Sin horario",
      color: truckStatus?.isOpen ? "#22c55e" : "#ef4444",
      icon: truckStatus?.isOpen ? "⏱" : "⏸",
    },
  ];

  return (
    <AdminShell
      action={
        <button
          className="inline-flex items-center gap-2 rounded-[10px] bg-[#f97316] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(249,115,22,0.25)] transition hover:bg-[#ea580c]"
          onClick={() => {
            void categoriesQuery.refetch();
            void itemsQuery.refetch();
            void hoursQuery.refetch();
            void truckStatusQuery.refetch();
          }}
          type="button"
        >
          <RefreshCw className="size-3.5" />
          Actualizar
        </button>
      }
      subtitle="Turno activo desde las 12:00"
      title="Dashboard del día"
    >
      <div className="grid gap-3.5 pb-6 md:grid-cols-2 xl:grid-cols-5">
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

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-[#e8e8e8] bg-white p-5 transition dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
          <div className="mb-1 text-sm font-bold text-[#111] dark:text-[#f5f5f5]">
            Ventas por hora
          </div>
          <div className="mb-4 text-xs text-[#999]">Hoy - pedidos completados</div>
          <BarChart />
        </section>

        <section className="rounded-xl border border-[#e8e8e8] bg-white p-5 transition dark:border-[#2e2e2e] dark:bg-[#1a1a1a]">
          <div className="mb-4 text-sm font-bold text-[#111] dark:text-[#f5f5f5]">
            Accesos rápidos
          </div>
          <div className="space-y-2">
            <QuickAction color="#3b82f6" href="/staff/kanban" icon="📋" label="Ir al Kanban" />
            <QuickAction color="#ef4444" href="/admin/hours" icon="⏸" label="Pausar truck" />
            <QuickAction color="#f97316" href="/admin/menu" icon="🍔" label="Gestionar menú" />
          </div>
        </section>
      </div>

      {categoriesQuery.isError || itemsQuery.isError || hoursQuery.isError ? (
        <div className="mt-5">
          <div className="rounded-xl border border-[#ef4444]/25 bg-[#ef4444]/10 p-5">
            <div className="text-sm font-bold text-[#ef4444]">
              No pudimos leer la configuración
            </div>
            <div className="mt-1 text-xs text-[#999]">
              Revisá la base local SQLite, las migraciones y el seed inicial.
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
