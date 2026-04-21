import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { getTruckStatus } from "@/lib/data/truck-status";

export async function GET() {
  try {
    const status = await getTruckStatus();
    return NextResponse.json(status);
  } catch (error) {
    return handleRouteError(error);
  }
}
