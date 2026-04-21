import { NextResponse } from "next/server";

import { STAFF_SESSION_COOKIE } from "@/lib/auth/staff-token";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(STAFF_SESSION_COOKIE);
  return response;
}
