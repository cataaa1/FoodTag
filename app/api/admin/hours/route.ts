import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getOpeningHours } from "@/lib/data/truck-status";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
    const supabase = getSupabaseAdmin();

    const updates = body.hours.map((entry) =>
      supabase
        .from("opening_hours")
        .update({
          opens_at: entry.opensAt,
          closes_at: entry.closesAt,
          closed: entry.closed,
        })
        .eq("weekday", entry.weekday),
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      throw failed.error;
    }

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/hours");

    const hours = await getOpeningHours();
    return NextResponse.json({ hours });
  } catch (error) {
    return handleRouteError(error);
  }
}
