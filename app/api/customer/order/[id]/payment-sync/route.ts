import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseParams } from "@/lib/api/route";
import { requireCustomerSession } from "@/lib/auth/customer-jwt";
import {
  getCustomerOrderById,
  markOrderPaymentFromMercadoPago,
} from "@/lib/data/orders";
import { findMercadoPagoPaymentByPreference } from "@/lib/payments/mercado-pago";
import { customerOrderIdParamSchema } from "@/lib/validators/customer";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCustomerSession();
    const { id } = parseParams(await params, customerOrderIdParamSchema);
    const order = getCustomerOrderById(session.customerId, id);

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "No encontramos ese ticket");
    }

    if (order.paymentStatus !== "pending" || !order.mpPreferenceId) {
      return NextResponse.json({ order });
    }

    const payment = await findMercadoPagoPaymentByPreference(order.mpPreferenceId);

    if (!payment) {
      return NextResponse.json({ order });
    }

    if (payment.externalReference && payment.externalReference !== id) {
      throw new ApiError(409, "CONFLICT", "El pago no corresponde a este pedido");
    }

    const updatedOrder = markOrderPaymentFromMercadoPago({
      orderId: id,
      paymentId: payment.id,
      paymentStatus: payment.status,
    });

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    return handleRouteError(error);
  }
}
