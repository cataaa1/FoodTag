import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getTruckConfig } from "@/lib/data/truck-status";
import { getDb } from "@/lib/db/client";

export async function POST() {
  try {
    await requireStaffPermission("settings.write");

    const config = await getTruckConfig();

    getDb()
      .prepare(
        `
          update truck_config set
            paused_manual_at = null,
            paused_reason = null,
            updated_at = datetime('now')
          where id = @id
        `,
      )
      .run({ id: config.id });

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/hours");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
