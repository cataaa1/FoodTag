import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { advanceStaffOrderItem } from "@/lib/data/orders";
import { orderItemIdParamSchema } from "@/lib/validators/orders";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    await requireStaffPermission("orders.advance");
    const { id, itemId } = parseParams(
      await context.params,
      orderItemIdParamSchema,
    );
    const order = advanceStaffOrderItem(id, itemId);

    return NextResponse.json({ order });
  } catch (error) {
    return handleRouteError(error);
  }
}
