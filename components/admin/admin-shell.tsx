"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/utils/http";

type TruckIdentity = {
  truckName: string;
  brandIcon: string;
  logoUrl: string | null;
};

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/menu", label: "Gestión de menú", icon: "🍔" },
  { href: "/admin/hours", label: "Horarios", icon: "🕐" },
  { href: "/admin/users", label: "Usuarios y roles", icon: "👥" },
  { href: "/admin/settings", label: "Configuración", icon: "⚙️" },
] as const;

export function AdminShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  const identityQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<TruckIdentity>("/api/customer/truck-status"),
  });
  const identity = identityQuery.data;

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#111] dark:bg-[#111] dark:text-[#f5f5f5]">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[220px] flex-col border-r border-[#e8e8e8] bg-white py-5 transition lg:flex dark:border-white/10 dark:bg-[#1a1a1a]">
        <div className="mb-3 flex items-center gap-2.5 border-b border-[#e8e8e8] px-5 pb-5 dark:border-white/10">
          <BrandMark
            brandIcon={identity?.brandIcon ?? "🚚"}
            logoUrl={identity?.logoUrl ?? null}
          />
          <div>
            <p className="text-base font-black tracking-[-0.3px]">
              {identity?.truckName ?? "FoodTag"}
            </p>
            <p className="mt-px text-[11px] text-[#999]">FoodTag · Admin</p>
          </div>
        </div>

        <nav>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                className={cn(
                  "flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-bold text-[#555] transition hover:bg-[#f5f5f5] hover:text-[#111] dark:text-white/45 dark:hover:bg-white/5 dark:hover:text-white",
                  active &&
                    "border-r-[3px] border-[#f97316] bg-[#fff0e6] text-[#f97316] dark:bg-[rgba(249,115,22,0.20)] dark:text-white",
                )}
                href={item.href}
                key={item.href}
              >
                <span className="w-[22px] text-center text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mx-4 my-3 h-px bg-[#e8e8e8] dark:bg-white/10" />
        <Link
          className="flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-bold text-[#555] transition hover:bg-[#f5f5f5] hover:text-[#111] dark:text-white/45 dark:hover:bg-white/5 dark:hover:text-white"
          href="/staff/kanban"
        >
          <span className="w-[22px] text-center text-base">📋</span>
          Ir al Kanban
        </Link>

        <div className="mt-auto px-4">
          <div className="mb-3 rounded-[10px] border border-[#ef4444]/25 bg-[#ef4444]/10 p-3.5">
            <p className="mb-1.5 text-[11px] font-black text-[#ef4444]">
              Estado del truck
            </p>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-[#22c55e]" />
              <span className="text-xs text-[#555] dark:text-white/60">
                Abierto hasta las 23:00
              </span>
            </div>
            <button className="w-full rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/15 px-2 py-2 text-xs font-black text-[#ef4444]">
              Pausar truck ahora
            </button>
          </div>

          <button
            className="flex w-full items-center justify-between rounded-[10px] border border-[#e8e8e8] bg-[#f2f2f2] px-3.5 py-2.5 dark:border-white/10 dark:bg-[#242424]"
            onClick={() => setDarkMode((value) => !value)}
            type="button"
          >
            <span className="flex items-center gap-2 text-xs font-bold text-[#555] dark:text-[#a0a0a0]">
              <span className="text-[15px]">{darkMode ? "☀️" : "🌙"}</span>
              {darkMode ? "Modo claro" : "Modo oscuro"}
            </span>
            <span className="admin-toggle" data-checked={darkMode}>
              <span className="admin-toggle-thumb" />
            </span>
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:ml-[220px]">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e8e8e8] bg-white px-7 py-4 dark:border-white/10 dark:bg-[#1a1a1a]">
          <div>
            <h1 className="text-xl font-black tracking-[-0.4px]">{title}</h1>
            <p className="mt-0.5 text-xs text-[#999]">{subtitle}</p>
          </div>
          {action ?? (
            <Link
              className="rounded-[10px] bg-[#f97316] px-4 py-2.5 text-[13px] font-black text-white shadow-[0_2px_8px_rgba(249,115,22,0.25)]"
              href="/menu"
            >
              Ver menú público
            </Link>
          )}
        </header>
        <main className="p-7">{children}</main>
      </div>
    </div>
  );
}

function BrandMark({
  brandIcon,
  logoUrl,
}: {
  brandIcon: string;
  logoUrl: string | null;
}) {
  return (
    <div className="flex size-[38px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#f97316] text-xl text-white">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="size-full object-cover" src={logoUrl} />
      ) : (
        brandIcon
      )}
    </div>
  );
}
