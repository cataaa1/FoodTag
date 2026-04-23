import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
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
    await requireStaffPermission("settings.write");
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

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/settings");

    const settings = await getTruckConfig();
    return NextResponse.json({ settings });
  } catch (error) {
    return handleRouteError(error);
  }
}
