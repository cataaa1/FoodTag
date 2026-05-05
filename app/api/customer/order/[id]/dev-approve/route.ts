import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseParams } from "@/lib/api/route";
import { requireCustomerSession } from "@/lib/auth/customer-jwt";
import { getCustomerOrderById } from "@/lib/data/orders";
import { getDb } from "@/lib/db/client";
import { customerOrderIdParamSchema } from "@/lib/validators/customer";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.DEV_PAYMENT_BYPASS !== "true") {
    throw new ApiError(403, "FORBIDDEN", "Solo disponible en modo de prueba");
  }

  try {
    const session = await requireCustomerSession();
    const { id } = parseParams(await params, customerOrderIdParamSchema);
    const order = await getCustomerOrderById(session.customerId, id);

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "No encontramos ese ticket");
    }

    if (order.paymentStatus !== "pending") {
      throw new ApiError(409, "CONFLICT", "El pedido ya tiene un estado de pago definitivo");
    }

    const db = getDb();
    await db.execute({
      sql: `
        update customer_order set
          payment_status = 'approved',
          mp_payment_id = 'dev-skip',
          paid_at = coalesce(paid_at, datetime('now')),
          updated_at = datetime('now')
        where id = ? and customer_id = ?
      `,
      args: [id, session.customerId],
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
