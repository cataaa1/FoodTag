import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { getPlatformSession } from "@/lib/auth/platform-session";

export async function GET() {
  try {
    const admin = await getPlatformSession();

    if (!admin) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sesión inválida" } },
        { status: 401 },
      );
    }

    return NextResponse.json({ admin });
  } catch (error) {
    return handleRouteError(error);
  }
}
