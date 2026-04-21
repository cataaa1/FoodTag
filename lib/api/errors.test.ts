import { describe, expect, it } from "vitest";

import { ApiError, createErrorPayload } from "@/lib/api/errors";

describe("API error helpers", () => {
  it("creates the standard error payload shape", () => {
    expect(createErrorPayload("FORBIDDEN", "No tenés permiso")).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "No tenés permiso",
      },
    });
  });

  it("preserves status, code and message in ApiError", () => {
    const error = new ApiError(403, "FORBIDDEN", "No tenés permiso");

    expect(error.status).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("No tenés permiso");
  });
});
