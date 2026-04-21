import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { menuItemCreateSchema, menuItemRowSchema } from "@/lib/validators/menu";

export async function GET() {
  try {
    await requireStaffPermission("menu.read");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("menu_item")
      .select("*")
      .order("position", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ items: menuItemRowSchema.array().parse(data) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffPermission("menu.write");

    const body = await parseJsonBody(request, menuItemCreateSchema);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("menu_item")
      .insert({
        category_id: body.categoryId,
        name: body.name,
        description: body.description,
        price_cents: body.priceCents,
        photo_url: body.photoUrl,
        available: body.available,
        has_variants: body.hasVariants,
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

    return NextResponse.json({ item: menuItemRowSchema.parse(data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
