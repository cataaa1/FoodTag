import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getOpeningHours } from "@/lib/data/truck-status";
import { getDb } from "@/lib/db/client";
import { hoursPatchSchema } from "@/lib/validators/hours";

export async function GET() {
  try {
    await requireStaffPermission("hours.write");
    const hours = await getOpeningHours();
    return NextResponse.json({ hours });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireStaffPermission("hours.write");

    const body = await parseJsonBody(request, hoursPatchSchema);
    const db = getDb();
    const statement = db.prepare(
      `
        update opening_hours set
          opens_at = @opensAt,
          closes_at = @closesAt,
          closed = @closed
        where weekday = @weekday
      `,
    );

    const transaction = db.transaction(() => {
      body.hours.forEach((entry) => {
        statement.run({
          weekday: entry.weekday,
          opensAt: entry.opensAt,
          closesAt: entry.closesAt,
          closed: entry.closed ? 1 : 0,
        });
      });
    });

    transaction();

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/hours");

    const hours = await getOpeningHours();
    return NextResponse.json({ hours });
  } catch (error) {
    return handleRouteError(error);
  }
}
