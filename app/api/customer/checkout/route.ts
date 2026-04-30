import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireCustomerSession } from "@/lib/auth/customer-jwt";
import {
  attachMercadoPagoPreference,
  createCustomerOrder,
  getCustomerById,
} from "@/lib/data/orders";
import {
  createMercadoPagoPreference,
  isMercadoPagoConfigured,
} from "@/lib/payments/mercado-pago";
import { createOrderSchema } from "@/lib/validators/customer";

export async function POST(request: Request) {
  try {
    const session = await requireCustomerSession();
    const body = await parseJsonBody(request, createOrderSchema);
    const customer = await getCustomerById(session.customerId);

    if (!customer) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "La sesión cliente ya no existe" } },
        { status: 401 },
      );
    }

    const mercadoPagoEnabled = isMercadoPagoConfigured();
    const order = await createCustomerOrder(session.customerId, body, {
      paymentStatus: mercadoPagoEnabled ? "pending" : "approved",
    });

    if (!mercadoPagoEnabled) {
      return NextResponse.json({
        checkoutUrl: null,
        mode: "mock",
        order,
      });
    }

    const preference = await createMercadoPagoPreference({ customer, order });
    await attachMercadoPagoPreference(order.id, preference.id);

    return NextResponse.json({
      checkoutUrl: preference.initPoint,
      localCheckout: preference.localCheckout,
      mode: "mercado_pago",
      order: {
        ...order,
        mpPreferenceId: preference.id,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
