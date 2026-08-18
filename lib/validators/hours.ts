import { z } from "zod";

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
