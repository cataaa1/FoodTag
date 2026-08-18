"use client";

import { useQuery } from "@tanstack/react-query";

import type { TruckBranding } from "@/lib/types/domain";
import { fetchJson } from "@/lib/utils/http";

/**
 * Identidad visual del truck (logo, hero, color). Son data URI pesados, asi
 * que viven fuera del endpoint de estado, que se pollea cada pocos segundos.
 *
 * La URL lleva la version del branding, que sale de /api/customer/truck-status.
 * Mientras el admin no toque el logo, la version no cambia y la respuesta sale
 * de cache; cuando lo cambia, la URL es otra y todos los caches fallan de una.
 * Por eso el hook no necesita refetch por intervalo ni invalidacion manual.
 */
export function useTruckBranding(brandingVersion: string | undefined) {
  return useQuery({
    queryKey: ["truck-branding", brandingVersion],
    queryFn: () =>
      fetchJson<TruckBranding>(
        `/api/customer/truck-branding?v=${encodeURIComponent(brandingVersion ?? "")}`,
      ),
    enabled: Boolean(brandingVersion),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
