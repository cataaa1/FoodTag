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
    const current = db
      .prepare<{ id: string }, StaffUserRow>("select * from staff_user where id = @id")
      .get({ id });

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
    }

    const nextRoleId = body.roleId ?? current.role_id;
    const role = db
      .prepare<{ id: string }, RoleRow>("select id, name from role where id = @id")
      .get({ id: nextRoleId });

    if (!role) {
      throw new ApiError(400, "INVALID_INPUT", "El rol elegido ya no existe");
    }

    db.prepare(
      `
        update staff_user
        set
          email = @email,
          full_name = @fullName,
          password_hash = @passwordHash,
          role_id = @roleId,
          active = @active
        where id = @id
      `,
    ).run({
      id,
      email: body.email ?? current.email,
      fullName: body.fullName ?? current.full_name,
      passwordHash: body.password ? hashPassword(body.password) : current.password_hash,
      roleId: nextRoleId,
      active: body.active === undefined ? current.active : body.active ? 1 : 0,
    });

    writeAuditLog({
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
    const current = db
      .prepare<
        { id: string },
        StaffUserRow & {
          role_name: string;
        }
      >(
        `
          select staff_user.*, role.name as role_name
          from staff_user
          join role on role.id = staff_user.role_id
          where staff_user.id = @id
        `,
      )
      .get({ id });

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
    }

    db.prepare("delete from staff_user where id = @id").run({ id });

    writeAuditLog({
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
