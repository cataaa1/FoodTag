import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { hashPassword } from "@/lib/auth/password";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { writeAuditLog } from "@/lib/data/audit-log";
import { getDb } from "@/lib/db/client";
import { idParamSchema, staffUserUpdateSchema } from "@/lib/validators/menu";

type StaffUserRow = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role_id: string;
  active: number;
};

type StaffUserWithRoleRow = StaffUserRow & { role_name: string };

type RoleRow = {
  id: string;
  name: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const staffContext = await requireStaffPermission("users.write");
    const { id } = parseParams(await context.params, idParamSchema);
    const body = await parseJsonBody(request, staffUserUpdateSchema);
    const db = getDb();

    const currentResult = await db.execute({
      sql: "select * from staff_user where id = ?",
      args: [id],
    });
    const current = currentResult.rows[0] as unknown as StaffUserRow | undefined;

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
    }

    const nextRoleId = body.roleId ?? current.role_id;
    const roleResult = await db.execute({
      sql: "select id, name from role where id = ?",
      args: [nextRoleId],
    });
    const role = roleResult.rows[0] as unknown as RoleRow | undefined;

    if (!role) {
      throw new ApiError(400, "INVALID_INPUT", "El rol elegido ya no existe");
    }

    await db.execute({
      sql: `
        update staff_user
        set
          email = ?,
          full_name = ?,
          password_hash = ?,
          role_id = ?,
          active = ?
        where id = ?
      `,
      args: [
        body.email ?? current.email,
        body.fullName ?? current.full_name,
        body.password ? hashPassword(body.password) : current.password_hash,
        nextRoleId,
        body.active === undefined ? current.active : body.active ? 1 : 0,
        id,
      ],
    });

    await writeAuditLog({
      actorUserId: staffContext.user.id,
      action:
        body.active !== undefined &&
        body.email === undefined &&
        body.fullName === undefined &&
        body.password === undefined &&
        body.roleId === undefined
          ? body.active
            ? "staff-user.activated"
            : "staff-user.deactivated"
          : "staff-user.updated",
      targetType: "staff_user",
      targetId: id,
      metadata: {
        active: body.active === undefined ? Boolean(current.active) : body.active,
        email: body.email ?? current.email,
        fullName: body.fullName ?? current.full_name,
        roleName: role.name,
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
    const staffContext = await requireStaffPermission("users.write");
    const { id } = parseParams(await context.params, idParamSchema);
    const db = getDb();

    const currentResult = await db.execute({
      sql: `
        select staff_user.*, role.name as role_name
        from staff_user
        join role on role.id = staff_user.role_id
        where staff_user.id = ?
      `,
      args: [id],
    });
    const current = currentResult.rows[0] as unknown as StaffUserWithRoleRow | undefined;

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
    }

    await db.execute({ sql: "delete from staff_user where id = ?", args: [id] });

    await writeAuditLog({
      actorUserId: staffContext.user.id,
      action: "staff-user.deleted",
      targetType: "staff_user",
      targetId: id,
      metadata: {
        active: Boolean(current.active),
        email: current.email,
        fullName: current.full_name,
        roleName: current.role_name,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
