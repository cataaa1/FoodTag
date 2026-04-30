import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody, parseParams } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { writeAuditLog } from "@/lib/data/audit-log";
import { getDb } from "@/lib/db/client";
import { idParamSchema, menuItemUpdateSchema } from "@/lib/validators/menu";

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

function revalidateAdminMenuPaths() {
  revalidatePath("/menu");
  revalidatePath("/admin");
  revalidatePath("/admin/menu");
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const staffContext = await requireStaffPermission("menu.write");
    const params = parseParams(await context.params, idParamSchema);
    const body = await parseJsonBody(request, menuItemUpdateSchema);
    const db = getDb();

    const currentResult = await db.execute({
      sql: "select * from menu_item where id = ?",
      args: [params.id],
    });
    const current = currentResult.rows[0] as unknown as MenuItemRow | undefined;

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Item no encontrado");
    }

    if (body.categoryId) {
      const catResult = await db.execute({
        sql: "select id, name from category where id = ?",
        args: [body.categoryId],
      });
      if (!catResult.rows[0]) {
        throw new ApiError(400, "INVALID_INPUT", "La categoría elegida ya no existe");
      }
    }

    await db.execute({
      sql: `
        update menu_item set
          category_id = ?,
          name = ?,
          description = ?,
          price_cents = ?,
          photo_url = ?,
          available = ?,
          has_variants = ?,
          position = ?,
          updated_at = datetime('now')
        where id = ?
      `,
      args: [
        body.categoryId ?? current.category_id,
        body.name ?? current.name,
        body.description === undefined ? current.description : body.description,
        body.priceCents ?? current.price_cents,
        body.photoUrl === undefined ? current.photo_url : body.photoUrl,
        body.available === undefined ? current.available : body.available ? 1 : 0,
        body.hasVariants === undefined ? current.has_variants : body.hasVariants ? 1 : 0,
        body.position ?? current.position,
        params.id,
      ],
    });

    if (body.modifiers !== undefined) {
      await replaceModifiers(params.id, body.modifiers);
    }

    if (body.variants !== undefined || body.hasVariants !== undefined) {
      const shouldHaveVariants =
        body.hasVariants === undefined ? Boolean(current.has_variants) : body.hasVariants;
      await replaceVariants(params.id, shouldHaveVariants ? body.variants ?? [] : []);
    }

    const [itemResult, modResult, varResult] = await Promise.all([
      db.execute({ sql: "select * from menu_item where id = ?", args: [params.id] }),
      db.execute({ sql: "select * from menu_item_modifier where menu_item_id = ? order by position asc", args: [params.id] }),
      db.execute({ sql: "select * from menu_variant where menu_item_id = ? order by position asc", args: [params.id] }),
    ]);

    const item = itemResult.rows[0] as unknown as MenuItemRow | undefined;
    const modifiers = (modResult.rows as unknown as MenuModifierRow[]).map(mapModifier);
    const variants = (varResult.rows as unknown as MenuVariantRow[]).map(mapVariant);

    revalidateAdminMenuPaths();

    await writeAuditLog({
      actorUserId: staffContext.user.id,
      action:
        body.available !== undefined &&
        body.name === undefined &&
        body.description === undefined &&
        body.priceCents === undefined &&
        body.photoUrl === undefined &&
        body.hasVariants === undefined &&
        body.position === undefined &&
        body.categoryId === undefined &&
        body.modifiers === undefined &&
        body.variants === undefined
          ? "menu.item.availability.updated"
          : "menu.item.updated",
      targetType: "menu_item",
      targetId: params.id,
      metadata: {
        available: item?.available ?? Boolean(current.available),
        hasImage: Boolean(item?.photo_url ?? current.photo_url),
        hasVariants: item?.has_variants ?? Boolean(current.has_variants),
        name: item?.name ?? current.name,
      },
    });

    return NextResponse.json({
      item: item ? { ...mapItem(item), variants, modifiers } : null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const staffContext = await requireStaffPermission("menu.write");
    const params = parseParams(await context.params, idParamSchema);
    const db = getDb();

    const currentResult = await db.execute({
      sql: "select * from menu_item where id = ?",
      args: [params.id],
    });
    const current = currentResult.rows[0] as unknown as MenuItemRow | undefined;

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Item no encontrado");
    }

    await db.execute({ sql: "delete from menu_item where id = ?", args: [params.id] });

    revalidateAdminMenuPaths();

    await writeAuditLog({
      actorUserId: staffContext.user.id,
      action: "menu.item.deleted",
      targetType: "menu_item",
      targetId: params.id,
      metadata: {
        available: Boolean(current.available),
        hasImage: Boolean(current.photo_url),
        hasVariants: Boolean(current.has_variants),
        name: current.name,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
