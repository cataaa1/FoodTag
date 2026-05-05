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
  try {
    const session = await requireCustomerSession();
    const { id } = parseParams(await params, customerOrderIdParamSchema);
    const order = await getCustomerOrderById(session.customerId, id);

    if (!order) {
      throw new ApiError(404, "NOT_FOUND", "No encontramos ese ticket");
    }

    if (order.paymentStatus !== "pending") {
      throw new ApiError(409, "CONFLICT", "Solo se puede cancelar un pedido que aún no fue pagado");
    }

    if (order.status === "cancelled") {
      throw new ApiError(409, "CONFLICT", "Este pedido ya está cancelado");
    }

    const db = getDb();
    await db.execute({
      sql: `
        update customer_order set
          status = 'cancelled',
          payment_status = 'cancelled',
          cancelled_at = datetime('now'),
          cancel_reason = 'Cancelado por el cliente',
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
