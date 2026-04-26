"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { getContrastColor, normalizeHexColor } from "@/lib/utils/color";
import { fetchJson } from "@/lib/utils/http";

type TruckIdentity = {
  truckName: string;
  brandIcon: string;
  logoUrl: string | null;
  primaryColor: string;
};

export function StaffLoginForm({ nextPath }: { nextPath?: string }) {
  const [email, setEmail] = useState("admin@foodtag.ar");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const identityQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<TruckIdentity>("/api/customer/truck-status"),
  });
  const identity = identityQuery.data;
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

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message ?? "No se pudo iniciar sesión");
      }

      router.push(nextPath ?? "/staff/kanban");
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
            logoUrl={identity?.logoUrl ?? null}
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

          <p className="pt-2 text-center text-xs text-[#606060]">
            Credencial local de desarrollo: admin@foodtag.ar
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
