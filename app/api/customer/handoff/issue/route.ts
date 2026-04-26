import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError, ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireCustomerSession } from "@/lib/auth/customer-jwt";
import { signHandoffToken } from "@/lib/auth/handoff-token";
import { getCustomerOrderById } from "@/lib/data/orders";

const issueSchema = z.object({
  ticketId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await requireCustomerSession();
    const { ticketId } = await parseJsonBody(request, issueSchema);

    const order = getCustomerOrderById(session.customerId, ticketId);

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "No encontramos ese ticket");
    }

    if (order.status === "cancelled" || order.status === "delivered" || order.pickedUpAt) {
      throw new ApiError(403, "FORBIDDEN", "El pedido ya no está activo");
    }

    const token = await signHandoffToken({
      customerId: session.customerId,
      ticketId,
      customerName: session.customerName,
      customerPhone: session.customerPhone,
    });

    return NextResponse.json({ token });
  } catch (error) {
    return handleRouteError(error);
  }
}
