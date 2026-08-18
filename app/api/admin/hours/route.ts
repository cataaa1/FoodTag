import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import {
  requireStaffPermission,
  requireStaffSession,
} from "@/lib/auth/staff-session";
import { writeAuditLog } from "@/lib/data/audit-log";
import { getOpeningHours } from "@/lib/data/truck-status";
import { getDb } from "@/lib/db/client";
import { hoursPatchSchema } from "@/lib/validators/hours";

export async function GET() {
  try {
    // Lectura abierta a todo el staff: los horarios son informacion publica y
    // cajero/cocina los necesitan para ubicarse. Editar sigue pidiendo hours.write.
    const context = await requireStaffSession();
    const hours = await getOpeningHours();
    return NextResponse.json({ hours, permissions: context.role.permissionsJson });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireStaffPermission("hours.write");

    const body = await parseJsonBody(request, hoursPatchSchema);
    const db = getDb();

    await db.batch(
      body.hours.map((entry) => ({
        sql: `
          update opening_hours set
            opens_at = ?,
            closes_at = ?,
            closed = ?
          where weekday = ?
        `,
        args: [entry.opensAt, entry.closesAt, entry.closed ? 1 : 0, entry.weekday],
      })),
      "write",
    );

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "truck.hours.updated",
      targetType: "opening_hours",
      targetId: "weekly-schedule",
      metadata: {
        hours: body.hours.map((entry) => ({
          weekday: entry.weekday,
          opensAt: entry.opensAt,
          closesAt: entry.closesAt,
          closed: entry.closed,
        })),
      },
    });

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/hours");

    const hours = await getOpeningHours();
    return NextResponse.json({ hours });
  } catch (error) {
    return handleRouteError(error);
  }
}
