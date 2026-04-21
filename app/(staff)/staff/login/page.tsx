import { Suspense } from "react";

import { StaffLoginForm } from "@/components/staff/staff-login-form";

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <Suspense fallback={null}>
      <StaffLoginForm nextPath={params.next} />
    </Suspense>
  );
}
