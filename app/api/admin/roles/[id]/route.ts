import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getDb } from "@/lib/db/client";
import { idParamSchema, roleUpdateSchema } from "@/lib/validators/menu";

type RoleRow = {
  id: string;
  name: string;
  is_system: number;
  permissions_json: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffPermission("roles.manage");

    const { id } = parseParams(await context.params, idParamSchema);
    const body = await parseJsonBody(request, roleUpdateSchema);
    const db = getDb();
    const current = db
      .prepare<{ id: string }, RoleRow>("select * from role where id = @id")
      .get({ id });

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Rol no encontrado");
    }

    db.prepare(
      `
        update role
        set
          name = @name,
          permissions_json = @permissionsJson
        where id = @id
      `,
    ).run({
      id,
      name: body.name ?? current.name,
      permissionsJson: JSON.stringify(
        body.permissions ?? (JSON.parse(current.permissions_json) as string[]),
      ),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffPermission("roles.manage");

    const { id } = parseParams(await context.params, idParamSchema);
    const db = getDb();
    const current = db
      .prepare<{ id: string }, RoleRow>("select * from role where id = @id")
      .get({ id });

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Rol no encontrado");
    }

    if (current.is_system) {
      throw new ApiError(409, "CONFLICT", "No se puede eliminar un rol del sistema");
    }

    const users = db
      .prepare<{ id: string }, { count: number }>(
        "select count(*) as count from staff_user where role_id = @id",
      )
      .get({ id });

    if ((users?.count ?? 0) > 0) {
      throw new ApiError(409, "CONFLICT", "Hay usuarios usando este rol");
    }

    db.prepare("delete from role where id = @id").run({ id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
