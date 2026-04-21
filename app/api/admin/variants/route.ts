import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  menuQuerySchema,
  menuVariantRowSchema,
  variantCreateSchema,
} from "@/lib/validators/menu";

export async function GET(request: Request) {
  try {
    await requireStaffPermission("menu.read");

    const url = new URL(request.url);
    const query = menuQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const supabase = getSupabaseAdmin();
    let builder = supabase
      .from("menu_variant")
      .select("*")
      .order("position", { ascending: true });

    if (query.menuItemId) {
      builder = builder.eq("menu_item_id", query.menuItemId);
    }

    const { data, error } = await builder;

    if (error) {
      throw error;
    }

    return NextResponse.json({ variants: menuVariantRowSchema.array().parse(data) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffPermission("menu.write");

    const body = await parseJsonBody(request, variantCreateSchema);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("menu_variant")
      .insert({
        menu_item_id: body.menuItemId,
        name: body.name,
        price_cents: body.priceCents,
        available: body.available,
        position: body.position,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    return NextResponse.json(
      { variant: menuVariantRowSchema.parse(data) },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
