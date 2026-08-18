import { redirect } from "next/navigation";

import { UsersManager } from "@/components/admin/users-manager";
import { getStaffContext } from "@/lib/auth/staff-session";

export default async function AdminUsersPage() {
  const context = await getStaffContext();

  // Dentro de un truck, el rol admin es el que manda: los permisos alcanzan.
  if (!context?.role.permissionsJson.includes("users.manage")) {
    redirect("/admin");
  }

  return <UsersManager />;
}
