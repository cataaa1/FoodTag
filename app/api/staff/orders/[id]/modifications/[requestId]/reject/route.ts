import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getStaffOrderById, rejectModificationRequest } from "@/lib/data/orders";
import {
  modificationRequestIdParamSchema,
  rejectModificationRequestSchema,
} from "@/lib/validators/orders";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  try {
    const context = await requireStaffPermission("orders.approve_mod");
    const { id, requestId } = parseParams(
      await params,
      modificationRequestIdParamSchema,
    );
    await parseJsonBody(request, rejectModificationRequestSchema);

    await rejectModificationRequest({
      orderId: id,
      requestId,
      staffUserId: context.user.id,
    });

    return NextResponse.json({ order: await getStaffOrderById(id) });
  } catch (error) {
    return handleRouteError(error);
  }
}
