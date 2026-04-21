import type { PermissionKey } from "@/lib/types/domain";

export function hasPermission(
  permissions: PermissionKey[],
  permission: PermissionKey,
) {
  return permissions.includes(permission);
}
