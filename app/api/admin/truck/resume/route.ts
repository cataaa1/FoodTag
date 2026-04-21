import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getTruckConfig } from "@/lib/data/truck-status";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
  try {
    await requireStaffPermission("settings.write");

    const config = await getTruckConfig();
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("truck_config")
      .update({
        paused_manual_at: null,
        paused_reason: null,
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
