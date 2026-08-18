import { cookies } from "next/headers";

import { ApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getActiveTruckIdFromCookie,
  getPlatformAdminById,
} from "@/lib/auth/platform-session";
import { PERMISSIONS } from "@/lib/constants/permissions";
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
  truck_id: string;
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
  /** true cuando quien opera es el superadmin parado en un truck, no un empleado. */
  isPlatformAdmin: boolean;
};

function mapStaffUser(row: StaffUserRow): StaffUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    truckId: row.truck_id,
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

export async function getStaffContextById(staffUserId: string): Promise<StaffContext | null> {
  const db = getDb();

  const staffResult = await db.execute({
    sql: "select * from staff_user where id = @id and active = 1",
    args: { id: staffUserId },
  });
  const staffRow = staffResult.rows[0] as unknown as StaffUserRow | undefined;

  if (!staffRow) {
    return null;
  }

  const roleResult = await db.execute({
    sql: "select * from role where id = @id",
    args: { id: staffRow.role_id },
  });
  const roleRow = roleResult.rows[0] as unknown as RoleRow | undefined;

  if (!roleRow) {
    return null;
  }

  return {
    user: mapStaffUser(staffRow),
    role: mapRole(roleRow),
    isPlatformAdmin: false,
  };
}

/**
 * Contexto sintetico para el superadmin parado en un truck. No es empleado de
 * nadie, asi que no tiene fila en staff_user ni rol: se le da el juego completo
 * de permisos sobre el truck activo. Gracias a esto todos los endpoints del
 * panel siguen usando requireStaffPermission sin enterarse de la diferencia.
 */
function buildPlatformStaffContext(
  admin: { id: string; email: string; fullName: string },
  truckId: string,
): StaffContext {
  return {
    user: {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      truckId,
      roleId: "platform",
      active: true,
      createdAt: new Date(0).toISOString(),
    },
    role: {
      id: "platform",
      name: "superadmin",
      isSystem: true,
      permissionsJson: [...PERMISSIONS],
    },
    isPlatformAdmin: true,
  };
}

export async function authenticateStaff(email: string, password: string): Promise<StaffContext | null> {
  const db = getDb();

  const staffResult = await db.execute({
    sql: "select * from staff_user where lower(email) = lower(@email) and active = 1",
    args: { email },
  });
  const staffRow = staffResult.rows[0] as unknown as StaffUserRow | undefined;

  if (!staffRow || !verifyPassword(password, staffRow.password_hash)) {
    return null;
  }

  return getStaffContextById(staffRow.id);
}

export async function getStaffContext(): Promise<StaffContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await verifyStaffSessionToken(token);

    // La misma cookie la usa el superadmin de plataforma, que no es staff.
    if (payload.kind === "platform" || !payload.staffUserId) {
      const admin = payload.platformAdminId
        ? await getPlatformAdminById(payload.platformAdminId)
        : null;
      const activeTruckId = await getActiveTruckIdFromCookie();

      if (!admin || !activeTruckId) {
        return null;
      }

      return buildPlatformStaffContext(admin, activeTruckId);
    }

    return getStaffContextById(payload.staffUserId);
  } catch {
    return null;
  }
}

export async function requireStaffPermission(permission: PermissionKey) {
  const context = await requireStaffSession();

  if (!hasPermission(context.role.permissionsJson, permission)) {
    throw new ApiError(403, "FORBIDDEN", "No tenés permiso para esta acción");
  }

  return context;
}

/**
 * Cualquier miembro del staff autenticado, sin exigir un permiso puntual.
 * Lo usan las vistas de solo lectura (horarios) y el panel de cuenta.
 */
export async function requireStaffSession() {
  const context = await getStaffContext();

  if (!context) {
    throw new ApiError(401, "UNAUTHORIZED", "Sesión inválida");
  }

  return context;
}

