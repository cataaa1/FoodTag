"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { getContrastColor, hexToRgba, normalizeHexColor } from "@/lib/utils/color";
import { fetchJson } from "@/lib/utils/http";

type BrandThemeStatus = {
  primaryColor: string;
};

export function BrandThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const truckStatusQuery = useQuery({
    queryKey: ["truck-status"],
    queryFn: () => fetchJson<BrandThemeStatus>("/api/customer/truck-status"),
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    const accentColor = normalizeHexColor(truckStatusQuery.data?.primaryColor);
    const accentContrast = getContrastColor(accentColor);
    const rootStyle = document.documentElement.style;

    rootStyle.setProperty("--brand-primary", accentColor);
    rootStyle.setProperty("--brand-primary-contrast", accentContrast);
    rootStyle.setProperty("--brand-primary-soft", hexToRgba(accentColor, 0.14));
    rootStyle.setProperty("--brand-primary-soft-strong", hexToRgba(accentColor, 0.2));
    rootStyle.setProperty("--brand-primary-glow", hexToRgba(accentColor, 0.3));
  }, [truckStatusQuery.data?.primaryColor]);

  return children;
}
