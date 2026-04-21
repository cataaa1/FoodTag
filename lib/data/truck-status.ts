import { getDb } from "@/lib/db/client";
import type { OpeningHours, TruckConfig, TruckStatus } from "@/lib/types/domain";
import { formatTimeWindow, formatWeekday } from "@/lib/utils/format";

type TruckConfigRow = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  timezone: string;
  tip_defaults_json: string;
  beep_sound_id: string;
  paused_manual_at: string | null;
  paused_reason: string | null;
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
    primaryColor: config.primaryColor,
    todayHoursLabel:
      todaysHours && !todaysHours.closed
        ? formatTimeWindow(todaysHours.opensAt, todaysHours.closesAt)
        : "Cerrado hoy",
  };
}

export async function getTruckConfig() {
  const db = getDb();
  const row = db.prepare<[], TruckConfigRow>("select * from truck_config limit 1").get();

  if (!row) {
    throw new Error("No hay configuración del truck. Corré npm run seed.");
  }

  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    timezone: row.timezone,
    mpAccessTokenEncrypted: null,
    tipDefaultsJson: JSON.parse(row.tip_defaults_json) as number[],
    beepSoundId: row.beep_sound_id,
    pausedManualAt: row.paused_manual_at,
    pausedReason: row.paused_reason,
  } satisfies TruckConfig;
}

export async function getOpeningHours() {
  const db = getDb();
  const rows = db
    .prepare<[], OpeningHoursRow>("select * from opening_hours order by weekday asc")
    .all();

  return rows.map((entry) => ({
    id: entry.id,
    weekday: entry.weekday,
    opensAt: entry.opens_at,
    closesAt: entry.closes_at,
    closed: Boolean(entry.closed),
  })) satisfies OpeningHours[];
}

export async function getTruckStatus() {
  const [config, hours] = await Promise.all([getTruckConfig(), getOpeningHours()]);
  return buildTruckStatus(config, hours);
}
