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

function getCategoryLookup(categoryId: string) {
  return getDb()
    .prepare<{ id: string }, CategoryLookupRow>("select id, name from category where id = @id")
    .get({ id: categoryId });
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
    const current = db
      .prepare<{ id: string }, MenuItemRow>("select * from menu_item where id = @id")
      .get({ id: params.id });

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Item no encontrado");
    }

    if (body.categoryId && !getCategoryLookup(body.categoryId)) {
      throw new ApiError(400, "INVALID_INPUT", "La categoría elegida ya no existe");
    }

    const transaction = db.transaction(() => {
      db.prepare(
        `
          update menu_item set
            category_id = @categoryId,
            name = @name,
            description = @description,
            price_cents = @priceCents,
            photo_url = @photoUrl,
            available = @available,
            has_variants = @hasVariants,
            position = @position,
            updated_at = datetime('now')
          where id = @id
        `,
      ).run({
        id: params.id,
        categoryId: body.categoryId ?? current.category_id,
        name: body.name ?? current.name,
        description: body.description === undefined ? current.description : body.description,
        priceCents: body.priceCents ?? current.price_cents,
        photoUrl: body.photoUrl === undefined ? current.photo_url : body.photoUrl,
        available:
          body.available === undefined
            ? current.available
            : body.available
              ? 1
              : 0,
        hasVariants:
          body.hasVariants === undefined
            ? current.has_variants
            : body.hasVariants
              ? 1
              : 0,
        position: body.position ?? current.position,
      });

      if (body.modifiers !== undefined) {
        replaceModifiers(params.id, body.modifiers);
      }

      if (body.variants !== undefined || body.hasVariants !== undefined) {
        const shouldHaveVariants =
          body.hasVariants === undefined ? Boolean(current.has_variants) : body.hasVariants;
        replaceVariants(params.id, shouldHaveVariants ? body.variants ?? [] : []);
      }
    });

    transaction();

    const item = db
      .prepare<{ id: string }, MenuItemRow>("select * from menu_item where id = @id")
      .get({ id: params.id });
    const modifiers = db
      .prepare<{ id: string }, MenuModifierRow>(
        "select * from menu_item_modifier where menu_item_id = @id order by position asc",
      )
      .all({ id: params.id })
      .map(mapModifier);
    const variants = db
      .prepare<{ id: string }, MenuVariantRow>(
        "select * from menu_variant where menu_item_id = @id order by position asc",
      )
      .all({ id: params.id })
      .map(mapVariant);

    revalidateAdminMenuPaths();

    writeAuditLog({
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
    const current = db
      .prepare<{ id: string }, MenuItemRow>("select * from menu_item where id = @id")
      .get({ id: params.id });

    if (!current) {
      throw new ApiError(404, "NOT_FOUND", "Item no encontrado");
    }

    db.prepare("delete from menu_item where id = ?").run(params.id);

    revalidateAdminMenuPaths();

    writeAuditLog({
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
