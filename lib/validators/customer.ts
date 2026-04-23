import { z } from "zod";

export const customerSessionSchema = z.object({
  name: z.string().trim().min(2, "Decinos tu nombre").max(60),
  phone: z
    .string()
    .trim()
    .min(6, "Ingresá un teléfono válido")
    .max(30)
    .regex(/^[0-9+\-\s()]+$/, "Usá solo números, espacios o guiones"),
});

export const orderItemInputSchema = z.object({
  menuItemId: z.string().uuid(),
  menuVariantId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1).max(99),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemInputSchema).min(1, "El carrito está vacío").max(20),
  tipCents: z.number().int().min(0).max(9_999_999).default(0),
});

export const customerOrderIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CustomerSessionInput = z.infer<typeof customerSessionSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
