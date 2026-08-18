import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { getTruckBranding } from "@/lib/data/truck-status";

/**
 * Logo y foto del landing. Son data URI pesados (cientos de KB) que antes
 * viajaban dentro de /api/customer/truck-status, un endpoint que se pollea
 * cada 5 s. Aca van solos y con cache: el navegador y el CDN los reusan, y el
 * polling de estado queda en ~1 KB.
 */
export async function GET() {
  try {
    const branding = await getTruckBranding();

    return NextResponse.json(branding, {
      headers: {
        // 5 min en el CDN; si el admin cambia el logo, se ve al minuto siguiente.
        "Cache-Control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
