import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { listPublicTrucks } from "@/lib/data/public-trucks";

/** Listado publico para elegir foodtruck cuando se entra sin escanear un QR. */
export async function GET() {
  try {
    return NextResponse.json({ trucks: await listPublicTrucks() });
  } catch (error) {
    return handleRouteError(error);
  }
}
