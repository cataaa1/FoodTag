import { cookies } from "next/headers";

import { getActiveTruckIdFromCookie } from "@/lib/auth/platform-session";
import { getStaffContext } from "@/lib/auth/staff-session";
import { PUBLIC_TRUCK_COOKIE } from "@/lib/auth/staff-token";
import { getDb } from "@/lib/db/client";
import type {
  OpeningHours,
  TruckBranding,
  TruckConfig,
  TruckStatus,
} from "@/lib/types/domain";
import { formatTimeWindow, formatWeekday } from "@/lib/utils/format";

type TruckConfigRow = {
  id: string;
  name: string;
  updated_at: string;
  logo_url: string | null;
  brand_icon: string;
  primary_color: string;
  timezone: string;
  tip_defaults_json: string;
  beep_sound_id: string;
  customer_pickup_cooldown_seconds: number;
  paused_manual_at: string | null;
  paused_reason: string | null;
};

type TruckProfileRow = {
  address: string;
  updated_at: string;
  hero_image_url: string | null;
  public_tagline: string;
  instagram_handle: string | null;
  allow_order_modifications: number;
};

type OpeningHoursRow = {
  id: string;
  weekday: number;
  opens_at: string | null;
  closes_at: string | null;
  closed: number;
};

/**
 * Token derivado de los updated_at de truck_config y truck_profile. Va dentro
 * de la URL del branding: mientras no cambie, cualquier cache puede quedarselo
 * para siempre; cuando cambia, la URL es otra y nadie puede servir lo viejo.
 */
function buildBrandingVersion(
  configUpdatedAt: string,
  profileUpdatedAt: string | null,
) {
  const compact = (value: string | null) => (value ?? "").replace(/\D/g, "");

  return `${compact(configUpdatedAt)}-${compact(profileUpdatedAt)}`;
}

function getLocalizedNow(timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  } as const;
  const weekdayToken = parts.find((part) => part.type === "weekday")?.value as
    | keyof typeof weekdayMap
    | undefined;
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return {
    weekday: weekdayToken ? weekdayMap[weekdayToken] : 0,
    currentTime: `${hour}:${minute}:00`,
  };
}

function isBetween(
  currentTime: string,
  opensAt: string | null,
  closesAt: string | null,
) {
  if (!opensAt || !closesAt) {
    return false;
  }

  return currentTime >= opensAt && currentTime <= closesAt;
}

export function buildTruckStatus(
  config: TruckConfig,
  hours: OpeningHours[],
): TruckStatus {
  const now = getLocalizedNow(config.timezone);
  const todaysHours = hours.find((entry) => entry.weekday === now.weekday);
  const isManuallyPaused = Boolean(config.pausedManualAt);
  const isOpen =
    !isManuallyPaused &&
    Boolean(
      todaysHours &&
        !todaysHours.closed &&
        isBetween(now.currentTime, todaysHours.opensAt, todaysHours.closesAt),
    );

  let nextOpeningLabel: string | null = null;

  if (!isOpen) {
    for (let offset = 0; offset < 7; offset += 1) {
      const weekday = (now.weekday + offset) % 7;
      const dayHours = hours.find((entry) => entry.weekday === weekday);

      if (!dayHours || dayHours.closed || !dayHours.opensAt) {
        continue;
      }

      nextOpeningLabel =
        offset === 0
          ? `Hoy a las ${dayHours.opensAt.slice(0, 5)}`
          : `${formatWeekday(weekday)} a las ${dayHours.opensAt.slice(0, 5)}`;
      break;
    }
  }

  return {
    isOpen,
    nextOpeningLabel,
    paused: isManuallyPaused,
    reason: config.pausedReason,
    truckName: config.name,
    address: config.address,
    publicTagline: config.publicTagline,
    instagramHandle: config.instagramHandle,
    brandIcon: config.brandIcon,
    primaryColor: config.primaryColor,
    allowOrderModifications: config.allowOrderModifications,
    beepSoundId: config.beepSoundId,
    customerPickupCooldownSeconds: config.customerPickupCooldownSeconds,
    brandingVersion: config.brandingVersion,
    todayHoursLabel:
      todaysHours && !todaysHours.closed
        ? formatTimeWindow(todaysHours.opensAt, todaysHours.closesAt)
        : "Cerrado hoy",
  };
}

async function getFirstTruckId(): Promise<string> {
  const result = await getDb().execute(
    "select id from truck_config order by created_at asc limit 1",
  );
  const row = result.rows[0] as unknown as { id: string } | undefined;

  if (!row) {
    throw new Error("No hay configuración del truck. Corré npm run seed.");
  }

  return row.id;
}

