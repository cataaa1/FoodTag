import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseParams } from "@/lib/api/route";
import { requireCustomerSession } from "@/lib/auth/customer-jwt";
import { confirmCustomerOrderPickup } from "@/lib/data/orders";
import { customerOrderIdParamSchema } from "@/lib/validators/customer";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCustomerSession();
    const { id } = parseParams(await params, customerOrderIdParamSchema);
    const order = await confirmCustomerOrderPickup(session.customerId, id);

    return NextResponse.json({ order });
  } catch (error) {
    return handleRouteError(error);
  }
}
