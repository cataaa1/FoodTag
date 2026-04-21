import { ApiError } from "@/lib/api/errors";
import { hasPermission } from "@/lib/auth/permissions";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PermissionKey, Role, StaffUser } from "@/lib/types/domain";
import { permissionSchema } from "@/lib/validators/menu";

type StaffContext = {
  user: StaffUser;
  role: Role;
};

export async function getStaffContext(): Promise<StaffContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  const admin = getSupabaseAdmin();
  const { data: staffRow, error: staffError } = await admin
    .from("staff_user")
    .select("id, email, full_name, role_id, active, created_at")
    .eq("id", authUser.id)
    .maybeSingle();

  if (staffError) {
    throw new ApiError(500, "INTERNAL", staffError.message);
  }

  if (!staffRow || !staffRow.active) {
    return null;
  }

  const { data: roleRow, error: roleError } = await admin
    .from("role")
    .select("id, name, is_system, permissions_json")
    .eq("id", staffRow.role_id)
    .maybeSingle();

  if (roleError) {
    throw new ApiError(500, "INTERNAL", roleError.message);
  }

  if (!roleRow) {
    return null;
  }

  const permissionsResult = permissionSchema.array().safeParse(roleRow.permissions_json);

  if (!permissionsResult.success) {
    throw new ApiError(500, "INTERNAL", "El rol tiene permisos inválidos");
  }

  return {
    user: {
      id: staffRow.id,
      email: staffRow.email,
      fullName: staffRow.full_name,
      roleId: staffRow.role_id,
      active: staffRow.active,
      createdAt: staffRow.created_at,
    },
    role: {
      id: roleRow.id,
      name: roleRow.name,
      isSystem: roleRow.is_system,
      permissionsJson: permissionsResult.data,
    },
  };
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