/**
 * En que truck esta parada esta request.
 *
 *   empleado del truck -> su staff_user.truck_id, no lo puede cambiar
 *   superadmin         -> el que eligio en su home (cookie de truck activo)
 *   sin sesion         -> el primero, hasta que las rutas publicas lleven el
 *                         slug del truck en la URL
 *
 * Todas las escrituras y lecturas acotadas pasan por aca.
 */
export async function getCurrentTruckId(): Promise<string> {
  const staff = await getStaffContext();
  if (staff) {
    return staff.user.truckId;
  }

  const activeTruckId = await getActiveTruckIdFromCookie();
  if (activeTruckId && (await truckIdExists(activeTruckId))) {
    return activeTruckId;
  }

  // Cliente que entro por el QR: /t/<slug> le dejo fijado el truck.
  const cookieStore = await cookies();
  const publicTruckId = cookieStore.get(PUBLIC_TRUCK_COOKIE)?.value;
  if (publicTruckId && (await truckIdExists(publicTruckId))) {
    return publicTruckId;
  }

  return getFirstTruckId();
}

async function truckIdExists(truckId: string) {
  const result = await getDb().execute({
    sql: "select id from truck_config where id = ?",
    args: [truckId],
  });
  return result.rows.length > 0;
}

/**
 * Cuantos foodtrucks hay cargados. Con mas de uno, entrar al menu sin haber
 * escaneado un QR es ambiguo: no hay forma de adivinar de cual quiere comprar.
 */
export async function countTrucks(): Promise<number> {
  const result = await getDb().execute("select count(*) as total from truck_config");
  return Number((result.rows[0] as unknown as { total: number }).total);
}

/** True cuando la request no tiene truck fijado y hay mas de uno para elegir. */
export async function isTruckAmbiguous(): Promise<boolean> {
  if (await getStaffContext()) return false;
  if (await getActiveTruckIdFromCookie()) return false;

  const cookieStore = await cookies();
  if (cookieStore.get(PUBLIC_TRUCK_COOKIE)?.value) return false;

  return (await countTrucks()) > 1;
}

export async function getTruckConfig(): Promise<TruckConfig> {
  const db = getDb();
  const truckId = await getCurrentTruckId();
  const configResult = await db.execute({
    sql: "select * from truck_config where id = ?",
    args: [truckId],
  });
  const row = configResult.rows[0] as unknown as TruckConfigRow | undefined;

  if (!row) {
    throw new Error("No hay configuración del truck. Corré npm run seed.");
  }

  const profileResult = await db.execute({
    sql: `
      select address, hero_image_url, public_tagline, instagram_handle,
        allow_order_modifications, updated_at
      from truck_profile
      where truck_config_id = ?
    `,
    args: [row.id],
  });
  const profile = profileResult.rows[0] as unknown as TruckProfileRow | undefined;

  return {
    id: row.id,
    name: row.name,
    address: profile?.address ?? "Av. Corrientes 1500",
    heroImageUrl: profile?.hero_image_url ?? null,
    publicTagline: profile?.public_tagline ?? "Food Truck · Av. Corrientes 1500",
    instagramHandle: profile?.instagram_handle ?? null,
    brandIcon: row.brand_icon,
    allowOrderModifications: profile
      ? Boolean(profile.allow_order_modifications)
      : true,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    timezone: row.timezone,
    mpAccessTokenEncrypted: null,
    tipDefaultsJson: JSON.parse(row.tip_defaults_json) as number[],
    beepSoundId: row.beep_sound_id,
    customerPickupCooldownSeconds: row.customer_pickup_cooldown_seconds,
    pausedManualAt: row.paused_manual_at,
    pausedReason: row.paused_reason,
    brandingVersion: buildBrandingVersion(row.updated_at, profile?.updated_at ?? null),
  } satisfies TruckConfig;
}

export async function getOpeningHours(): Promise<OpeningHours[]> {
  const result = await getDb().execute({
    sql: "select * from opening_hours where truck_id = ? order by weekday asc",
    args: [await getCurrentTruckId()],
  });

  return (result.rows as unknown as OpeningHoursRow[]).map((entry) => ({
    id: entry.id,
    weekday: entry.weekday,
    opensAt: entry.opens_at,
    closesAt: entry.closes_at,
    closed: Boolean(entry.closed),
  })) satisfies OpeningHours[];
}

export async function getTruckStatus(): Promise<TruckStatus> {
  const [config, hours] = await Promise.all([getTruckConfig(), getOpeningHours()]);
  return buildTruckStatus(config, hours);
}

export async function getTruckBranding(): Promise<TruckBranding> {
  const config = await getTruckConfig();

  return {
    truckName: config.name,
    brandIcon: config.brandIcon,
    primaryColor: config.primaryColor,
    logoUrl: config.logoUrl,
    heroImageUrl: config.heroImageUrl,
  };
}
