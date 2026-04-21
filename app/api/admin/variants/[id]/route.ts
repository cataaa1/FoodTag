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
    const current = db
      .prepare<{ id: string }, VariantRow>("select * from menu_variant where id = @id")
      .get({ id: params.id });

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Variante no encontrada");
    }

    db.prepare(
      `
        update menu_variant set
          menu_item_id = @menuItemId,
          name = @name,
          price_cents = @priceCents,
          available = @available,
          position = @position
        where id = @id
      `,
    ).run({
      id: params.id,
      menuItemId: body.menuItemId ?? current.menu_item_id,
      name: body.name ?? current.name,
      priceCents: body.priceCents ?? current.price_cents,
      available:
        body.available === undefined
          ? current.available
          : body.available
            ? 1
            : 0,
      position: body.position ?? current.position,
    });

    const variant = db
      .prepare<{ id: string }, VariantRow>("select * from menu_variant where id = @id")
      .get({ id: params.id });

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
    getDb().prepare("delete from menu_variant where id = ?").run(params.id);

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
