"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  readStoredAdminLanguage,
  readStoredDarkMode,
  writeStoredAdminLanguage,
  writeStoredDarkMode,
  type AdminLanguage,
} from "@/lib/utils/admin-preferences";
import { fetchJson } from "@/lib/utils/http";

export type AdminSession = {
  staffUser: {
    id: string;
    email: string;
    fullName: string;
    isSuperAdmin: boolean;
  };
  role: {
    id: string;
    name: string;
    isSystem: boolean;
  };
  permissions: string[];
};

const REMEMBERED_ACCOUNT_KEY = "foodtag-staff-remembered-account";

const PERMISSION_LABELS: Record<string, string> = {
  "menu.read": "Ver menú",
  "menu.write": "Editar menú",
  "menu.toggle": "Activar/pausar productos",
  "orders.read": "Ver pedidos",
  "orders.advance": "Avanzar pedidos",
  "orders.pulse": "Llamar al cliente",
  "orders.cancel": "Cancelar pedidos",
  "orders.approve_mod": "Resolver modificaciones",
  "hours.write": "Editar horarios",
  "users.manage": "Ver usuarios",
  "users.write": "Editar usuarios",
  "roles.manage": "Gestionar roles",
  "dashboard.view": "Ver dashboard",
  "settings.write": "Editar configuración",
};

export function useAdminSession() {
  return useQuery({
    queryKey: ["admin", "session"],
    queryFn: () => fetchJson<AdminSession>("/api/admin/session"),
  });
}

export function AccountPanel({ onError }: { onError?: (message: string) => void }) {
  const router = useRouter();
  const sessionQuery = useAdminSession();
  const [darkMode, setDarkMode] = useState(readStoredDarkMode);
  const [language, setLanguage] = useState<AdminLanguage>(readStoredAdminLanguage);

  const session = sessionQuery.data;
  const permissions = session?.permissions ?? [];

  const logoutMutation = useMutation({
    mutationFn: async (options: { forgetAccount: boolean }) => {
      await fetch("/api/staff/logout", { method: "POST" });

      if (options.forgetAccount) {
        try {
          localStorage.removeItem(REMEMBERED_ACCOUNT_KEY);
        } catch {
          // storage bloqueado, no es critico
        }
      }
    },
    onSuccess: () => {
      router.push("/staff/login");
      router.refresh();
    },
    onError: () => onError?.("No pudimos cerrar la sesión"),
  });

  function updateDarkMode(value: boolean) {
    setDarkMode(value);
    writeStoredDarkMode(value);
  }

  function updateLanguage(value: AdminLanguage) {
    setLanguage(value);
    writeStoredAdminLanguage(value);
  }

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-[16px] border border-[#e8e8e8] bg-[#fafafa] p-4 dark:border-[#2e2e2e] dark:bg-[#242424]">
        <p className="text-xs font-bold uppercase tracking-[0.8px] text-[#999]">
          Cuenta actual
        </p>
        <p className="mt-2 text-sm font-black text-[#111] dark:text-[#f5f5f5]">
          {session?.staffUser.fullName ?? "Cargando..."}
        </p>
        <p className="mt-1 text-xs text-[#777] dark:text-[#b4b4b4]">
          {session?.staffUser.email ?? "—"}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.5px]"
            style={{
              backgroundColor: "var(--admin-accent)",
              color: "var(--admin-accent-contrast)",
            }}
          >
            {session?.role.name ?? "sin rol"}
          </span>
          {session?.staffUser.isSuperAdmin ? (
            <span className="rounded-full bg-[#111] px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.5px] text-white dark:bg-[#f5f5f5] dark:text-[#111]">
              Super admin
            </span>
          ) : null}
        </div>

        <p className="mt-4 text-xs font-bold uppercase tracking-[0.8px] text-[#999]">
          Permisos ({permissions.length})
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {permissions.length ? (
            permissions.map((permission) => (
              <span
                className="rounded-md border border-[#e0e0e0] bg-white px-2 py-1 text-[11px] font-semibold text-[#555] dark:border-[#3a3a3a] dark:bg-[#1a1a1a] dark:text-[#b4b4b4]"
                key={permission}
                title={permission}
              >
                {PERMISSION_LABELS[permission] ?? permission}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-[#999]">Sin permisos asignados</span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="admin-muted-button"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate({ forgetAccount: false })}
            type="button"
          >
            {logoutMutation.isPending ? "Saliendo..." : "Cerrar sesión"}
          </button>
          <button
            className="admin-primary-button"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate({ forgetAccount: true })}
            type="button"
          >
            Cambiar de cuenta
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-[#999]">
          &quot;Cambiar de cuenta&quot; además olvida la cuenta guardada en este navegador.
        </p>
      </div>

      <div className="space-y-4 rounded-[16px] border border-[#e8e8e8] bg-[#fafafa] p-4 dark:border-[#2e2e2e] dark:bg-[#242424]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.8px] text-[#999]">
            Idioma del admin
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PreferenceButton
              active={language === "es"}
              label="Español"
              onClick={() => updateLanguage("es")}
            />
            <PreferenceButton
              active={language === "en"}
              label="English"
              onClick={() => updateLanguage("en")}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.8px] text-[#999]">
            Modo del admin
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PreferenceButton
              active={!darkMode}
              label={language === "en" ? "Light" : "Claro"}
              onClick={() => updateDarkMode(false)}
            />
            <PreferenceButton
              active={darkMode}
              label={language === "en" ? "Dark" : "Oscuro"}
              onClick={() => updateDarkMode(true)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreferenceButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded-[12px] border px-3 py-2 text-sm font-bold transition"
      onClick={onClick}
      style={
        active
          ? {
              backgroundColor: "var(--admin-accent-soft)",
              borderColor: "var(--admin-accent)",
              color: "var(--admin-accent)",
            }
          : undefined
      }
      type="button"
    >
      {label}
    </button>
  );
}
