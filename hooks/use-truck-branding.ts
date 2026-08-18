"use client";

import { useQuery } from "@tanstack/react-query";

import type { TruckBranding } from "@/lib/types/domain";
import { fetchJson } from "@/lib/utils/http";

export const TRUCK_BRANDING_QUERY_KEY = ["truck-branding"] as const;

/**
 * Identidad visual del truck (logo, hero, color). Se pide una sola vez por
 * sesion de navegador: no tiene refetch por intervalo y no se revalida al
 * volver a la pestaña. Nunca la metas en un componente que pollea.
 */
export function useTruckBranding() {
  return useQuery({
    queryKey: TRUCK_BRANDING_QUERY_KEY,
    queryFn: () => fetchJson<TruckBranding>("/api/customer/truck-branding"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
