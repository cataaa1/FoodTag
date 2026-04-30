import { NextRequest, NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import {
  insertPaymentWebhookEvent,
  markModificationPaymentFromMercadoPago,
  markOrderPaymentFromMercadoPago,
  markPaymentWebhookEventProcessed,
} from "@/lib/data/orders";
import {
  getMercadoPagoPayment,
  verifyMercadoPagoSignature,
} from "@/lib/payments/mercado-pago";

type MercadoPagoWebhookBody = {
  id?: string | number;
  type?: string;
  action?: string;
  data?: { id?: string | number };
  resource?: string;
};

function extractPaymentId(body: MercadoPagoWebhookBody, request: NextRequest) {
  const queryPaymentId =
    request.nextUrl.searchParams.get("data.id") ??
    request.nextUrl.searchParams.get("id");
  const bodyPaymentId = body.data?.id ?? body.id;

  if (bodyPaymentId) {
    return String(bodyPaymentId);
  }

  if (body.resource?.includes("/payments/")) {
    return body.resource.split("/").at(-1) ?? null;
  }

  return queryPaymentId;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody || "{}") as MercadoPagoWebhookBody;
    const paymentId = extractPaymentId(body, request);
    const eventType = body.type ?? body.action ?? request.nextUrl.searchParams.get("type") ?? "unknown";

    if (
      !verifyMercadoPagoSignature({
        dataId: paymentId,
        rawBody,
        requestId: request.headers.get("x-request-id"),
        signature: request.headers.get("x-signature"),
      })
    ) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    if (!paymentId || !String(eventType).includes("payment")) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const externalEventId = String(body.id ?? `${eventType}:${paymentId}`);
    const event = await insertPaymentWebhookEvent({
      externalEventId,
      eventType,
      payloadJson: rawBody,
    });

    if (!event.inserted) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const payment = await getMercadoPagoPayment(paymentId);

    if (payment.externalReference?.startsWith("mod:")) {
      await markModificationPaymentFromMercadoPago({
        requestId: payment.externalReference.replace("mod:", ""),
        paymentId: payment.id,
        paymentStatus: payment.status,
      });
    } else if (payment.externalReference) {
      await markOrderPaymentFromMercadoPago({
        orderId: payment.externalReference,
        paymentId: payment.id,
        paymentStatus: payment.status,
      });
    }

    await markPaymentWebhookEventProcessed(event.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
