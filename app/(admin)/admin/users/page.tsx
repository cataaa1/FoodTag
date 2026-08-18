import { redirect } from "next/navigation";

import { UsersManager } from "@/components/admin/users-manager";
import { getStaffContext } from "@/lib/auth/staff-session";

export default async function AdminUsersPage() {
  const context = await getStaffContext();

  // Las cuentas y los roles solo los administra el super admin. La API ya lo
  // rechaza; esto evita que alguien mas llegue siquiera a ver el formulario.
  if (!context?.user.isSuperAdmin) {
    redirect("/admin");
  }

  return <UsersManager />;
}
