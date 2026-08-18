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
        // Se cachea agresivo a proposito: el parametro ?v= de la URL cambia
        // cuando el admin guarda un logo nuevo, asi que una respuesta cacheada
        // nunca puede quedar vieja.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
