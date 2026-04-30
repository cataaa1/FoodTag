import { type NextRequest, NextResponse } from "next/server";

import { CUSTOMER_SESSION_COOKIE, signCustomerSession } from "@/lib/auth/customer-jwt";
import { verifyHandoffToken } from "@/lib/auth/handoff-token";
import { getCustomerOrderById } from "@/lib/data/orders";

export async function GET(req: NextRequest) {
  const ticket = req.nextUrl.searchParams.get("ticket");
  const token = req.nextUrl.searchParams.get("token");

  if (!ticket || !token) {
    return NextResponse.redirect(new URL("/menu?handoff=invalid", req.url));
  }

  let payload;
  try {
    payload = await verifyHandoffToken(token);
  } catch {
    return NextResponse.redirect(new URL("/menu?handoff=expired", req.url));
  }

  if (payload.ticketId !== ticket) {
    return NextResponse.redirect(new URL("/menu?handoff=mismatch", req.url));
  }

  const order = await getCustomerOrderById(payload.customerId, ticket);
  if (!order || order.status === "cancelled" || order.status === "delivered" || order.pickedUpAt) {
    return NextResponse.redirect(new URL("/menu?handoff=expired", req.url));
  }

  const sessionToken = await signCustomerSession({
    customerId: payload.customerId,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
  });

  const response = NextResponse.redirect(new URL(`/ticket/${ticket}`, req.url));
  response.cookies.set(CUSTOMER_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
