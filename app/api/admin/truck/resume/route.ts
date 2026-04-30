import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { writeAuditLog } from "@/lib/data/audit-log";
import { getTruckConfig } from "@/lib/data/truck-status";
import { getDb } from "@/lib/db/client";

export async function POST() {
  try {
    const context = await requireStaffPermission("settings.write");

    const config = await getTruckConfig();

    await getDb().execute({
      sql: `
        update truck_config set
          paused_manual_at = null,
          paused_reason = null,
          updated_at = datetime('now')
        where id = ?
      `,
      args: [config.id],
    });

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "truck.resumed",
      targetType: "truck_config",
      targetId: config.id,
      metadata: { paused: false },
    });

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/hours");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
