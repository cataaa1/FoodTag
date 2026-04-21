import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseMiddlewareClient } from "@/lib/supabase/server";

export async function middleware(request: NextRequest) {
  const isLoginRoute = request.nextUrl.pathname === "/staff/login";

  try {
    const { supabase, response } = createSupabaseMiddlewareClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isLoginRoute) {
      const loginUrl = new URL("/staff/login", request.url);
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user && isLoginRoute) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    return response;
  } catch {
    return isLoginRoute ? NextResponse.next() : NextResponse.redirect(new URL("/staff/login", request.url));
  }
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*"],
};
