import { z } from "zod";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
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

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: parsed.error.message } },
        { status: 400 },
      );
    }

    const { orderId, endpoint, p256dh, auth, userAgent, platform } = parsed.data;

    const order = getCustomerOrderById(session.customerId, orderId);
    if (!order) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "No encontramos ese pedido" } },
        { status: 404 },
      );
    }

    if (order.status === "delivered" || order.status === "cancelled") {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: "El pedido ya está cerrado" } },
        { status: 409 },
      );
    }

    savePushSubscription({ orderId, endpoint, p256dh, auth, userAgent, platform });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
