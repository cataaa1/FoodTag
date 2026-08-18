import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { writeAuditLog } from "@/lib/data/audit-log";
import { getCurrentTruckId } from "@/lib/data/truck-status";
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

type CategoryLookupRow = {
  id: string;
  name: string;
};

function mapVariant(row: MenuVariantRow) {
  return { ...row, available: Boolean(row.available) };
}

function mapModifier(row: MenuModifierRow) {
  return { ...row, default_checked: Boolean(row.default_checked) };
}

function mapItem(row: MenuItemRow) {
  return { ...row, available: Boolean(row.available), has_variants: Boolean(row.has_variants) };
}

function mapItemWithOptions(
  row: MenuItemRow,
  modifiers: MenuModifierRow[],
  variants: MenuVariantRow[],
) {
  return {
    ...mapItem(row),
    variants: variants.filter((v) => v.menu_item_id === row.id).map(mapVariant),
    modifiers: modifiers.filter((m) => m.menu_item_id === row.id).map(mapModifier),
  };
}

async function replaceVariants(menuItemId: string, variants: VariantInput[]) {
  const db = getDb();
  const statements = [
    { sql: "delete from menu_variant where menu_item_id = ?", args: [menuItemId] },
    ...variants.map((variant, index) => ({
      sql: `
        insert into menu_variant (id, menu_item_id, name, price_cents, available, position)
        values (?, ?, ?, ?, ?, ?)
      `,
      args: [
        variant.id ?? randomUUID(),
        menuItemId,
        variant.name,
        variant.priceCents,
        variant.available ? 1 : 0,
        variant.position ?? index,
      ],
    })),
  ];
  await db.batch(statements, "write");
}

async function replaceModifiers(menuItemId: string, modifiers: ModifierInput[]) {
  const db = getDb();
  const statements = [
    { sql: "delete from menu_item_modifier where menu_item_id = ?", args: [menuItemId] },
    ...modifiers.map((modifier, index) => ({
      sql: `
        insert into menu_item_modifier (id, menu_item_id, label, default_checked, position)
        values (?, ?, ?, ?, ?)
      `,
      args: [
        modifier.id ?? randomUUID(),
        menuItemId,
        modifier.label,
        modifier.defaultChecked ? 1 : 0,
        modifier.position ?? index,
      ],
    })),
  ];
  await db.batch(statements, "write");
}

export async function GET() {
  try {
    await requireStaffPermission("menu.read");

    const db = getDb();
    const truckId = await getCurrentTruckId();
    const [itemResult, modResult, varResult] = await Promise.all([
      db.execute({
        sql: "select * from menu_item where truck_id = ? order by position asc",
        args: [truckId],
      }),
      db.execute({
        sql: `
          select menu_item_modifier.* from menu_item_modifier
          join menu_item on menu_item.id = menu_item_modifier.menu_item_id
          where menu_item.truck_id = ?
          order by menu_item_modifier.position asc
        `,
        args: [truckId],
      }),
      db.execute({
        sql: `
          select menu_variant.* from menu_variant
          join menu_item on menu_item.id = menu_variant.menu_item_id
          where menu_item.truck_id = ?
          order by menu_variant.position asc
        `,
        args: [truckId],
      }),
    ]);

    const items = itemResult.rows as unknown as MenuItemRow[];
    const modifiers = modResult.rows as unknown as MenuModifierRow[];
    const variants = varResult.rows as unknown as MenuVariantRow[];

    return NextResponse.json({
      items: items.map((item) => mapItemWithOptions(item, modifiers, variants)),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireStaffPermission("menu.write");

    const body = await parseJsonBody(request, menuItemCreateSchema);
    const db = getDb();
    const id = randomUUID();

    const categoryResult = await db.execute({
      sql: "select id, name from category where id = ?",
      args: [body.categoryId],
    });
    const category = categoryResult.rows[0] as unknown as CategoryLookupRow | undefined;

    if (!category) {
      throw new ApiError(400, "INVALID_INPUT", "La categoría elegida ya no existe");
    }

    await db.execute({
      sql: `
        insert into menu_item (
          id, truck_id, category_id, name, description, price_cents, photo_url,
          available, has_variants, position
        )
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        await getCurrentTruckId(),
        body.categoryId,
        body.name,
        body.description,
        body.priceCents,
        body.photoUrl,
        body.available ? 1 : 0,
        body.hasVariants ? 1 : 0,
        body.position,
      ],
    });

    await replaceModifiers(id, body.modifiers);
    await replaceVariants(id, body.hasVariants ? body.variants : []);

    const [itemResult, modResult, varResult] = await Promise.all([
      db.execute({ sql: "select * from menu_item where id = ?", args: [id] }),
      db.execute({ sql: "select * from menu_item_modifier where menu_item_id = ? order by position asc", args: [id] }),
      db.execute({ sql: "select * from menu_variant where menu_item_id = ? order by position asc", args: [id] }),
    ]);

    const item = itemResult.rows[0] as unknown as MenuItemRow | undefined;
    const modifiers = modResult.rows as unknown as MenuModifierRow[];
    const variants = varResult.rows as unknown as MenuVariantRow[];

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "menu.item.created",
      targetType: "menu_item",
      targetId: id,
      metadata: {
        available: body.available,
        categoryName: category.name,
        hasImage: Boolean(body.photoUrl),
        hasVariants: body.hasVariants,
        name: body.name,
      },
    });

    return NextResponse.json(
      { item: item ? mapItemWithOptions(item, modifiers, variants) : null },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
