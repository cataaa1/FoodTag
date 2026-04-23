import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import {
  approveModificationRequest,
  getStaffOrderById,
} from "@/lib/data/orders";
import {
  approveModificationRequestSchema,
  modificationRequestIdParamSchema,
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
    await parseJsonBody(request, approveModificationRequestSchema);

    const modificationRequest = approveModificationRequest({
      orderId: id,
      requestId,
      staffUserId: context.user.id,
    });

    return NextResponse.json({
      modificationRequest,
      order: getStaffOrderById(id),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
