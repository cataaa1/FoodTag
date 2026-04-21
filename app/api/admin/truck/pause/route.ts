import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getTruckConfig } from "@/lib/data/truck-status";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { pauseTruckSchema } from "@/lib/validators/hours";

export async function POST(request: Request) {
  try {
    await requireStaffPermission("settings.write");

    const body = await parseJsonBody(request, pauseTruckSchema);
    const config = await getTruckConfig();
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("truck_config")
      .update({
        paused_manual_at: new Date().toISOString(),
        paused_reason: body.reason,
      })
      .eq("id", config.id);

    if (error) {
      throw error;
    }

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/hours");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
