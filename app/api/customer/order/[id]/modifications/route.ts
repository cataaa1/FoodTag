import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireCustomerSession } from "@/lib/auth/customer-jwt";
import { createCustomerModificationRequest } from "@/lib/data/orders";
import { customerOrderIdParamSchema } from "@/lib/validators/customer";
import { customerModificationRequestSchema } from "@/lib/validators/orders";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCustomerSession();
    const { id } = parseParams(await params, customerOrderIdParamSchema);
    const body = await parseJsonBody(request, customerModificationRequestSchema);
    const modificationRequest = createCustomerModificationRequest({
      customerId: session.customerId,
      orderId: id,
      items: body.items,
    });

    return NextResponse.json({ modificationRequest });
  } catch (error) {
    return handleRouteError(error);
  }
}
