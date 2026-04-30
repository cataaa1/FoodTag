import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getDb } from "@/lib/db/client";
import { idParamSchema, variantUpdateSchema } from "@/lib/validators/menu";

type VariantRow = {
  id: string;
  menu_item_id: string;
  name: string;
  price_cents: number;
  available: number;
  position: number;
};

function mapVariant(row: VariantRow) {
  return {
    ...row,
    available: Boolean(row.available),
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffPermission("menu.write");

    const params = parseParams(await context.params, idParamSchema);
    const body = await parseJsonBody(request, variantUpdateSchema);
    const db = getDb();

    const currentResult = await db.execute({
      sql: "select * from menu_variant where id = ?",
      args: [params.id],
    });
    const current = currentResult.rows[0] as unknown as VariantRow | undefined;

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Variante no encontrada");
    }

    await db.execute({
      sql: `
        update menu_variant set
          menu_item_id = ?,
          name = ?,
          price_cents = ?,
          available = ?,
          position = ?
        where id = ?
      `,
      args: [
        body.menuItemId ?? current.menu_item_id,
        body.name ?? current.name,
        body.priceCents ?? current.price_cents,
        body.available === undefined ? current.available : body.available ? 1 : 0,
        body.position ?? current.position,
        params.id,
      ],
    });

    const variantResult = await db.execute({
      sql: "select * from menu_variant where id = ?",
      args: [params.id],
    });
    const variant = variantResult.rows[0] as unknown as VariantRow | undefined;

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    return NextResponse.json({ variant: variant ? mapVariant(variant) : null });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffPermission("menu.write");

    const params = parseParams(await context.params, idParamSchema);
    await getDb().execute({
      sql: "delete from menu_variant where id = ?",
      args: [params.id],
    });

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
