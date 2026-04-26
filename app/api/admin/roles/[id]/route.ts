import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { writeAuditLog } from "@/lib/data/audit-log";
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
    const staffContext = await requireStaffPermission("roles.manage");
    const { id } = parseParams(await context.params, idParamSchema);
    const body = await parseJsonBody(request, roleUpdateSchema);
    const db = getDb();
    const current = db
      .prepare<{ id: string }, RoleRow>("select * from role where id = @id")
      .get({ id });

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Rol no encontrado");
    }

    const nextName = body.name ?? current.name;
    const nextPermissions =
      body.permissions ?? (JSON.parse(current.permissions_json) as string[]);

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
      name: nextName,
      permissionsJson: JSON.stringify(nextPermissions),
    });

    writeAuditLog({
      actorUserId: staffContext.user.id,
      action: "role.updated",
      targetType: "role",
      targetId: id,
      metadata: {
        isSystem: Boolean(current.is_system),
        name: nextName,
        permissions: nextPermissions,
      },
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
    const staffContext = await requireStaffPermission("roles.manage");
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

    writeAuditLog({
      actorUserId: staffContext.user.id,
      action: "role.deleted",
      targetType: "role",
      targetId: id,
      metadata: {
        name: current.name,
        permissions: JSON.parse(current.permissions_json) as string[],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
