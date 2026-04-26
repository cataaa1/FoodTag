import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { getStaffContext } from "@/lib/auth/staff-session";

export async function GET() {
  try {
    const context = await getStaffContext();

    if (!context) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sesión inválida" } },
        { status: 401 },
      );
    }

    return NextResponse.json({
      staffUser: {
        id: context.user.id,
        email: context.user.email,
        fullName: context.user.fullName,
      },
      permissions: context.role.permissionsJson,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
