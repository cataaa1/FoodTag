import { NextResponse } from "next/server";

import {
  STAFF_FRESH_LOGIN_COOKIE,
  STAFF_SESSION_COOKIE,
} from "@/lib/auth/staff-token";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(STAFF_SESSION_COOKIE);
  response.cookies.delete(STAFF_FRESH_LOGIN_COOKIE);
  return response;
}
