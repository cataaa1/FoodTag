import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { authenticatePlatformAdmin } from "@/lib/auth/platform-session";
import { authenticateStaff } from "@/lib/auth/staff-session";
import {
  createPlatformSessionToken,
  createStaffSessionToken,
  STAFF_FRESH_LOGIN_COOKIE,
  STAFF_FRESH_LOGIN_MAX_AGE_SECONDS,
  STAFF_SESSION_COOKIE,
} from "@/lib/auth/staff-token";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, bodySchema);

    // Una sola pantalla de login para los dos tipos de cuenta. El superadmin no
    // es empleado de ningun truck, asi que vive en otra tabla.
    const platformAdmin = await authenticatePlatformAdmin(body.email, body.password);
    const context = platformAdmin
      ? null
      : await authenticateStaff(body.email, body.password);

    if (!platformAdmin && !context) {
      throw new ApiError(401, "UNAUTHORIZED", "Email o contraseña inválidos");
    }

    const token = platformAdmin
      ? await createPlatformSessionToken(platformAdmin.id)
      : await createStaffSessionToken(context!.user.id);

    const response = NextResponse.json(
      platformAdmin
        ? {
            user: {
              id: platformAdmin.id,
              email: platformAdmin.email,
              fullName: platformAdmin.fullName,
              role: "superadmin",
            },
            redirectTo: "/superadmin",
          }
        : {
            user: {
              id: context!.user.id,
              email: context!.user.email,
              fullName: context!.user.fullName,
              role: context!.role.name,
            },
            redirectTo: null,
          },
    );

    response.cookies.set(STAFF_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    response.cookies.set(STAFF_FRESH_LOGIN_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: STAFF_FRESH_LOGIN_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
