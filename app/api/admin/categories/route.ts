import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { categoryCreateSchema, categoryRowSchema } from "@/lib/validators/menu";

export async function GET() {
  try {
    await requireStaffPermission("menu.read");

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("category")
      .select("*")
      .order("position", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ categories: categoryRowSchema.array().parse(data) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffPermission("menu.write");

    const body = await parseJsonBody(request, categoryCreateSchema);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("category")
      .insert({
        name: body.name,
        position: body.position,
        visible: body.visible,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    return NextResponse.json({ category: categoryRowSchema.parse(data) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
