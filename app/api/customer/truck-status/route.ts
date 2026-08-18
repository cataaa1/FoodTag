import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { getPublicTruckId, getTruckStatus } from "@/lib/data/truck-status";

export async function GET() {
  try {
    const status = await getTruckStatus(await getPublicTruckId());
    return NextResponse.json(status);
  } catch (error) {
    return handleRouteError(error);
  }
}
