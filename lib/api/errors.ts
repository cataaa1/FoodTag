import { NextResponse } from "next/server";

import type { ApiErrorCode, ApiErrorPayload } from "@/lib/types/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createErrorPayload(
  code: ApiErrorCode,
  message: string,
): ApiErrorPayload {
  return {
    error: {
      code,
      message,
    },
  };
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
) {
  return NextResponse.json(createErrorPayload(code, message), { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof ApiError) {
    return errorResponse(error.code, error.message, error.status);
  }

  const message =
    error instanceof Error ? error.message : "Ocurrió un error inesperado";

  return errorResponse("INTERNAL", message, 500);
}
