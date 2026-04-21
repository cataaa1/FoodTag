import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  idParamSchema,
  menuVariantRowSchema,
  variantUpdateSchema,
} from "@/lib/validators/menu";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireStaffPermission("menu.write");

    const params = parseParams(await context.params, idParamSchema);
    const body = await parseJsonBody(request, variantUpdateSchema);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("menu_variant")
      .update({
        menu_item_id: body.menuItemId,
        name: body.name,
        price_cents: body.priceCents,
        available: body.available,
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

    return NextResponse.json({ variant: menuVariantRowSchema.parse(data) });
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
    const { error } = await supabase.from("menu_variant").delete().eq("id", params.id);

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
