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

type MenuModifierRow = {
  id: string;
  menu_item_id: string;
  label: string;
  default_checked: number;
  position: number;
};

type MenuVariantRow = {
  id: string;
  menu_item_id: string;
  name: string;
  price_cents: number;
  available: number;
  position: number;
};

type ModifierInput = {
  id?: string;
  label: string;
  defaultChecked: boolean;
  position: number;
};

type VariantInput = {
  id?: string;
  name: string;
  priceCents: number;
  available: boolean;
  position: number;
};

function mapVariant(row: MenuVariantRow) {
  return {
    id: row.id,
    menu_item_id: row.menu_item_id,
    name: row.name,
    price_cents: row.price_cents,
    available: Boolean(row.available),
    position: row.position,
  };
}

function mapModifier(row: MenuModifierRow) {
  return {
    id: row.id,
    menu_item_id: row.menu_item_id,
    label: row.label,
    default_checked: Boolean(row.default_checked),
    position: row.position,
  };
}

function mapItem(row: MenuItemRow) {
  return {
    ...row,
    available: Boolean(row.available),
    has_variants: Boolean(row.has_variants),
  };
}

function mapItemWithOptions(
  row: MenuItemRow,
  modifiers: MenuModifierRow[],
  variants: MenuVariantRow[],
) {
  return {
    ...mapItem(row),
    variants: variants.filter((variant) => variant.menu_item_id === row.id).map(mapVariant),
    modifiers: modifiers
      .filter((modifier) => modifier.menu_item_id === row.id)
      .map(mapModifier),
  };
}

function replaceVariants(menuItemId: string, variants: VariantInput[]) {
  const db = getDb();

  db.prepare("delete from menu_variant where menu_item_id = @menuItemId").run({
    menuItemId,
  });

  const insert = db.prepare(
    `
      insert into menu_variant (
        id, menu_item_id, name, price_cents, available, position
      )
      values (@id, @menuItemId, @name, @priceCents, @available, @position)
    `,
  );

  variants.forEach((variant, index) => {
    insert.run({
      id: variant.id ?? randomUUID(),
      menuItemId,
      name: variant.name,
      priceCents: variant.priceCents,
      available: variant.available ? 1 : 0,
      position: variant.position ?? index,
    });
  });
}

function replaceModifiers(menuItemId: string, modifiers: ModifierInput[]) {
  const db = getDb();

  db.prepare("delete from menu_item_modifier where menu_item_id = @menuItemId").run({
    menuItemId,
  });

  const insert = db.prepare(
    `
      insert into menu_item_modifier (
        id, menu_item_id, label, default_checked, position
      )
      values (@id, @menuItemId, @label, @defaultChecked, @position)
    `,
  );

  modifiers.forEach((modifier, index) => {
    insert.run({
      id: modifier.id ?? randomUUID(),
      menuItemId,
      label: modifier.label,
      defaultChecked: modifier.defaultChecked ? 1 : 0,
      position: modifier.position ?? index,
    });
  });
}

export async function GET() {
  try {
    await requireStaffPermission("menu.read");

    const db = getDb();
    const items = db
      .prepare<[], MenuItemRow>("select * from menu_item order by position asc")
      .all();
    const modifiers = db
      .prepare<[], MenuModifierRow>(
        "select * from menu_item_modifier order by position asc",
      )
      .all();
    const variants = db
      .prepare<[], MenuVariantRow>("select * from menu_variant order by position asc")
      .all();

    return NextResponse.json({
      items: items.map((item) => mapItemWithOptions(item, modifiers, variants)),
    });
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

    const transaction = db.transaction(() => {
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

      replaceModifiers(id, body.modifiers);
      replaceVariants(id, body.hasVariants ? body.variants : []);
    });

    transaction();

    const item = db
      .prepare<{ id: string }, MenuItemRow>("select * from menu_item where id = @id")
      .get({ id });

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    const modifiers = db
      .prepare<{ id: string }, MenuModifierRow>(
        "select * from menu_item_modifier where menu_item_id = @id order by position asc",
      )
      .all({ id });
    const variants = db
      .prepare<{ id: string }, MenuVariantRow>(
        "select * from menu_variant where menu_item_id = @id order by position asc",
      )
      .all({ id });

    return NextResponse.json(
      { item: item ? mapItemWithOptions(item, modifiers, variants) : null },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
