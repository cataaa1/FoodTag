import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import {
  authenticateStaff,
} from "@/lib/auth/staff-session";
import {
  createStaffSessionToken,
  STAFF_SESSION_COOKIE,
} from "@/lib/auth/staff-token";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request, bodySchema);
    const context = authenticateStaff(body.email, body.password);

    if (!context) {
      throw new ApiError(401, "UNAUTHORIZED", "Email o contraseña inválidos");
    }

    const token = await createStaffSessionToken(context.user.id);
    const response = NextResponse.json({
      user: {
        id: context.user.id,
        email: context.user.email,
        fullName: context.user.fullName,
        role: context.role.name,
      },
    });

    response.cookies.set(STAFF_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
