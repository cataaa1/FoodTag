import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getDb } from "@/lib/db/client";
import { idParamSchema, menuItemUpdateSchema } from "@/lib/validators/menu";

type MenuItemRow = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  photo_url: string | null;
  available: number;
  has_variants: number;
  position: number;
  created_at: string;
  updated_at: string;
};

function mapItem(row: MenuItemRow) {
  return {
    ...row,
    available: Boolean(row.available),
    has_variants: Boolean(row.has_variants),
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffPermission("menu.write");

    const params = parseParams(await context.params, idParamSchema);
    const body = await parseJsonBody(request, menuItemUpdateSchema);
    const db = getDb();
    const current = db
      .prepare<{ id: string }, MenuItemRow>("select * from menu_item where id = @id")
      .get({ id: params.id });

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Ítem no encontrado");
    }

    db.prepare(
      `
        update menu_item set
          category_id = @categoryId,
          name = @name,
          description = @description,
          price_cents = @priceCents,
          photo_url = @photoUrl,
          available = @available,
          has_variants = @hasVariants,
          position = @position,
          updated_at = datetime('now')
        where id = @id
      `,
    ).run({
      id: params.id,
      categoryId: body.categoryId ?? current.category_id,
      name: body.name ?? current.name,
      description: body.description ?? current.description,
      priceCents: body.priceCents ?? current.price_cents,
      photoUrl: body.photoUrl ?? current.photo_url,
      available:
        body.available === undefined
          ? current.available
          : body.available
            ? 1
            : 0,
      hasVariants:
        body.hasVariants === undefined
          ? current.has_variants
          : body.hasVariants
            ? 1
            : 0,
      position: body.position ?? current.position,
    });

    const item = db
      .prepare<{ id: string }, MenuItemRow>("select * from menu_item where id = @id")
      .get({ id: params.id });

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    return NextResponse.json({ item: item ? mapItem(item) : null });
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
    getDb().prepare("delete from menu_item where id = ?").run(params.id);

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
