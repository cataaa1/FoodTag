"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { PermissionKey } from "@/lib/types/domain";
import {
  ADMIN_PREFERENCES_EVENT,
  readStoredAdminLanguage,
  readStoredDarkMode,
  writeStoredDarkMode,
  type AdminLanguage,
} from "@/lib/utils/admin-preferences";
import { getContrastColor, hexToRgba, normalizeHexColor } from "@/lib/utils/color";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/utils/http";

type TruckShellStatus = {
  isOpen: boolean;
  nextOpeningLabel: string | null;
  paused: boolean;
  reason: string | null;
  todayHoursLabel: string;
  truckName: string;
  brandIcon: string;
  logoUrl: string | null;
  primaryColor: string;
};

type AdminSession = {
  staffUser: {
    id: string;
    email: string;
    fullName: string;
  };
  permissions: PermissionKey[];
};

type NavItem = {
  href: string;
  icon: string;
  label: {
    es: string;
    en: string;
  };
  permissions?: PermissionKey[];
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin",
    icon: "📊",
    label: { es: "Dashboard", en: "Dashboard" },
    permissions: ["dashboard.view"],
  },
  {
    href: "/admin/menu",
    icon: "🍔",
    label: { es: "Gestion de menu", en: "Menu management" },
    permissions: ["menu.read"],
  },
  {
    href: "/admin/hours",
    icon: "🕐",
    label: { es: "Horarios", en: "Hours" },
    permissions: ["hours.write"],
  },
  {
    href: "/admin/users",
    icon: "👥",
    label: { es: "Usuarios y roles", en: "Users and roles" },
    permissions: ["users.manage", "roles.manage"],
  },
  {
    href: "/admin/orders",
    icon: "📋",
    label: { es: "Pedidos", en: "Orders" },
    permissions: ["dashboard.view"],
  },
  {
    href: "/admin/history",
    icon: "🧾",
    label: { es: "Historial", en: "History" },
    permissions: ["users.manage"],
  },
  {
    href: "/admin/settings",
    icon: "⚙️",
    label: { es: "Configuracion", en: "Settings" },
    permissions: ["settings.write"],
  },
];

