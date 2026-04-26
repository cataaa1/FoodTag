import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { listAuditLog } from "@/lib/data/audit-log";

export async function GET() {
  try {
    await requireStaffPermission("users.manage");

    return NextResponse.json({
      entries: listAuditLog(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
