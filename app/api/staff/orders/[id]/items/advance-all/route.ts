import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { advanceAllStaffOrderItems } from "@/lib/data/orders";
import { sendPushToOrder } from "@/lib/push/send";
import { orderIdParamSchema } from "@/lib/validators/orders";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffPermission("orders.advance");
    const { id } = parseParams(await context.params, orderIdParamSchema);
    const order = advanceAllStaffOrderItems(id);

    if (order?.status === "ready") {
      void sendPushToOrder(id, {
        type: "ready",
        ticket: order.ticketNumber,
        title: `¡Ticket #${order.ticketNumber} listo!`,
        body: "Pasá a retirar tu pedido.",
        tag: `order-${id}`,
        orderId: id,
      });
    }

    return NextResponse.json({ order });
  } catch (error) {
    return handleRouteError(error);
  }
}
