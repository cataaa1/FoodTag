import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CUSTOMER_SESSION_COOKIE, signCustomerSession } from "@/lib/auth/customer-jwt";
import { verifyHandoffToken } from "@/lib/auth/handoff-token";
import { getCustomerOrderById } from "@/lib/data/orders";

type Props = {
  searchParams: Promise<{ ticket?: string; token?: string }>;
};

export default async function HandoffPage({ searchParams }: Props) {
  const { ticket, token } = await searchParams;

  if (!ticket || !token) {
    redirect("/menu?handoff=invalid");
  }

  let payload;
  try {
    payload = await verifyHandoffToken(token);
  } catch {
    redirect("/menu?handoff=expired");
  }

  if (payload.ticketId !== ticket) {
    redirect("/menu?handoff=mismatch");
  }

  // Verify the order still exists, belongs to this customer, and is still active.
  const order = getCustomerOrderById(payload.customerId, ticket);
  if (!order || order.status === "cancelled" || order.status === "delivered" || order.pickedUpAt) {
    redirect("/menu?handoff=expired");
  }

  const sessionToken = await signCustomerSession({
    customerId: payload.customerId,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
  });

  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(`/ticket/${ticket}`);
}
