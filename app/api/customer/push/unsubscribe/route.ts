import { z } from "zod";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { requireCustomerSession } from "@/lib/auth/customer-jwt";
import { deletePushSubscription } from "@/lib/push/subscriptions";

const bodySchema = z.object({
  endpoint: z.string().url(),
});

export async function POST(request: Request) {
  try {
    await requireCustomerSession();

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: parsed.error.message } },
        { status: 400 },
      );
    }

    deletePushSubscription(parsed.data.endpoint);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
