import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getDb } from "@/lib/db/client";
import { categoryUpdateSchema, idParamSchema } from "@/lib/validators/menu";

type CategoryRow = {
  id: string;
  name: string;
  position: number;
  visible: number;
  created_at: string;
};

function mapCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    visible: Boolean(row.visible),
    created_at: row.created_at,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffPermission("menu.write");

    const params = parseParams(await context.params, idParamSchema);
    const body = await parseJsonBody(request, categoryUpdateSchema);
    const db = getDb();
    const current = db
      .prepare<{ id: string }, CategoryRow>("select * from category where id = @id")
      .get({ id: params.id });

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Categoría no encontrada");
    }

    db.prepare(
      `
        update category set
          name = @name,
          position = @position,
          visible = @visible
        where id = @id
      `,
    ).run({
      id: params.id,
      name: body.name ?? current.name,
      position: body.position ?? current.position,
      visible:
        body.visible === undefined
          ? current.visible
          : body.visible
            ? 1
            : 0,
    });

    const category = db
      .prepare<{ id: string }, CategoryRow>("select * from category where id = @id")
      .get({ id: params.id });

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    return NextResponse.json({ category: category ? mapCategory(category) : null });
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
    getDb().prepare("delete from category where id = ?").run(params.id);

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
