import { type NextRequest, NextResponse } from "next/server";

import { PUBLIC_TRUCK_COOKIE } from "@/lib/auth/staff-token";
import { getDb } from "@/lib/db/client";

/**
 * Punto de entrada del QR: /t/<slug>
 *
 * Cada foodtruck imprime su propio QR apuntando aca. La ruta resuelve el slug,
 * deja el truck fijado en una cookie y manda al menu. A partir de ese momento
 * todas las pantallas del cliente (menu, carrito, ticket) hablan de ese truck.
 *
 * El slug viaja en la URL y no en el menu mismo para que las pantallas del
 * cliente conserven URLs limpias, y porque el QR se escanea parado adelante del
 * truck: es el momento exacto en que sabemos de cual esta comprando.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const result = await getDb().execute({
    sql: "select id, slug from truck_config where slug = ?",
    args: [slug],
  });
  const truck = result.rows[0] as unknown as { id: string; slug: string } | undefined;

  if (!truck) {
    return NextResponse.redirect(new URL("/menu?truck=desconocido", request.url));
  }

  // El slug viaja al menu para que el cliente pueda vaciar un carrito que haya
  // quedado de otro foodtruck antes de empezar a pedir en este.
  const response = NextResponse.redirect(
    new URL(`/menu?truck=${encodeURIComponent(truck.slug)}`, request.url),
  );

  response.cookies.set(PUBLIC_TRUCK_COOKIE, truck.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
