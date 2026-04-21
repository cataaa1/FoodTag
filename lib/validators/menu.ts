import { z } from "zod";

import { PERMISSIONS } from "@/lib/constants/permissions";

export const permissionSchema = z.enum(PERMISSIONS);

export const categoryRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  position: z.number().int().nonnegative(),
  visible: z.boolean(),
  created_at: z.string(),
});

export const menuVariantRowSchema = z.object({
  id: z.string().uuid(),
  menu_item_id: z.string().uuid(),
  name: z.string().min(1),
  price_cents: z.number().int().nonnegative(),
  available: z.boolean(),
  position: z.number().int().nonnegative(),
});

export const menuItemRowSchema = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  price_cents: z.number().int().nonnegative(),
  photo_url: z.string().nullable(),
  available: z.boolean(),
  has_variants: z.boolean(),
  position: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  position: z.number().int().min(0),
  visible: z.boolean().default(true),
});

export const categoryUpdateSchema = categoryCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Tenés que enviar al menos un campo",
);

export const menuItemCreateSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).nullable(),
  priceCents: z.number().int().min(0).max(999_999),
  photoUrl: z.string().url().nullable(),
  available: z.boolean().default(true),
  hasVariants: z.boolean().default(false),
  position: z.number().int().min(0),
});

export const menuItemUpdateSchema = menuItemCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Tenés que enviar al menos un campo",
);

export const variantCreateSchema = z.object({
  menuItemId: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  priceCents: z.number().int().min(0).max(999_999),
  available: z.boolean().default(true),
  position: z.number().int().min(0),
});

export const variantUpdateSchema = variantCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Tenés que enviar al menos un campo",
);

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const menuQuerySchema = z.object({
  menuItemId: z.string().uuid().optional(),
});
