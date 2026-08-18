import { redirect } from "next/navigation";

import { SuperadminHome } from "@/components/platform/superadmin-home";
import { getPlatformSession } from "@/lib/auth/platform-session";

export default async function SuperadminPage() {
  const admin = await getPlatformSession();

  if (!admin) {
    redirect("/staff/login?next=/superadmin");
  }

  return <SuperadminHome />;
}
