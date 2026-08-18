import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { ApiError, handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { writeAuditLog } from "@/lib/data/audit-log";
import { getTruckConfig } from "@/lib/data/truck-status";
import { getMaskedMpToken, setMpAccessToken } from "@/lib/payments/truck-token";
import { getDb } from "@/lib/db/client";
import { adminSettingsPatchSchema } from "@/lib/validators/settings";

export async function GET() {
  try {
    await requireStaffPermission("settings.write");
    const config = await getTruckConfig();

    return NextResponse.json({
      settings: { ...config, mpAccessTokenMasked: await getMaskedMpToken(config.id) },
    });
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

    const slugTaken = await db.execute({
      sql: "select id from truck_config where slug = ? and id <> ?",
      args: [body.slug, config.id],
    });
    if (slugTaken.rows.length) {
      throw new ApiError(
        409,
        "CONFLICT",
        "Ese identificador ya lo usa otro foodtruck. Elegí otro.",
      );
    }

    await db.batch(
      [
        {
          sql: `
            update truck_config set
              name = ?,
              slug = ?,
              logo_url = ?,
              brand_icon = ?,
              primary_color = ?,
              timezone = ?,
              beep_sound_id = ?,
              customer_pickup_cooldown_seconds = ?,
              updated_at = datetime('now')
            where id = ?
          `,
          args: [
            body.name,
            body.slug,
            body.logoUrl,
            body.brandIcon,
            body.primaryColor,
            body.timezone,
            body.beepSoundId,
            body.customerPickupCooldownSeconds,
            config.id,
          ],
        },
        {
          sql: `
            insert into truck_profile (
              id, truck_config_id, address, hero_image_url,
              public_tagline, instagram_handle, allow_order_modifications, updated_at
            )
            values (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            on conflict(truck_config_id) do update set
              address = excluded.address,
              hero_image_url = excluded.hero_image_url,
              public_tagline = excluded.public_tagline,
              instagram_handle = excluded.instagram_handle,
              allow_order_modifications = excluded.allow_order_modifications,
              updated_at = datetime('now')
          `,
          args: [
            randomUUID(),
            config.id,
            body.address,
            body.heroImageUrl,
            body.publicTagline,
            body.instagramHandle || null,
            body.allowOrderModifications ? 1 : 0,
          ],
        },
      ],
      "write",
    );

    await writeAuditLog({
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

    if (body.mpAccessToken !== undefined) {
      await setMpAccessToken(config.id, body.mpAccessToken);
    }

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/settings");

    const settings = await getTruckConfig();
    return NextResponse.json({ settings });
  } catch (error) {
    return handleRouteError(error);
  }
}
