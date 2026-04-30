import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { writeAuditLog } from "@/lib/data/audit-log";
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
    const staffContext = await requireStaffPermission("menu.write");

    const params = parseParams(await context.params, idParamSchema);
    const body = await parseJsonBody(request, categoryUpdateSchema);
    const db = getDb();
    const currentResult = await db.execute({
      sql: "select * from category where id = ?",
      args: [params.id],
    });
    const current = currentResult.rows[0] as unknown as CategoryRow | undefined;

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Categoría no encontrada");
    }

    await db.execute({
      sql: `
        update category set
          name = ?,
          position = ?,
          visible = ?
        where id = ?
      `,
      args: [
        body.name ?? current.name,
        body.position ?? current.position,
        body.visible === undefined ? current.visible : body.visible ? 1 : 0,
        params.id,
      ],
    });

    const categoryResult = await db.execute({
      sql: "select * from category where id = ?",
      args: [params.id],
    });
    const category = categoryResult.rows[0] as unknown as CategoryRow | undefined;

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    await writeAuditLog({
      actorUserId: staffContext.user.id,
      action: "menu.category.updated",
      targetType: "category",
      targetId: params.id,
      metadata: {
        before: mapCategory(current),
        after: category ? mapCategory(category) : null,
      },
    });

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
    const staffContext = await requireStaffPermission("menu.write");

    const params = parseParams(await context.params, idParamSchema);
    const db = getDb();
    const currentResult = await db.execute({
      sql: "select * from category where id = ?",
      args: [params.id],
    });
    const current = currentResult.rows[0] as unknown as CategoryRow | undefined;

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Categoría no encontrada");
    }

    await db.execute({ sql: "delete from category where id = ?", args: [params.id] });

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    await writeAuditLog({
      actorUserId: staffContext.user.id,
      action: "menu.category.deleted",
      targetType: "category",
      targetId: params.id,
      metadata: mapCategory(current),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
