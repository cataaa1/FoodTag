import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireCustomerSession } from "@/lib/auth/customer-jwt";
import { getCustomerOrderById } from "@/lib/data/orders";
import { savePushSubscription } from "@/lib/push/subscriptions";

const bodySchema = z.object({
  orderId: z.string().uuid(),
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(500).optional(),
  platform: z.enum(["android", "ios", "desktop"]).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireCustomerSession();
    const { orderId, endpoint, p256dh, auth, userAgent, platform } = await parseJsonBody(
      request,
      bodySchema,
    );

    const order = await getCustomerOrderById(session.customerId, orderId);
    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "No encontramos ese pedido");
    }

    if (order.status === "delivered" || order.status === "cancelled") {
      throw new ApiError(409, "CONFLICT", "El pedido ya está cerrado");
    }

    await savePushSubscription({ orderId, endpoint, p256dh, auth, userAgent, platform });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
