import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { OpeningHours, TruckConfig, TruckStatus } from "@/lib/types/domain";
import { formatTimeWindow, formatWeekday } from "@/lib/utils/format";
import {
  openingHourRowSchema,
  truckConfigRowSchema,
} from "@/lib/validators/hours";

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
    primaryColor: config.primaryColor,
    todayHoursLabel:
      todaysHours && !todaysHours.closed
        ? formatTimeWindow(todaysHours.opensAt, todaysHours.closesAt)
        : "Cerrado hoy",
  };
}

export async function getTruckConfig() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("truck_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("No hay configuración del truck");
  }

  const parsed = truckConfigRowSchema.parse(data);

  return {
    id: parsed.id,
    name: parsed.name,
    logoUrl: parsed.logo_url,
    primaryColor: parsed.primary_color,
    timezone: parsed.timezone,
    mpAccessTokenEncrypted: parsed.mp_access_token_encrypted,
    tipDefaultsJson: parsed.tip_defaults_json,
    beepSoundId: parsed.beep_sound_id,
    pausedManualAt: parsed.paused_manual_at,
    pausedReason: parsed.paused_reason,
  } satisfies TruckConfig;
}

export async function getOpeningHours() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("opening_hours")
    .select("*")
    .order("weekday", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return openingHourRowSchema.array().parse(data).map((entry) => ({
    id: entry.id,
    weekday: entry.weekday,
    opensAt: entry.opens_at,
    closesAt: entry.closes_at,
    closed: entry.closed,
  })) satisfies OpeningHours[];
}

export async function getTruckStatus() {
  const [config, hours] = await Promise.all([getTruckConfig(), getOpeningHours()]);
  return buildTruckStatus(config, hours);
}
