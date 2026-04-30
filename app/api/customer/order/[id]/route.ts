import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseParams } from "@/lib/api/route";
import { requireCustomerSession } from "@/lib/auth/customer-jwt";
import { getCustomerOrderById } from "@/lib/data/orders";
import { customerOrderIdParamSchema } from "@/lib/validators/customer";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCustomerSession();
    const { id } = parseParams(await params, customerOrderIdParamSchema);
    const order = await getCustomerOrderById(session.customerId, id);

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "No encontramos ese ticket");
    }

    return NextResponse.json({ order });
  } catch (error) {
    return handleRouteError(error);
  }
}
