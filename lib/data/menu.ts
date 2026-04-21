import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { MenuCategoryWithItems, MenuItem, MenuVariant } from "@/lib/types/domain";
import {
  categoryRowSchema,
  menuItemRowSchema,
  menuVariantRowSchema,
} from "@/lib/validators/menu";

function mapVariant(row: ReturnType<typeof menuVariantRowSchema.parse>): MenuVariant {
  return {
    id: row.id,
    menuItemId: row.menu_item_id,
    name: row.name,
    priceCents: row.price_cents,
    available: row.available,
    position: row.position,
  };
}

function mapMenuItem(
  row: ReturnType<typeof menuItemRowSchema.parse>,
  variants: MenuVariant[],
): MenuItem {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    photoUrl: row.photo_url,
    available: row.available,
    hasVariants: row.has_variants,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variants,
  };
}

export async function getMenuData() {
  const supabase = getSupabaseAdmin();
  const [{ data: categoriesData, error: categoriesError }, { data: itemsData, error: itemsError }, { data: variantsData, error: variantsError }] =
    await Promise.all([
      supabase.from("category").select("*").order("position", { ascending: true }),
      supabase.from("menu_item").select("*").order("position", { ascending: true }),
      supabase.from("menu_variant").select("*").order("position", { ascending: true }),
    ]);

  if (categoriesError) {
    throw new Error(categoriesError.message);
  }

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  if (variantsError) {
    throw new Error(variantsError.message);
  }

  const categories = categoryRowSchema.array().parse(categoriesData);
  const items = menuItemRowSchema.array().parse(itemsData);
  const variants = menuVariantRowSchema.array().parse(variantsData);

  return categories
    .filter((category) => category.visible)
    .map((category) => {
      const categoryItems = items
        .filter((item) => item.category_id === category.id)
        .map((item) =>
          mapMenuItem(
            item,
            variants
              .filter((variant) => variant.menu_item_id === item.id)
              .map(mapVariant),
          ),
        );

      return {
        id: category.id,
        name: category.name,
        position: category.position,
        visible: category.visible,
        createdAt: category.created_at,
        items: categoryItems,
      } satisfies MenuCategoryWithItems;
    });
}
