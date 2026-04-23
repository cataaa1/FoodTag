import { describe, expect, it } from "vitest";

import { normalizeMercadoPagoStatus } from "@/lib/payments/mercado-pago";

describe("mercado pago helpers", () => {
  it("normalizes approved and rejected statuses", () => {
    expect(normalizeMercadoPagoStatus("approved")).toBe("approved");
    expect(normalizeMercadoPagoStatus("rejected")).toBe("rejected");
  });

  it("maps terminal cancellation states to cancelled", () => {
    expect(normalizeMercadoPagoStatus("cancelled")).toBe("cancelled");
    expect(normalizeMercadoPagoStatus("refunded")).toBe("cancelled");
    expect(normalizeMercadoPagoStatus("charged_back")).toBe("cancelled");
  });

  it("keeps unknown or in-process statuses pending", () => {
    expect(normalizeMercadoPagoStatus("in_process")).toBe("pending");
    expect(normalizeMercadoPagoStatus("unknown")).toBe("pending");
  });
});
