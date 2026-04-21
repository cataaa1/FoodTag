import { describe, expect, it } from "vitest";

import { hasPermission } from "@/lib/auth/permissions";

describe("hasPermission", () => {
  it("returns true when the permission exists", () => {
    expect(hasPermission(["menu.read", "menu.write"], "menu.write")).toBe(true);
  });

  it("returns false when the permission is missing", () => {
    expect(hasPermission(["menu.read"], "hours.write")).toBe(false);
  });
});
