import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseParams } from "@/lib/api/route";
import { requirePlatformAdmin } from "@/lib/auth/platform-session";
import { ACTIVE_TRUCK_COOKIE } from "@/lib/auth/staff-token";
import { truckExists } from "@/lib/data/trucks";

const paramsSchema = z.object({ id: z.string().uuid() });

/**
 * El superadmin "entra" a un truck: se guarda cual es en una cookie y a partir
 * de ahi todo el panel resuelve ese truck. Los empleados no usan esta ruta:
 * su truck sale de staff_user.truck_id y no lo pueden cambiar.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePlatformAdmin();
    const { id } = parseParams(await params, paramsSchema);

    if (!(await truckExists(id))) {
      throw new ApiError(404, "NOT_FOUND", "Ese foodtruck no existe");
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ACTIVE_TRUCK_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
