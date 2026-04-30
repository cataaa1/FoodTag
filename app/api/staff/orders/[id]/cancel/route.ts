import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { cancelStaffOrder } from "@/lib/data/orders";
import { cancelOrderSchema, orderIdParamSchema } from "@/lib/validators/orders";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffPermission("orders.cancel");
    const { id } = parseParams(await context.params, orderIdParamSchema);
    const body = await parseJsonBody(request, cancelOrderSchema);
    const order = await cancelStaffOrder(id, body.reason);

    return NextResponse.json({ order });
  } catch (error) {
    return handleRouteError(error);
  }
}
