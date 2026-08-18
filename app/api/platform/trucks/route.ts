import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requirePlatformAdmin } from "@/lib/auth/platform-session";
import { listTrucks, provisionTruck } from "@/lib/data/trucks";

const createTruckSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80),
  address: z.string().trim().min(2, "La dirección es obligatoria").max(120),
  adminFullName: z.string().trim().min(2, "El nombre del admin es obligatorio").max(80),
  adminEmail: z.string().trim().email("Email inválido"),
  adminPassword: z.string().min(8, "Mínimo 8 caracteres").max(72),
});

export async function GET() {
  try {
    await requirePlatformAdmin();
    return NextResponse.json({ trucks: await listTrucks() });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePlatformAdmin();
    const body = await parseJsonBody(request, createTruckSchema);
    const truck = await provisionTruck(body);

    return NextResponse.json({ truck }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
