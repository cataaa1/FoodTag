import { z } from "zod";

export const orderIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const orderItemIdParamSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3, "Ingresa un motivo").max(180),
});

export const modificationRequestIdParamSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
});

export const customerModificationRequestSchema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        modifierLabels: z.array(z.string().trim().min(1).max(80)).max(20),
      }),
    )
    .min(1, "Elegí al menos un item para modificar")
    .max(20),
});

export const approveModificationRequestSchema = z.object({
  approved: z.boolean().optional().default(true),
});

export const rejectModificationRequestSchema = z.object({}).passthrough();
