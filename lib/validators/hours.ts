import { z } from "zod";

export const openingHourRowSchema = z.object({
  id: z.string().uuid(),
  weekday: z.number().int().min(0).max(6),
  opens_at: z.string().nullable(),
  closes_at: z.string().nullable(),
  closed: z.boolean(),
});

export const truckConfigRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  logo_url: z.string().nullable(),
  primary_color: z.string().min(4).max(32),
  timezone: z.string().min(1),
  mp_access_token_encrypted: z.string().nullable(),
  tip_defaults_json: z.array(z.number().int().min(0).max(100)),
  beep_sound_id: z.string().min(1),
  paused_manual_at: z.string().nullable(),
  paused_reason: z.string().nullable(),
});

export const hoursPatchSchema = z.object({
  hours: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        opensAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),
        closesAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),
        closed: z.boolean(),
      }),
    )
    .length(7),
});

export const pauseTruckSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    }),
});
