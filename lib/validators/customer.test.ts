import { describe, expect, it } from "vitest";

import { createOrderSchema, customerSessionSchema } from "@/lib/validators/customer";

describe("customer validators", () => {
  it("accepts a valid customer session", () => {
    const parsed = customerSessionSchema.parse({
      name: "Catalina",
      phone: "11 5555-5555",
    });

    expect(parsed.name).toBe("Catalina");
    expect(parsed.phone).toBe("11 5555-5555");
  });

  it("requires at least one cart item for order creation", () => {
    const parsed = createOrderSchema.safeParse({
      tipCents: 0,
      items: [],
    });

    expect(parsed.success).toBe(false);
  });
});
