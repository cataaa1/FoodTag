import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getTruckConfig } from "@/lib/data/truck-status";
import { getDb } from "@/lib/db/client";
import { pauseTruckSchema } from "@/lib/validators/hours";

export async function POST(request: Request) {
  try {
    await requireStaffPermission("settings.write");

    const body = await parseJsonBody(request, pauseTruckSchema);
    const config = await getTruckConfig();

    getDb()
      .prepare(
        `
          update truck_config set
            paused_manual_at = @pausedManualAt,
            paused_reason = @pausedReason,
            updated_at = datetime('now')
          where id = @id
        `,
      )
      .run({
        id: config.id,
        pausedManualAt: new Date().toISOString(),
        pausedReason: body.reason,
      });

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/hours");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
