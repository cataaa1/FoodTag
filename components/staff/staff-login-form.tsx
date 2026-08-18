"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useTruckBranding } from "@/hooks/use-truck-branding";
import { getContrastColor, normalizeHexColor } from "@/lib/utils/color";
import { fetchJson } from "@/lib/utils/http";

type TruckIdentity = {
  truckName: string;
  brandIcon: string;
  primaryColor: string;
  brandingVersion: string;
};

const REMEMBERED_ACCOUNT_KEY = "foodtag-staff-remembered-account";

type RememberedAccount = {
  email: string;
  password: string;
};

function readRememberedAccount(): RememberedAccount | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const raw = localStorage.getItem(REMEMBERED_ACCOUNT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<RememberedAccount> | null;
    if (!parsed?.email) return null;

    return { email: parsed.email, password: parsed.password ?? "" };
  } catch {
    return null;
  }
}

function writeRememberedAccount(account: RememberedAccount | null) {
  if (typeof localStorage === "undefined") return;

  try {
    if (account) {
      localStorage.setItem(REMEMBERED_ACCOUNT_KEY, JSON.stringify(account));
    } else {
      localStorage.removeItem(REMEMBERED_ACCOUNT_KEY);
    }
  } catch {
    // El navegador puede tener el storage bloqueado; no es critico.
  }
}

export function StaffLoginForm({ nextPath }: { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Se lee despues del montaje para no romper la hidratacion con el HTML del server.
  useEffect(() => {
    const saved = readRememberedAccount();
    if (!saved) return;

    setEmail(saved.email);
    setPassword(saved.password);
    setRemember(true);
  }, []);
  const statusQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<TruckIdentity>("/api/customer/truck-status"),
  });
  const brandingQuery = useTruckBranding(statusQuery.data?.brandingVersion);
  const identity = statusQuery.data;
  const accentColor = normalizeHexColor(identity?.primaryColor);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string }; redirectTo?: string | null }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "No se pudo iniciar sesión");
      }

      writeRememberedAccount(remember ? { email, password } : null);

      // El superadmin va a su home de plataforma, no al panel de un truck.
      router.push(payload?.redirectTo ?? nextPath ?? "/staff/kanban");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "No se pudo iniciar sesión",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f0f0f] px-6 py-12 text-[#f5f5f5]">
      <div className="w-full max-w-[380px]">
        <header className="mb-9 text-center">
          <BrandMark
            brandIcon={identity?.brandIcon ?? "🚚"}
            logoUrl={brandingQuery.data?.logoUrl ?? null}
            primaryColor={accentColor}
          />
          <h1 className="text-2xl font-black tracking-[-0.5px]">
            {identity?.truckName ?? "FoodTag"} Staff
          </h1>
          <p className="mt-1 text-[13px] text-[#606060]">Panel de operaciones</p>
        </header>

        <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
          <label>
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.5px] text-[#a0a0a0]">
              Email
            </span>
            <input
              autoComplete="email"
              className="w-full rounded-[10px] border border-[#2e2e2e] bg-[#242424] px-4 py-3.5 text-[15px] font-medium text-[#f5f5f5] outline-none transition focus:ring-2 focus:ring-white/5"
              style={{ borderColor: accentColor }}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.5px] text-[#a0a0a0]">
              Contraseña
            </span>
            <input
              autoComplete="current-password"
              className="w-full rounded-[10px] border border-[#2e2e2e] bg-[#242424] px-4 py-3.5 text-[15px] font-medium text-[#f5f5f5] outline-none transition focus:ring-2 focus:ring-white/5"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              type="password"
              value={password}
            />
          </label>

          <label className="mt-0.5 flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-[#2e2e2e] bg-[#1c1c1c] px-3.5 py-3">
            <input
              checked={remember}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-current"
              onChange={(event) => {
                const next = event.target.checked;
                setRemember(next);
                if (!next) writeRememberedAccount(null);
              }}
              style={{ color: accentColor }}
              type="checkbox"
            />
            <span>
              <span className="block text-[13px] font-bold text-[#f5f5f5]">
                Recordar esta cuenta
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-[#606060]">
                Guarda email y contraseña en este navegador para no reescribirlos.
                Usalo solo en dispositivos propios.
              </span>
            </span>
          </label>

          {error ? (
            <p className="rounded-xl border border-[#ef4444]/25 bg-[#ef4444]/15 px-4 py-3 text-sm font-semibold text-[#ef4444]">
              {error}
            </p>
          ) : null}

          <button
            className="mt-2 rounded-xl px-5 py-3.5 text-[15px] font-black shadow-[0_4px_16px_rgba(0,0,0,0.30)] transition active:scale-[0.98] disabled:opacity-50"
            disabled={loading}
            style={{ backgroundColor: accentColor, color: getContrastColor(accentColor) }}
            type="submit"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <p className="pt-2 text-center text-[11px] leading-4 text-[#606060]">
            Las cuentas las da de alta el super admin desde{" "}
            <span className="font-semibold text-[#8a8a8a]">Admin › Usuarios</span>.
          </p>
        </form>
      </div>
    </main>
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
      className="mx-auto mb-4 flex size-16 items-center justify-center overflow-hidden rounded-[18px] text-3xl shadow-[0_4px_24px_rgba(0,0,0,0.30)]"
      style={{ backgroundColor: primaryColor, color: getContrastColor(primaryColor) }}
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
