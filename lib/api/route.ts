import { z, type ZodType } from "zod";

import { ApiError } from "@/lib/api/errors";

export async function parseJsonBody<TSchema extends ZodType>(
  request: Request,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  const payload = (await request.json()) as unknown;
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new ApiError(400, "INVALID_INPUT", parsed.error.message);
  }

  return parsed.data;
}

export function parseParams<TSchema extends ZodType>(
  params: unknown,
  schema: TSchema,
): z.infer<TSchema> {
  const parsed = schema.safeParse(params);

  if (!parsed.success) {
    throw new ApiError(400, "INVALID_INPUT", parsed.error.message);
  }

  return parsed.data;
}

export function assertExists<T>(
  value: T | null | undefined,
  message: string,
): T {
  if (value === null || value === undefined) {
    throw new ApiError(404, "NOT_FOUND", message);
  }

  return value;
}
