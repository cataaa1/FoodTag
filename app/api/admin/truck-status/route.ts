import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { requireStaffSession } from "@/lib/auth/staff-session";
import { getTruckStatus } from "@/lib/data/truck-status";

/**
 * Mismo payload que el endpoint publico, pero resuelto por la sesion de staff.
 *
 * El panel no puede leer el del cliente: si el admin escanea el QR de otro
 * foodtruck, su cookie de cliente apunta a ese otro y el encabezado del panel
 * pasaria a mostrar un truck que no es el suyo.
 */
export async function GET() {
  try {
    await requireStaffSession();
    return NextResponse.json(await getTruckStatus());
  } catch (error) {
    return handleRouteError(error);
  }
}
