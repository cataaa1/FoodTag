import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireCustomerSession } from "@/lib/auth/customer-jwt";
import { createCustomerOrder } from "@/lib/data/orders";
import { createOrderSchema } from "@/lib/validators/customer";

export async function POST(request: Request) {
  try {
    const session = await requireCustomerSession();
    const body = await parseJsonBody(request, createOrderSchema);
    const order = await createCustomerOrder(session.customerId, body);

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
