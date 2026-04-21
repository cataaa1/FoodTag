import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { hashPassword } from "@/lib/auth/password";
import { requireStaffPermission } from "@/lib/auth/staff-session";
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffPermission("users.manage");

    const { id } = parseParams(await context.params, idParamSchema);
    const body = await parseJsonBody(request, staffUserUpdateSchema);
    const db = getDb();
    const current = db
      .prepare<{ id: string }, StaffUserRow>("select * from staff_user where id = @id")
      .get({ id });

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
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
      passwordHash: body.password
        ? hashPassword(body.password)
        : current.password_hash,
      roleId: body.roleId ?? current.role_id,
      active:
        body.active === undefined ? current.active : body.active ? 1 : 0,
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
    await requireStaffPermission("users.manage");

    const { id } = parseParams(await context.params, idParamSchema);
    getDb().prepare("delete from staff_user where id = @id").run({ id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
