import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { getMenuData } from "@/lib/data/menu";

export async function GET() {
  try {
    const categories = await getMenuData();
    return NextResponse.json({ categories });
  } catch (error) {
    return handleRouteError(error);
  }
}
