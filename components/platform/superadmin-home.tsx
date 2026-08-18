"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { downloadQr, printQr, useTruckQr } from "@/components/shared/truck-qr";
import { fetchJson } from "@/lib/utils/http";

type Truck = {
  id: string;
  slug: string;
  name: string;
  address: string;
  brandIcon: string;
  primaryColor: string;
  createdAt: string;
  staffCount: number;
  menuItemCount: number;
  ordersToday: number;
};

type NewTruckForm = {
  name: string;
  address: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
};

const EMPTY_FORM: NewTruckForm = {
  name: "",
  address: "",
  adminFullName: "",
  adminEmail: "",
  adminPassword: "",
};

export function SuperadminHome() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewTruckForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [qrTruckId, setQrTruckId] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["platform", "session"],
    queryFn: () =>
      fetchJson<{ admin: { fullName: string; email: string } }>("/api/platform/session"),
  });
  const trucksQuery = useQuery({
    queryKey: ["platform", "trucks"],
    queryFn: () => fetchJson<{ trucks: Truck[] }>("/api/platform/trucks"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      fetchJson<{ truck: { id: string; name: string } }>("/api/platform/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }),
    onSuccess: async (data) => {
      setError(null);
      setNotice(
        `"${data.truck.name}" creado. Su admin ya puede entrar con ${form.adminEmail}.`,
      );
      setForm(EMPTY_FORM);
      setCreating(false);
      await queryClient.invalidateQueries({ queryKey: ["platform", "trucks"] });
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "No pudimos crear el foodtruck",
      ),
  });

  const enterMutation = useMutation({
    mutationFn: (truckId: string) =>
      fetchJson(`/api/platform/trucks/${truckId}/enter`, { method: "POST" }),
    onSuccess: () => {
      router.push("/admin");
      router.refresh();
    },
    onError: () => setError("No pudimos entrar a ese foodtruck"),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/staff/logout", { method: "POST" });
    },
    onSuccess: () => {
      router.push("/staff/login");
      router.refresh();
    },
  });

  const trucks = trucksQuery.data?.trucks ?? [];

  function updateForm<K extends keyof NewTruckForm>(key: K, value: NewTruckForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="min-h-dvh bg-[#0f0f0f] px-6 py-10 text-[#f5f5f5]">
      <div className="mx-auto w-full max-w-[880px]">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[2px] text-[#f97316]">
              Superadmin
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.5px]">Tus foodtrucks</h1>
            <p className="mt-1 text-[13px] text-[#8a8a8a]">
              {sessionQuery.data?.admin.email ?? "Cargando..."}
            </p>
          </div>
          <button
            className="rounded-[10px] border border-[#2e2e2e] px-4 py-2.5 text-[13px] font-bold text-[#b4b4b4] transition hover:text-white"
            disabled={logoutMutation.isPending}
            onClick={() => logoutMutation.mutate()}
            type="button"
          >
            {logoutMutation.isPending ? "Saliendo..." : "Cerrar sesión"}
          </button>
        </header>

        {notice ? (
          <div className="mb-5 rounded-xl border border-[#22c55e]/25 bg-[#22c55e]/10 px-4 py-3 text-[13px] font-semibold text-[#4ade80]">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="mb-5 rounded-xl border border-[#ef4444]/25 bg-[#ef4444]/10 px-4 py-3 text-[13px] font-semibold text-[#ef4444]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3">
          {trucksQuery.isLoading ? (
            <p className="text-[13px] text-[#8a8a8a]">Cargando foodtrucks...</p>
          ) : null}

          {trucks.map((truck) => (
            <article
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] p-5"
              key={truck.id}
            >
              <div
                className="flex size-14 shrink-0 items-center justify-center rounded-[16px] text-2xl"
                style={{ backgroundColor: truck.primaryColor }}
              >
                {truck.brandIcon}
              </div>
              <div className="min-w-[180px] flex-1">
                <h2 className="text-[17px] font-black tracking-[-0.3px]">{truck.name}</h2>
                <p className="mt-0.5 text-[13px] text-[#8a8a8a]">{truck.address}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#606060]">
                  {truck.staffCount} usuarios · {truck.menuItemCount} productos ·{" "}
                  {truck.ordersToday} pedidos hoy
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-[10px] border border-[#2e2e2e] px-4 py-2.5 text-[13px] font-bold text-[#b4b4b4] transition hover:text-white"
                  onClick={() =>
                    setQrTruckId((current) => (current === truck.id ? null : truck.id))
                  }
                  type="button"
                >
                  {qrTruckId === truck.id ? "Ocultar QR" : "Ver QR"}
                </button>
                <button
                  className="rounded-[10px] bg-[#f97316] px-5 py-2.5 text-[13px] font-black text-[#1c1009] transition active:scale-[0.98] disabled:opacity-50"
                  disabled={enterMutation.isPending}
                  onClick={() => enterMutation.mutate(truck.id)}
                  type="button"
                >
                  Entrar
                </button>
              </div>

              {qrTruckId === truck.id ? (
                <div className="w-full border-t border-[#2e2e2e] pt-4">
                  <TruckQrBlock name={truck.name} slug={truck.slug} />
                </div>
              ) : null}
            </article>
          ))}

          {!trucksQuery.isLoading && trucks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#2e2e2e] px-5 py-8 text-center text-[13px] text-[#8a8a8a]">
              Todavía no hay ningún foodtruck. Creá el primero.
            </p>
          ) : null}
        </div>

        {creating ? (
          <form
            className="mt-5 space-y-4 rounded-2xl border border-[#2e2e2e] bg-[#1a1a1a] p-5"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <h2 className="text-[15px] font-black">Nuevo foodtruck</h2>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nombre del foodtruck">
                <input
                  className="platform-input"
                  onChange={(event) => updateForm("name", event.target.value)}
                  placeholder="El Smash del Barrio"
                  required
                  value={form.name}
                />
              </Field>
              <Field label="Dirección">
                <input
                  className="platform-input"
                  onChange={(event) => updateForm("address", event.target.value)}
                  placeholder="Av. Corrientes 1500"
                  required
                  value={form.address}
                />
              </Field>
            </div>

            <div className="rounded-xl border border-[#2e2e2e] bg-[#141414] p-4">
              <p className="mb-3 text-[12px] font-bold uppercase tracking-[1px] text-[#8a8a8a]">
                Cuenta admin del foodtruck
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Nombre">
                  <input
                    className="platform-input"
                    onChange={(event) => updateForm("adminFullName", event.target.value)}
                    placeholder="Ana Perez"
                    required
                    value={form.adminFullName}
                  />
                </Field>
                <Field label="Email">
                  <input
                    className="platform-input"
                    onChange={(event) => updateForm("adminEmail", event.target.value)}
                    placeholder="ana@truck.com"
                    required
                    type="email"
                    value={form.adminEmail}
                  />
                </Field>
                <Field label="Contraseña">
                  <input
                    className="platform-input"
                    minLength={8}
                    onChange={(event) => updateForm("adminPassword", event.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    type="password"
                    value={form.adminPassword}
                  />
                </Field>
              </div>
              <p className="mt-3 text-[11px] leading-4 text-[#606060]">
                Esta cuenta es el admin del foodtruck: desde ahí puede crear cajeros,
                cocineros y el resto de los usuarios que necesite.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                className="rounded-[10px] bg-[#f97316] px-5 py-2.5 text-[13px] font-black text-[#1c1009] disabled:opacity-50"
                disabled={createMutation.isPending}
                type="submit"
              >
                {createMutation.isPending ? "Creando..." : "Crear foodtruck"}
              </button>
              <button
                className="rounded-[10px] border border-[#2e2e2e] px-5 py-2.5 text-[13px] font-bold text-[#b4b4b4]"
                onClick={() => {
                  setCreating(false);
                  setError(null);
                }}
                type="button"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            className="mt-5 w-full rounded-2xl border border-dashed border-[#3a3a3a] px-5 py-4 text-[14px] font-bold text-[#b4b4b4] transition hover:border-[#f97316] hover:text-white"
            onClick={() => {
              setCreating(true);
              setNotice(null);
            }}
            type="button"
          >
            + Crear un foodtruck
          </button>
        )}
      </div>
    </main>
  );
}

function TruckQrBlock({ name, slug }: { name: string; slug: string }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = slug ? `${origin}/t/${slug}` : null;
  const dataUrl = useTruckQr(url, 320);

  if (!slug) {
    return (
      <p className="text-[13px] text-[#8a8a8a]">
        Este foodtruck todavía no tiene identificador. Definilo desde su
        Configuración para poder generar el QR.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="rounded-xl bg-white p-2">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={`QR de ${name}`} className="size-[120px]" src={dataUrl} />
        ) : (
          <div className="size-[120px]" />
        )}
      </div>
      <div className="min-w-[200px] flex-1">
        <p className="break-all font-mono text-[12px] text-[#8a8a8a]">{url}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-[10px] border border-[#2e2e2e] px-3.5 py-2 text-[12px] font-bold text-[#b4b4b4] transition hover:text-white disabled:opacity-40"
            disabled={!dataUrl}
            onClick={() => dataUrl && printQr(dataUrl, name, url ?? "")}
            type="button"
          >
            Imprimir
          </button>
          <button
            className="rounded-[10px] border border-[#2e2e2e] px-3.5 py-2 text-[12px] font-bold text-[#b4b4b4] transition hover:text-white disabled:opacity-40"
            disabled={!dataUrl}
            onClick={() => dataUrl && downloadQr(dataUrl, slug)}
            type="button"
          >
            Descargar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.5px] text-[#8a8a8a]">
        {label}
      </span>
      {children}
    </label>
  );
}
