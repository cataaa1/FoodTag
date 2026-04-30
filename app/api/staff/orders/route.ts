import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getStaffOrders } from "@/lib/data/orders";

export async function GET() {
  try {
    const context = await requireStaffPermission("orders.read");
    return NextResponse.json({
      orders: await getStaffOrders(),
      permissions: context.role.permissionsJson,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
