import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  idParamSchema,
  menuItemRowSchema,
  menuItemUpdateSchema,
} from "@/lib/validators/menu";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffPermission("menu.write");

    const params = parseParams(await context.params, idParamSchema);
    const body = await parseJsonBody(request, menuItemUpdateSchema);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("menu_item")
      .update({
        category_id: body.categoryId,
        name: body.name,
        description: body.description,
        price_cents: body.priceCents,
        photo_url: body.photoUrl,
        available: body.available,
        has_variants: body.hasVariants,
        position: body.position,
      })
      .eq("id", params.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    return NextResponse.json({ item: menuItemRowSchema.parse(data) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffPermission("menu.write");

    const params = parseParams(await context.params, idParamSchema);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("menu_item").delete().eq("id", params.id);

    if (error) {
      throw error;
    }

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
