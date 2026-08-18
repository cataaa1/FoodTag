import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  STAFF_FRESH_LOGIN_COOKIE,
  STAFF_SESSION_COOKIE,
  verifyStaffSessionToken,
} from "@/lib/auth/staff-token";

const LOGIN_PATH = "/staff/login";

/**
 * Distingue una carga de pagina real (escribir la URL, F5, abrir un bookmark)
 * de una navegacion interna del App Router. Next manda el header `RSC` en las
 * navegaciones de cliente y en los prefetch; una carga de documento no.
 */
function isDocumentLoad(request: NextRequest) {
  if (request.headers.get("RSC")) return false;
  if (request.headers.get("Next-Router-Prefetch")) return false;

  return request.headers.get("sec-fetch-dest") === "document";
}

function redirectToLogin(request: NextRequest, clearSession: boolean) {
  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);

  const response = NextResponse.redirect(loginUrl);
  if (clearSession) {
    response.cookies.delete(STAFF_SESSION_COOKIE);
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === LOGIN_PATH;
  const token = request.cookies.get(STAFF_SESSION_COOKIE)?.value;

  // El login siempre se muestra, aunque haya sesion viva: es la unica forma de
  // cambiar de cuenta sin quedar atrapado en el panel del rol anterior.
  if (isLoginRoute) {
    return NextResponse.next();
  }

  if (!token) {
    return redirectToLogin(request, false);
  }

  try {
    await verifyStaffSessionToken(token);
  } catch {
    return redirectToLogin(request, true);
  }

  // Re-autenticacion obligatoria al entrar al panel de administracion.
  // El kanban queda exento a proposito: es una pantalla de cocina que se
  // refresca sola y no puede pedir credenciales en medio del servicio.
  if (pathname.startsWith("/admin") && isDocumentLoad(request)) {
    // Salvo que el usuario venga de loguearse recien: consumimos la cookie de
    // gracia y lo dejamos pasar una unica vez.
    if (!request.cookies.get(STAFF_FRESH_LOGIN_COOKIE)) {
      return redirectToLogin(request, true);
    }

    const response = NextResponse.next();
    response.cookies.delete(STAFF_FRESH_LOGIN_COOKIE);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/superadmin/:path*"],
};
