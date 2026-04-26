import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { hashPassword } from "@/lib/auth/password";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { writeAuditLog } from "@/lib/data/audit-log";
import { getDb } from "@/lib/db/client";
import { staffUserCreateSchema } from "@/lib/validators/menu";

type StaffUserRow = {
  id: string;
  email: string;
  full_name: string;
  role_id: string;
  active: number;
  created_at: string;
  role_name: string;
};

type RoleRow = {
  id: string;
  name: string;
};

function mapStaffUser(row: StaffUserRow) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role_id: row.role_id,
    active: Boolean(row.active),
    created_at: row.created_at,
    role_name: row.role_name,
  };
}

export async function GET() {
  try {
    await requireStaffPermission("users.manage");

    const users = getDb()
      .prepare<[], StaffUserRow>(
        `
          select staff_user.*, role.name as role_name
          from staff_user
          join role on role.id = staff_user.role_id
          order by staff_user.created_at desc
        `,
      )
      .all()
      .map(mapStaffUser);

    return NextResponse.json({ users });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireStaffPermission("users.write");
    const body = await parseJsonBody(request, staffUserCreateSchema);
    const db = getDb();
    const id = randomUUID();
    const role = db
      .prepare<{ id: string }, RoleRow>("select id, name from role where id = @id")
      .get({ id: body.roleId });

    if (!role) {
      throw new ApiError(400, "INVALID_INPUT", "El rol elegido ya no existe");
    }

    db.prepare(
      `
        insert into staff_user (
          id, email, full_name, password_hash, role_id, active
        )
        values (@id, @email, @fullName, @passwordHash, @roleId, @active)
      `,
    ).run({
      id,
      email: body.email,
      fullName: body.fullName,
      passwordHash: hashPassword(body.password),
      roleId: body.roleId,
      active: body.active ? 1 : 0,
    });

    writeAuditLog({
      actorUserId: context.user.id,
      action: "staff-user.created",
      targetType: "staff_user",
      targetId: id,
      metadata: {
        active: body.active,
        email: body.email,
        fullName: body.fullName,
        roleName: role.name,
      },
    });

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
