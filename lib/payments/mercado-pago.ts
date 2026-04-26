import { createHmac, timingSafeEqual } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/config/env";
import type {
  Customer,
  CustomerOrder,
  OrderModificationRequest,
} from "@/lib/types/domain";

type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPaymentResponse = {
  id: number | string;
  status: string;
  external_reference?: string;
};

type MercadoPagoMerchantOrderPayment = {
  id: number | string;
  status?: string;
};

type MercadoPagoMerchantOrder = {
  payments?: MercadoPagoMerchantOrderPayment[];
};

type MercadoPagoMerchantOrderSearchResponse = {
  elements?: MercadoPagoMerchantOrder[];
};

type PreferenceInput = {
  customer: Customer;
  order: CustomerOrder;
};

type ModificationPreferenceInput = {
  customer: Customer;
  order: CustomerOrder;
  request: OrderModificationRequest;
};

type MercadoPagoOrderPaymentStatus = "approved" | "rejected" | "cancelled" | "pending";

function getAccessToken() {
  return getServerEnv().MERCADO_PAGO_ACCESS_TOKEN ?? null;
}

export function isMercadoPagoConfigured() {
  return Boolean(getAccessToken());
}

function centsToAmount(cents: number) {
  return Number((cents / 100).toFixed(2));
}


function isPublicHttpsUrl(appUrl: string) {
  try {
    return new URL(appUrl).protocol === "https:";
  } catch {
    return false;
  }
}

function getPreferenceReturnConfig(appUrl: string, callbackUrl: string) {
  const isHttps = isPublicHttpsUrl(appUrl);

  // Con HTTP (localhost, Tailscale, dev) MP no puede redirigir de vuelta ni recibir webhooks.
  // Abrimos MP en nueva pestaña y llevamos al usuario directo al ticket — el payment-sync
  // confirma el pago cuando vuelve a la pestaña del ticket.
  if (!isHttps) {
    return { localCheckout: true };
  }

  return {
    localCheckout: false,
    back_urls: {
      success: callbackUrl,
      pending: callbackUrl,
      failure: callbackUrl,
    },
    auto_return: "approved",
    notification_url: `${appUrl}/api/mercado-pago/webhook`,
  };
}

export async function createMercadoPagoPreference({
  customer,
  order,
}: PreferenceInput) {
  const token = getAccessToken();

  if (!token) {
    throw new ApiError(500, "INTERNAL", "Mercado Pago no está configurado");
  }

  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
  const items = order.items.map((item) => ({
    id: item.id,
    title: `${item.quantity}x ${item.nameSnapshot}${
      item.variantNameSnapshot ? ` (${item.variantNameSnapshot})` : ""
    }`,
    quantity: 1,
    unit_price: centsToAmount(item.lineTotalCents),
    currency_id: "ARS",
  }));

  if (order.tipCents > 0) {
    items.push({
      id: `${order.id}-tip`,
      title: "Propina",
      quantity: 1,
      unit_price: centsToAmount(order.tipCents),
      currency_id: "ARS",
    });
  }

  const callbackUrl = `${appUrl}/ticket/${order.id}`;
  const returnConfig = getPreferenceReturnConfig(appUrl, callbackUrl);
  const { localCheckout, ...remoteReturnConfig } = returnConfig;
  const preferencePayload: Record<string, unknown> = {
    items,
    payer: {
      name: customer.name,
      phone: { number: customer.phone },
    },
    external_reference: order.id,
    metadata: {
      order_id: order.id,
      ticket_number: order.ticketNumber,
    },
    ...remoteReturnConfig,
  };

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferencePayload),
  });

  const data = (await response.json().catch(() => null)) as
    | MercadoPagoPreferenceResponse
    | { message?: string; error?: string }
    | null;

  if (!response.ok || !data || !("id" in data)) {
    throw new ApiError(
      502,
      "INTERNAL",
      data && "message" in data && data.message
        ? data.message
        : "Mercado Pago no pudo crear el checkout",
    );
  }

  return {
    id: data.id,
    initPoint: data.init_point ?? data.sandbox_init_point ?? null,
    localCheckout,
  };
}

