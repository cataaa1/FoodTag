import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getDb } from "@/lib/db/client";
import { menuItemCreateSchema } from "@/lib/validators/menu";

type MenuItemRow = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  photo_url: string | null;
  available: number;
  has_variants: number;
  position: number;
  created_at: string;
  updated_at: string;
};

function mapItem(row: MenuItemRow) {
  return {
    ...row,
    available: Boolean(row.available),
    has_variants: Boolean(row.has_variants),
  };
}

export async function GET() {
  try {
    await requireStaffPermission("menu.read");

    const items = getDb()
      .prepare<[], MenuItemRow>("select * from menu_item order by position asc")
      .all()
      .map(mapItem);

    return NextResponse.json({ items });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffPermission("menu.write");

    const body = await parseJsonBody(request, menuItemCreateSchema);
    const db = getDb();
    const id = randomUUID();

    db.prepare(
      `
        insert into menu_item (
          id, category_id, name, description, price_cents, photo_url,
          available, has_variants, position
        )
        values (
          @id, @categoryId, @name, @description, @priceCents, @photoUrl,
          @available, @hasVariants, @position
        )
      `,
    ).run({
      id,
      categoryId: body.categoryId,
      name: body.name,
      description: body.description,
      priceCents: body.priceCents,
      photoUrl: body.photoUrl,
      available: body.available ? 1 : 0,
      hasVariants: body.hasVariants ? 1 : 0,
      position: body.position,
    });

    const item = db
      .prepare<{ id: string }, MenuItemRow>("select * from menu_item where id = @id")
      .get({ id });

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    return NextResponse.json({ item: item ? mapItem(item) : null }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
