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
    todayHoursLabel:
      todaysHours && !todaysHours.closed
        ? formatTimeWindow(todaysHours.opensAt, todaysHours.closesAt)
        : "Cerrado hoy",
  };
}

export async function getTruckConfig(): Promise<TruckConfig> {
  const db = getDb();
  const configResult = await db.execute("select * from truck_config limit 1");
  const row = configResult.rows[0] as unknown as TruckConfigRow | undefined;

  if (!row) {
    throw new Error("No hay configuración del truck. Corré npm run seed.");
  }

  const profileResult = await db.execute({
    sql: `
      select address, hero_image_url, public_tagline, instagram_handle,
        allow_order_modifications
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
  } satisfies TruckConfig;
}

export async function getOpeningHours(): Promise<OpeningHours[]> {
  const result = await getDb().execute(
    "select * from opening_hours order by weekday asc",
  );

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
