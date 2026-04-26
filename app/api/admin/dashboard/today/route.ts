import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getDashboardToday } from "@/lib/data/dashboard";

export async function GET() {
  try {
    await requireStaffPermission("dashboard.view");

    return NextResponse.json({
      dashboard: await getDashboardToday(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
