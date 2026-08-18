"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { PhoneShell } from "@/components/customer/phone-shell";
import { getContrastColor, normalizeHexColor } from "@/lib/utils/color";
import { fetchJson } from "@/lib/utils/http";

type PublicTruck = {
  slug: string;
  name: string;
  address: string;
  publicTagline: string;
  brandIcon: string;
  primaryColor: string;
  isOpen: boolean;
  todayHoursLabel: string;
  nextOpeningLabel: string | null;
  paused: boolean;
};

/**
 * Se muestra al entrar a /menu sin haber escaneado ningun QR, cuando hay mas de
 * un foodtruck. Elegir uno lleva a /t/<slug>, que es exactamente lo mismo que
 * hace el QR: deja el truck fijado y entra a su menu.
 *
 * Por ahora lista todos los asociados. Filtrar por cercania queda para cuando
 * los trucks puedan declarar donde estan parados hoy.
 */
export function TruckPickerScreen() {
  const trucksQuery = useQuery({
    queryKey: ["public-trucks"],
    queryFn: () => fetchJson<{ trucks: PublicTruck[] }>("/api/customer/trucks"),
  });

  const trucks = trucksQuery.data?.trucks ?? [];
  const abiertos = trucks.filter((truck) => truck.isOpen);
  const cerrados = trucks.filter((truck) => !truck.isOpen);

  return (
    <PhoneShell>
      <header className="shrink-0 px-6 pb-4 pt-8">
        <h1 className="text-[24px] font-black tracking-[-0.5px] text-[#1c1009]">
          ¿Dónde querés comer?
        </h1>
        <p className="mt-1 text-[13px] leading-[1.5] text-[#6b4e35]">
          Elegí un foodtruck para ver su menú. Si estás parado frente a uno,
          escaneá su QR y entrás directo.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-10 [scrollbar-width:none]">
        {trucksQuery.isLoading ? (
          <p className="py-10 text-center text-[13px] text-[#9a7560]">Cargando...</p>
        ) : null}

        {!trucksQuery.isLoading && trucks.length === 0 ? (
          <p className="py-10 text-center text-[13px] leading-[1.5] text-[#9a7560]">
            Todavía no hay foodtrucks disponibles.
          </p>
        ) : null}

        {abiertos.length ? (
          <>
            <SectionLabel>Abiertos ahora</SectionLabel>
            <div className="mb-6 grid gap-2.5">
              {abiertos.map((truck) => (
                <TruckCard key={truck.slug} truck={truck} />
              ))}
            </div>
          </>
        ) : null}

        {cerrados.length ? (
          <>
            <SectionLabel>Cerrados</SectionLabel>
            <div className="grid gap-2.5">
              {cerrados.map((truck) => (
                <TruckCard key={truck.slug} truck={truck} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </PhoneShell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-black uppercase tracking-[1.2px] text-[#9a7560]">
      {children}
    </p>
  );
}

function TruckCard({ truck }: { truck: PublicTruck }) {
  const accent = normalizeHexColor(truck.primaryColor);

  return (
    <Link
      className="flex items-center gap-3.5 rounded-2xl border border-[#f0ddd0] bg-white px-4 py-3.5 transition active:scale-[0.99]"
      href={`/t/${truck.slug}`}
    >
      <span
        className="flex size-12 shrink-0 items-center justify-center rounded-[14px] text-[24px]"
        style={{ backgroundColor: accent, color: getContrastColor(accent) }}
      >
        {truck.brandIcon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-black text-[#1c1009]">
          {truck.name}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-[#9a7560]">
          {truck.address || truck.publicTagline}
        </span>
        <span
          className="mt-1 block text-[11px] font-bold"
          style={{ color: truck.isOpen ? "#16a34a" : "#b45309" }}
        >
          {truck.paused
            ? "En pausa"
            : truck.isOpen
              ? `Abierto · ${truck.todayHoursLabel}`
              : (truck.nextOpeningLabel ?? "Cerrado")}
        </span>
      </span>

      <span className="shrink-0 text-[18px] text-[#d8c3b4]">›</span>
    </Link>
  );
}
