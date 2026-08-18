import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireCustomerSession } from "@/lib/auth/customer-jwt";
import {
  getCustomerOrderById,
  markOrderPaymentFromMercadoPago,
} from "@/lib/data/orders";
import { getMercadoPagoPayment } from "@/lib/payments/mercado-pago";
import { customerOrderIdParamSchema } from "@/lib/validators/customer";

const paymentReturnSchema = z.object({
  paymentId: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireCustomerSession();
    const { id } = parseParams(await params, customerOrderIdParamSchema);
    const body = await parseJsonBody(request, paymentReturnSchema);
    const order = await getCustomerOrderById(session.customerId, id);

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "No encontramos ese ticket");
    }

    const payment = await getMercadoPagoPayment(body.paymentId, order.truckId);

    if (payment.externalReference && payment.externalReference !== id) {
      throw new ApiError(409, "CONFLICT", "El pago no corresponde a este pedido");
    }

    const updatedOrder = await markOrderPaymentFromMercadoPago({
      orderId: id,
      paymentId: payment.id,
      paymentStatus: payment.status,
    });

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    return handleRouteError(error);
  }
}
