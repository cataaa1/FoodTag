import { getDb } from "@/lib/db/client";
import type {
  MenuCategoryWithItems,
  MenuItem,
  MenuModifier,
  MenuVariant,
} from "@/lib/types/domain";

type CategoryRow = {
  id: string;
  name: string;
  position: number;
  visible: number;
  created_at: string;
};

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

type MenuVariantRow = {
  id: string;
  menu_item_id: string;
  name: string;
  price_cents: number;
  available: number;
  position: number;
};

type MenuModifierRow = {
  id: string;
  menu_item_id: string;
  label: string;
  default_checked: number;
  position: number;
};

export function mapVariant(row: MenuVariantRow): MenuVariant {
  return {
    id: row.id,
    menuItemId: row.menu_item_id,
    name: row.name,
    priceCents: row.price_cents,
    available: Boolean(row.available),
    position: row.position,
  };
}

export function mapModifier(row: MenuModifierRow): MenuModifier {
  return {
    id: row.id,
    menuItemId: row.menu_item_id,
    label: row.label,
    defaultChecked: Boolean(row.default_checked),
    position: row.position,
  };
}

export function mapMenuItem(
  row: MenuItemRow,
  variants: MenuVariant[],
  modifiers: MenuModifier[],
): MenuItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    photoUrl: row.photo_url,
    available: Boolean(row.available),
    hasVariants: Boolean(row.has_variants),
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variants,
    modifiers,
  };
}

export async function getMenuData() {
  const db = getDb();
  const [catResult, itemResult, varResult, modResult] = await Promise.all([
    db.execute("select * from category where visible = 1 order by position asc"),
    db.execute("select * from menu_item order by position asc"),
    db.execute("select * from menu_variant order by position asc"),
    db.execute("select * from menu_item_modifier order by position asc"),
  ]);

  const categories = catResult.rows as unknown as CategoryRow[];
  const items = itemResult.rows as unknown as MenuItemRow[];
  const variants = varResult.rows as unknown as MenuVariantRow[];
  const modifiers = modResult.rows as unknown as MenuModifierRow[];

  return categories.map((category) => {
    const categoryItems = items
      .filter((item) => item.category_id === category.id)
      .map((item) =>
        mapMenuItem(
          item,
          variants
            .filter((variant) => variant.menu_item_id === item.id)
            .map(mapVariant),
          modifiers
            .filter((modifier) => modifier.menu_item_id === item.id)
            .map(mapModifier),
        ),
      );

    return {
      id: category.id,
      name: category.name,
      position: category.position,
      visible: Boolean(category.visible),
      createdAt: category.created_at,
      items: categoryItems,
    } satisfies MenuCategoryWithItems;
  });
}
