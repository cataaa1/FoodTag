import { cookies } from "next/headers";

import { ApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/auth/permissions";
import { verifyPassword } from "@/lib/auth/password";
import {
  STAFF_SESSION_COOKIE,
  verifyStaffSessionToken,
} from "@/lib/auth/staff-token";
import { getDb } from "@/lib/db/client";
import type { PermissionKey, Role, StaffUser } from "@/lib/types/domain";
import { permissionSchema } from "@/lib/validators/menu";

type StaffUserRow = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role_id: string;
  active: number;
  created_at: string;
};

type RoleRow = {
  id: string;
  name: string;
  is_system: number;
  permissions_json: string;
};

type StaffContext = {
  user: StaffUser;
  role: Role;
};

function mapStaffUser(row: StaffUserRow): StaffUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    roleId: row.role_id,
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

function mapRole(row: RoleRow): Role {
  const parsed = permissionSchema.array().safeParse(JSON.parse(row.permissions_json));

  if (!parsed.success) {
    throw new ApiError(500, "INTERNAL", "El rol tiene permisos inválidos");
  }

  return {
    id: row.id,
    name: row.name,
    isSystem: Boolean(row.is_system),
    permissionsJson: parsed.data,
  };
}

export async function getStaffContext(): Promise<StaffContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await verifyStaffSessionToken(token);
    return getStaffContextById(payload.staffUserId);
  } catch {
    return null;
  }
}

export function getStaffContextById(staffUserId: string): StaffContext | null {
  const db = getDb();
  const staffRow = db
    .prepare<{ id: string }, StaffUserRow>(
      "select * from staff_user where id = @id and active = 1",
    )
    .get({ id: staffUserId });

  if (!staffRow) {
    return null;
  }

  const roleRow = db
    .prepare<{ id: string }, RoleRow>("select * from role where id = @id")
    .get({ id: staffRow.role_id });

  if (!roleRow) {
    return null;
  }

  return {
    user: mapStaffUser(staffRow),
    role: mapRole(roleRow),
  };
}

export function authenticateStaff(email: string, password: string): StaffContext | null {
  const db = getDb();
  const staffRow = db
    .prepare<{ email: string }, StaffUserRow>(
      "select * from staff_user where lower(email) = lower(@email) and active = 1",
    )
    .get({ email });

  if (!staffRow || !verifyPassword(password, staffRow.password_hash)) {
    return null;
  }

  return getStaffContextById(staffRow.id);
}

export async function requireStaffPermission(permission: PermissionKey) {
  const context = await getStaffContext();

  if (!context) {
    throw new ApiError(401, "UNAUTHORIZED", "Sesión inválida");
  }

  if (!hasPermission(context.role.permissionsJson, permission)) {
    throw new ApiError(403, "FORBIDDEN", "No tenés permiso para esta acción");
  }

  return context;
}
