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
    const currentResult = await db.execute({
      sql: "select * from role where id = ?",
      args: [id],
    });
    const current = currentResult.rows[0] as unknown as RoleRow | undefined;

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Rol no encontrado");
    }

    const nextName = body.name ?? current.name;
    const nextPermissions =
      body.permissions ?? (JSON.parse(current.permissions_json) as string[]);

    await db.execute({
      sql: `
        update role
        set
          name = ?,
          permissions_json = ?
        where id = ?
      `,
      args: [nextName, JSON.stringify(nextPermissions), id],
    });

    await writeAuditLog({
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
    const currentResult = await db.execute({
      sql: "select * from role where id = ?",
      args: [id],
    });
    const current = currentResult.rows[0] as unknown as RoleRow | undefined;

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Rol no encontrado");
    }

    if (current.is_system) {
      throw new ApiError(409, "CONFLICT", "No se puede eliminar un rol del sistema");
    }

    const usersResult = await db.execute({
      sql: "select count(*) as count from staff_user where role_id = ?",
      args: [id],
    });
    const users = usersResult.rows[0] as unknown as { count: number } | undefined;

    if ((users?.count ?? 0) > 0) {
      throw new ApiError(409, "CONFLICT", "Hay usuarios usando este rol");
    }

    await db.execute({ sql: "delete from role where id = ?", args: [id] });

    await writeAuditLog({
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