function canAccessItem(item: NavItem, permissions: PermissionKey[] | null) {
  if (!item.permissions?.length || !permissions) {
    return true;
  }

  return item.permissions.every((permission) => permissions.includes(permission));
}

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
  const [darkMode, setDarkMode] = useState(readStoredDarkMode);
  const [language, setLanguage] = useState<AdminLanguage>(readStoredAdminLanguage);
  const identityQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<TruckShellStatus>("/api/customer/truck-status"),
  });
  const sessionQuery = useQuery({
    queryKey: ["admin", "session"],
    queryFn: () => fetchJson<AdminSession>("/api/admin/session"),
  });

  const identity = identityQuery.data;
  const permissions = sessionQuery.data?.permissions ?? null;
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => canAccessItem(item, permissions)),
    [permissions],
  );

  const text =
    language === "en"
      ? {
          admin: "Admin",
          goToKanban: "Go to Kanban",
          publicMenu: "Public menu",
          darkMode: "Dark mode",
          lightMode: "Light mode",
          paused: "Manual pause",
          openNow: "Open now",
          closed: "Closed",
          noReason: "No reason added",
          todayHours: "Today's hours",
          noSchedule: "No schedule loaded",
          reviewPause: "Review pause",
          manageHours: "Manage hours",
          status: "Truck status",
        }
      : {
          admin: "Admin",
          goToKanban: "Ir al Kanban",
          publicMenu: "Ver menu publico",
          darkMode: "Modo oscuro",
          lightMode: "Modo claro",
          paused: "Pausa manual",
          openNow: "Abierto ahora",
          closed: "Cerrado",
          noReason: "Sin motivo cargado",
          todayHours: "Horario de hoy",
          noSchedule: "Sin horario cargado",
          reviewPause: "Revisar pausa",
          manageHours: "Gestionar horarios",
          status: "Estado del truck",
        };

  const accentColor = normalizeHexColor(identity?.primaryColor);
  const accentTextColor = getContrastColor(accentColor);
  const statusTone = identity?.paused ? "#ef4444" : identity?.isOpen ? "#22c55e" : "#eab308";
  const statusLabel = identity?.paused
    ? text.paused
    : identity?.isOpen
      ? text.openNow
      : text.closed;
  const statusDescription = identity?.paused
    ? identity.reason ?? text.noReason
    : identity?.isOpen
      ? `${text.todayHours}: ${identity.todayHoursLabel}`
      : identity?.nextOpeningLabel ?? identity?.todayHoursLabel ?? text.noSchedule;
  const canOpenKanban = permissions ? permissions.includes("orders.read") : true;

  useEffect(() => {
    document.body.classList.toggle("dark", darkMode);
    document.documentElement.lang = language === "en" ? "en" : "es-AR";

    return () => {
      document.body.classList.remove("dark");
    };
  }, [darkMode, language]);

  useEffect(() => {
    const syncPreferences = () => {
      setDarkMode(readStoredDarkMode());
      setLanguage(readStoredAdminLanguage());
    };

    window.addEventListener(ADMIN_PREFERENCES_EVENT, syncPreferences);

    return () => {
      window.removeEventListener(ADMIN_PREFERENCES_EVENT, syncPreferences);
    };
  }, []);

  return (
    <div
      className="min-h-screen bg-[#fafafa] text-[#111] dark:bg-[#111] dark:text-[#f5f5f5]"
      style={
        {
          "--admin-accent": accentColor,
          "--admin-accent-contrast": accentTextColor,
          "--admin-accent-soft": hexToRgba(accentColor, darkMode ? 0.22 : 0.14),
          "--admin-accent-soft-strong": hexToRgba(accentColor, darkMode ? 0.3 : 0.18),
          "--admin-accent-glow": hexToRgba(accentColor, 0.28),
        } as React.CSSProperties
      }
    >
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[220px] flex-col border-r border-[#e8e8e8] bg-white py-5 transition lg:flex dark:border-white/10 dark:bg-[#1a1a1a]">
        <div className="mb-3 flex items-center gap-2.5 border-b border-[#e8e8e8] px-5 pb-5 dark:border-white/10">
          <BrandMark
            brandIcon={identity?.brandIcon ?? "🚚"}
            logoUrl={identity?.logoUrl ?? null}
            primaryColor={accentColor}
          />
          <div>
            <p className="text-base font-black tracking-[-0.3px]">
              {identity?.truckName ?? "FoodTag"}
            </p>
            <p className="mt-px text-[11px] text-[#999]">FoodTag · {text.admin}</p>
          </div>
        </div>

        <nav>
          {visibleNavItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                className={cn(
                  "flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-bold text-[#555] transition hover:bg-[#f5f5f5] hover:text-[#111] dark:text-white/45 dark:hover:bg-white/5 dark:hover:text-white",
                  active && "border-r-[3px] dark:text-white",
                )}
                href={item.href}
                key={item.href}
                style={
                  active
                    ? {
                        borderRightColor: accentColor,
                        backgroundColor: hexToRgba(accentColor, darkMode ? 0.22 : 0.14),
                        color: accentColor,
                      }
                    : undefined
                }
              >
                <span className="w-[22px] text-center text-base">{item.icon}</span>
                {item.label[language]}
              </Link>
            );
          })}
        </nav>

        <div className="mx-4 my-3 h-px bg-[#e8e8e8] dark:bg-white/10" />

        {canOpenKanban ? (
          <Link
            className="flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-bold text-[#555] transition hover:bg-[#f5f5f5] hover:text-[#111] dark:text-white/45 dark:hover:bg-white/5 dark:hover:text-white"
            href="/staff/kanban"
          >
            <span className="w-[22px] text-center text-base">📋</span>
            {text.goToKanban}
          </Link>
        ) : null}

        <div className="mt-auto px-4">
          <div
            className="mb-3 rounded-[10px] border p-3.5"
            style={{
              backgroundColor: hexToRgba(statusTone, 0.1),
              borderColor: hexToRgba(statusTone, 0.28),
            }}
          >
            <p className="mb-1.5 text-[11px] font-black" style={{ color: statusTone }}>
              {text.status}
            </p>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: statusTone }} />
              <span className="text-xs text-[#555] dark:text-white/60">{statusLabel}</span>
            </div>
            <p className="mb-3 text-[11px] leading-5 text-[#555] dark:text-white/60">
              {statusDescription}
            </p>
            <Link
              className="block w-full rounded-lg border px-2 py-2 text-center text-xs font-black"
              href="/admin/hours"
              style={{
                backgroundColor: hexToRgba(statusTone, 0.12),
                borderColor: hexToRgba(statusTone, 0.32),
                color: statusTone,
              }}
            >
              {identity?.paused ? text.reviewPause : text.manageHours}
            </Link>
          </div>

          <button
            className="flex w-full items-center justify-between rounded-[10px] border border-[#e8e8e8] bg-[#f2f2f2] px-3.5 py-2.5 dark:border-white/10 dark:bg-[#242424]"
            onClick={() => {
              const nextDarkMode = !darkMode;

              setDarkMode(nextDarkMode);
              writeStoredDarkMode(nextDarkMode);
            }}
            type="button"
          >
            <span className="flex items-center gap-2 text-xs font-bold text-[#555] dark:text-[#a0a0a0]">
              <span className="text-[15px]">{darkMode ? "☀️" : "🌙"}</span>
              {darkMode ? text.lightMode : text.darkMode}
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
              className="rounded-[10px] px-4 py-2.5 text-[13px] font-black shadow-[0_2px_8px_rgba(0,0,0,0.14)]"
              href="/menu"
              style={{
                backgroundColor: accentColor,
                color: accentTextColor,
              }}
            >
              {text.publicMenu}
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
  primaryColor,
}: {
  brandIcon: string;
  logoUrl: string | null;
  primaryColor: string;
}) {
  return (
    <div
      className="flex size-[38px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] text-xl shadow-[0_4px_18px_rgba(0,0,0,0.16)]"
      style={{
        backgroundColor: primaryColor,
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
