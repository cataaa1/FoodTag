import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { unbumpStaffOrder } from "@/lib/data/orders";
import { orderIdParamSchema } from "@/lib/validators/orders";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffPermission("orders.advance");
    const { id } = parseParams(await context.params, orderIdParamSchema);
    const order = await unbumpStaffOrder(id);

    return NextResponse.json({ order });
  } catch (error) {
    return handleRouteError(error);
  }
}