export async function createMercadoPagoModificationPreference({
  customer,
  order,
  request,
}: ModificationPreferenceInput) {
  const token = getAccessToken();

  if (!token) {
    throw new ApiError(500, "INTERNAL", "Mercado Pago no está configurado");
  }

  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
  const callbackUrl = `${appUrl}/ticket/${order.id}`;
  const returnConfig = getPreferenceReturnConfig(appUrl, callbackUrl);
  const { localCheckout, ...remoteReturnConfig } = returnConfig;
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [
        {
          id: request.id,
          title: `Diferencia pedido #${String(order.ticketNumber).padStart(3, "0")}`,
          quantity: 1,
          unit_price: centsToAmount(request.extraAmountCents),
          currency_id: "ARS",
        },
      ],
      payer: {
        name: customer.name,
        phone: { number: customer.phone },
      },
      external_reference: `mod:${request.id}`,
      metadata: {
        order_id: order.id,
        modification_request_id: request.id,
      },
      ...remoteReturnConfig,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | MercadoPagoPreferenceResponse
    | { message?: string; error?: string }
    | null;

  if (!response.ok || !data || !("id" in data)) {
    throw new ApiError(
      502,
      "INTERNAL",
      data && "message" in data && data.message
        ? data.message
        : "Mercado Pago no pudo crear el checkout adicional",
    );
  }

  return {
    id: data.id,
    initPoint: data.init_point ?? data.sandbox_init_point ?? null,
    localCheckout,
  };
}

export async function getMercadoPagoPayment(paymentId: string) {
  const token = getAccessToken();

  if (!token) {
    throw new ApiError(500, "INTERNAL", "Mercado Pago no está configurado");
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json().catch(() => null)) as
    | MercadoPagoPaymentResponse
    | null;

  if (!response.ok || !data) {
    throw new ApiError(502, "INTERNAL", "No pudimos consultar el pago en Mercado Pago");
  }

  return {
    id: String(data.id),
    status: normalizeMercadoPagoStatus(data.status),
    externalReference: data.external_reference ?? null,
  };
}

export function normalizeMercadoPagoStatus(status: string): MercadoPagoOrderPaymentStatus {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "cancelled" || status === "refunded" || status === "charged_back") {
    return "cancelled";
  }
  return "pending";
}

export async function findMercadoPagoPaymentByPreference(preferenceId: string) {
  const token = getAccessToken();

  if (!token) {
    throw new ApiError(500, "INTERNAL", "Mercado Pago no está configurado");
  }

  const url = new URL("https://api.mercadopago.com/merchant_orders/search");
  url.searchParams.set("preference_id", preferenceId);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await response.json().catch(() => null)) as
    | MercadoPagoMerchantOrderSearchResponse
    | null;

  if (!response.ok || !data) {
    throw new ApiError(502, "INTERNAL", "No pudimos sincronizar el pago en Mercado Pago");
  }

  const payment = data.elements
    ?.flatMap((order) => order.payments ?? [])
    .find((candidate) => candidate.id);

  if (!payment) {
    return null;
  }

  return getMercadoPagoPayment(String(payment.id));
}

export function verifyMercadoPagoSignature(input: {
  dataId: string | null;
  rawBody: string;
  requestId: string | null;
  signature: string | null;
}) {
  const secret = getServerEnv().MERCADO_PAGO_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

  if (!input.signature || !input.requestId || !input.dataId) {
    return false;
  }

  const parts = Object.fromEntries(
    input.signature.split(",").map((part) => {
      const [key, value] = part.split("=", 2);
      return [key?.trim(), value?.trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;

  if (!ts || !v1) {
    return false;
  }

  const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(v1, "hex");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}
