import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { writeAuditLog } from "@/lib/data/audit-log";
import { getTruckConfig } from "@/lib/data/truck-status";
import { getDb } from "@/lib/db/client";
import { adminSettingsPatchSchema } from "@/lib/validators/settings";

export async function GET() {
  try {
    await requireStaffPermission("settings.write");
    const config = await getTruckConfig();

    return NextResponse.json({ settings: config });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireStaffPermission("settings.write");
    const body = await parseJsonBody(request, adminSettingsPatchSchema);
    const config = await getTruckConfig();
    const db = getDb();

    const transaction = db.transaction(() => {
      db.prepare(
        `
          update truck_config set
            name = @name,
            logo_url = @logoUrl,
            brand_icon = @brandIcon,
            primary_color = @primaryColor,
            timezone = @timezone,
            beep_sound_id = @beepSoundId,
            customer_pickup_cooldown_seconds = @customerPickupCooldownSeconds,
            updated_at = datetime('now')
          where id = @id
        `,
      ).run({
        id: config.id,
        name: body.name,
        logoUrl: body.logoUrl,
        brandIcon: body.brandIcon,
        primaryColor: body.primaryColor,
        timezone: body.timezone,
        beepSoundId: body.beepSoundId,
        customerPickupCooldownSeconds: body.customerPickupCooldownSeconds,
      });

      db.prepare(
        `
          insert into truck_profile (
            id, truck_config_id, address, hero_image_url,
            public_tagline, instagram_handle, allow_order_modifications, updated_at
          )
          values (
            @id, @truckConfigId, @address, @heroImageUrl,
            @publicTagline, @instagramHandle, @allowOrderModifications, datetime('now')
          )
          on conflict(truck_config_id) do update set
            address = excluded.address,
            hero_image_url = excluded.hero_image_url,
            public_tagline = excluded.public_tagline,
            instagram_handle = excluded.instagram_handle,
            allow_order_modifications = excluded.allow_order_modifications,
            updated_at = datetime('now')
        `,
      ).run({
        id: randomUUID(),
        truckConfigId: config.id,
        address: body.address,
        heroImageUrl: body.heroImageUrl,
        publicTagline: body.publicTagline,
        instagramHandle: body.instagramHandle || null,
        allowOrderModifications: body.allowOrderModifications ? 1 : 0,
      });
    });

    transaction();

    writeAuditLog({
      actorUserId: context.user.id,
      action: "truck.settings.updated",
      targetType: "truck_config",
      targetId: config.id,
      metadata: {
        allowOrderModifications: body.allowOrderModifications,
        beepSoundId: body.beepSoundId,
        customerPickupCooldownSeconds: body.customerPickupCooldownSeconds,
        primaryColor: body.primaryColor,
        timezone: body.timezone,
      },
    });

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/settings");

    const settings = await getTruckConfig();
    return NextResponse.json({ settings });
  } catch (error) {
    return handleRouteError(error);
  }
}
