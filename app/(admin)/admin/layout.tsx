import { redirect } from "next/navigation";

import { getStaffContext } from "@/lib/auth/staff-session";

/**
 * Gate de servidor para todo el panel. El middleware ya valida el JWT, pero
 * solo mira la firma: no sabe si el usuario sigue existiendo o si lo
 * desactivaron. Aca resolvemos el contexto real contra la base antes de
 * renderizar cualquier pagina de /admin.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getStaffContext();

  if (!context) {
    redirect("/staff/login?next=/admin");
  }

  return children;
}
