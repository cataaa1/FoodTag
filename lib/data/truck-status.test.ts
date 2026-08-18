import { describe, expect, it } from "vitest";

import { buildTruckStatus } from "@/lib/data/truck-status";
import type { OpeningHours, TruckConfig } from "@/lib/types/domain";

const baseConfig: TruckConfig = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "FoodTag Truck",
  slug: "foodtag-truck",
  address: "Av. Corrientes 1500",
  heroImageUrl: null,
  publicTagline: "Food Truck · Av. Corrientes 1500",
  instagramHandle: null,
  brandIcon: "🚚",
  allowOrderModifications: true,
  logoUrl: null,
  primaryColor: "#F97316",
  timezone: "UTC",
  mpAccessTokenEncrypted: null,
  tipDefaultsJson: [0, 5, 10, 15],
  beepSoundId: "classic",
  customerPickupCooldownSeconds: 15,
  pausedManualAt: null,
  pausedReason: null,
  brandingVersion: "20260101000000-20260101000000",
};

const baseHours: OpeningHours[] = [
  { id: "1", weekday: 0, opensAt: "12:00:00", closesAt: "23:00:00", closed: false },
  { id: "2", weekday: 1, opensAt: "12:00:00", closesAt: "23:00:00", closed: false },
  { id: "3", weekday: 2, opensAt: "12:00:00", closesAt: "23:00:00", closed: false },
  { id: "4", weekday: 3, opensAt: "12:00:00", closesAt: "23:00:00", closed: false },
  { id: "5", weekday: 4, opensAt: "12:00:00", closesAt: "23:00:00", closed: false },
  { id: "6", weekday: 5, opensAt: "12:00:00", closesAt: "23:00:00", closed: false },
  { id: "7", weekday: 6, opensAt: "12:00:00", closesAt: "23:00:00", closed: false },
];

describe("buildTruckStatus", () => {
  it("returns a coherent shape when the truck is scheduled", () => {
    const status = buildTruckStatus(baseConfig, baseHours);

    expect(status.truckName).toBe("FoodTag Truck");
    expect(status.primaryColor).toBe("#F97316");
    expect(status.customerPickupCooldownSeconds).toBe(15);
    expect(typeof status.isOpen).toBe("boolean");
    expect(status.todayHoursLabel).toContain("a");
  });

  it("forces the truck to closed when a manual pause exists", () => {
    const status = buildTruckStatus(
      {
        ...baseConfig,
        pausedManualAt: "2026-04-20T12:00:00.000Z",
        pausedReason: "Sin gas",
      },
      baseHours,
    );

    expect(status.isOpen).toBe(false);
    expect(status.paused).toBe(true);
    expect(status.reason).toBe("Sin gas");
  });
});
