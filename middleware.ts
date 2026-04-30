import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  STAFF_SESSION_COOKIE,
  verifyStaffSessionToken,
} from "@/lib/auth/staff-token";

export async function middleware(request: NextRequest) {
  const isLoginRoute = request.nextUrl.pathname === "/staff/login";
  const token = request.cookies.get(STAFF_SESSION_COOKIE)?.value;

  if (!token && !isLoginRoute) {
    const loginUrl = new URL("/staff/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!token) {
    return NextResponse.next();
  }

  try {
    await verifyStaffSessionToken(token);

    if (isLoginRoute) {
      return NextResponse.redirect(new URL("/staff/kanban", request.url));
    }

    return NextResponse.next();
  } catch {
    const response = isLoginRoute
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/staff/login", request.url));
    response.cookies.delete(STAFF_SESSION_COOKIE);
    return response;
  }
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*"],
};
