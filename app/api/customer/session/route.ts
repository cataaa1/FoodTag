import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import {
  CUSTOMER_SESSION_COOKIE,
  getCustomerSession,
  signCustomerSession,
} from "@/lib/auth/customer-jwt";
import { getCustomerById, upsertCustomer } from "@/lib/data/orders";
import { customerSessionSchema } from "@/lib/validators/customer";

export async function GET() {
  try {
    const session = await getCustomerSession();

    if (!session) {
      return NextResponse.json({ customer: null });
    }

    const customer = getCustomerById(session.customerId);
    return NextResponse.json({ customer });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, customerSessionSchema);
    const customer = upsertCustomer(body);
    const token = await signCustomerSession({
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
    });
    const response = NextResponse.json({ customer }, { status: 201 });

    response.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
