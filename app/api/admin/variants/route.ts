import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { getDb } from "@/lib/db/client";
import { menuQuerySchema, variantCreateSchema } from "@/lib/validators/menu";

type VariantRow = {
  id: string;
  menu_item_id: string;
  name: string;
  price_cents: number;
  available: number;
  position: number;
};

function mapVariant(row: VariantRow) {
  return {
    ...row,
    available: Boolean(row.available),
  };
}

export async function GET(request: Request) {
  try {
    await requireStaffPermission("menu.read");

    const url = new URL(request.url);
    const query = menuQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const db = getDb();
    const variants = query.menuItemId
      ? db
          .prepare<{ menuItemId: string }, VariantRow>(
            "select * from menu_variant where menu_item_id = @menuItemId order by position asc",
          )
          .all({ menuItemId: query.menuItemId })
      : db
          .prepare<[], VariantRow>("select * from menu_variant order by position asc")
          .all();

    return NextResponse.json({ variants: variants.map(mapVariant) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffPermission("menu.write");

    const body = await parseJsonBody(request, variantCreateSchema);
    const db = getDb();
    const id = randomUUID();

    db.prepare(
      `
        insert into menu_variant (
          id, menu_item_id, name, price_cents, available, position
        )
        values (@id, @menuItemId, @name, @priceCents, @available, @position)
      `,
    ).run({
      id,
      menuItemId: body.menuItemId,
      name: body.name,
      priceCents: body.priceCents,
      available: body.available ? 1 : 0,
      position: body.position,
    });

    const variant = db
      .prepare<{ id: string }, VariantRow>("select * from menu_variant where id = @id")
      .get({ id });

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    return NextResponse.json(
      { variant: variant ? mapVariant(variant) : null },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
