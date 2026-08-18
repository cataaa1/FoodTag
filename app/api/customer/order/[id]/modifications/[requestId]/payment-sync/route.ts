import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseParams } from "@/lib/api/route";
import { requireCustomerSession } from "@/lib/auth/customer-jwt";
import {
  getCustomerOrderById,
  markModificationPaymentFromMercadoPago,
} from "@/lib/data/orders";
import { findMercadoPagoPaymentByPreference } from "@/lib/payments/mercado-pago";
import { modificationRequestIdParamSchema } from "@/lib/validators/orders";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  try {
    const session = await requireCustomerSession();
    const { id, requestId } = parseParams(
      await params,
      modificationRequestIdParamSchema,
    );
    const order = await getCustomerOrderById(session.customerId, id);

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "No encontramos ese ticket");
    }

    const modificationRequest = order.modificationRequests.find(
      (request) => request.id === requestId,
    );

    if (!modificationRequest) {
      throw new ApiError(404, "NOT_FOUND", "Modificacion no encontrada");
    }

    if (
      modificationRequest.status !== "extra_payment_pending" ||
      !modificationRequest.mpPreferenceId
    ) {
      return NextResponse.json({ order });
    }

    const payment = await findMercadoPagoPaymentByPreference(
      modificationRequest.mpPreferenceId,
      order.truckId,
    );

    if (!payment) {
      return NextResponse.json({ order });
    }

    if (payment.externalReference && payment.externalReference !== `mod:${requestId}`) {
      throw new ApiError(409, "CONFLICT", "El pago no corresponde a esta modificacion");
    }

    await markModificationPaymentFromMercadoPago({
      requestId,
      paymentId: payment.id,
      paymentStatus: payment.status,
    });

    return NextResponse.json({
      order: await getCustomerOrderById(session.customerId, id),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
