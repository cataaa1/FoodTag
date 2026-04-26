import { z } from "zod";

import { PERMISSIONS } from "@/lib/constants/permissions";

export const permissionSchema = z.enum(PERMISSIONS);

const dataImageSchema = z
  .string()
  .max(2_750_000, "La imagen no puede superar los 2MB")
  .refine(
    (value) =>
      value.startsWith("data:image/jpeg;base64,") ||
      value.startsWith("data:image/png;base64,") ||
      value.startsWith("data:image/webp;base64,"),
    "UsÃ¡ una imagen JPG, PNG o WEBP",
  );

const optionalImageSchema = z.union([z.string().url(), dataImageSchema]).nullable();

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

export const menuModifierInputSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(2).max(80),
  defaultChecked: z.boolean().default(true),
  position: z.number().int().min(0),
});

export const menuVariantInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  priceCents: z.number().int().min(0).max(999_999),
  available: z.boolean().default(true),
  position: z.number().int().min(0),
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
  photoUrl: optionalImageSchema,
  available: z.boolean().default(true),
  hasVariants: z.boolean().default(false),
  position: z.number().int().min(0),
  variants: z.array(menuVariantInputSchema).max(20).default([]),
  modifiers: z.array(menuModifierInputSchema).max(20).default([]),
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

export const roleCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  permissions: z.array(permissionSchema).default([]),
});

export const roleUpdateSchema = roleCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Tenés que enviar al menos un campo",
);

export const staffUserCreateSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2).max(80),
  password: z.string().min(8).max(120),
  roleId: z.string().uuid(),
  active: z.boolean().default(true),
});

export const staffUserUpdateSchema = staffUserCreateSchema
  .omit({ password: true })
  .partial()
  .extend({
    password: z.string().min(8).max(120).optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Tenés que enviar al menos un campo",
  );
