import { z } from "zod";

const dataImageSchema = z
  .string()
  .max(2_750_000, "La imagen no puede superar los 2MB")
  .refine(
    (value) =>
      value.startsWith("data:image/jpeg;base64,") ||
      value.startsWith("data:image/png;base64,") ||
      value.startsWith("data:image/webp;base64,"),
    "Usá una imagen JPG, PNG o WEBP",
  );

const beepSoundSchema = z.enum(["classic", "soft", "marcado"]);

export const adminSettingsPatchSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(80),
  // Identificador de la URL publica del truck: foodtag.app/t/<slug>
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Mínimo 3 caracteres")
    .max(40)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Usá solo minúsculas, números y guiones (sin espacios ni acentos)",
    ),
  address: z.string().trim().min(2, "La dirección es obligatoria").max(120),
  publicTagline: z.string().trim().min(2).max(140),
  instagramHandle: z.string().trim().max(40).nullable(),
  brandIcon: z.string().trim().min(1).max(12),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido"),
  timezone: z.string().trim().min(3).max(80),
  logoUrl: dataImageSchema.nullable(),
  heroImageUrl: dataImageSchema.nullable(),
  allowOrderModifications: z.boolean(),
  beepSoundId: beepSoundSchema,
  customerPickupCooldownSeconds: z.number().int().min(0).max(300),
  /**
   * Token de Mercado Pago del truck. Solo se envia cuando se quiere cambiar:
   *   undefined -> dejar el que ya estaba
   *   ""        -> borrarlo y volver al de las variables de entorno
   */
  mpAccessToken: z.string().trim().max(500).optional(),
});
