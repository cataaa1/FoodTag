import type { OrderStatus, TruckStatus } from "@/lib/types/domain";
import { getDb } from "@/lib/db/client";
import { buildTruckStatus, getOpeningHours, getTruckConfig } from "@/lib/data/truck-status";

type DashboardOrderRow = {
  status: OrderStatus;
  payment_status: "pending" | "approved" | "rejected" | "cancelled" | "refunded";
  total_cents: number;
  created_at: string;
  ready_at: string | null;
};

type BestSellerRow = {
  name_snapshot: string;
  quantity: number;
};

type WeeklyRevenueRow = {
  service_date: string;
  revenue_cents: number;
};

export type DashboardHourBucket = {
  label: string;
  count: number;
};

export type DashboardRevenueBucket = {
  serviceDate: string;
  label: string;
  revenueCents: number;
};

export type DashboardAverageTicketBucket = {
  serviceDate: string;
  label: string;
  averageTicketCents: number | null;
};

export type DashboardPreparationBucket = {
  serviceDate: string;
  label: string;
  averagePreparationSeconds: number | null;
};

export type DashboardToday = {
  soldTodayCents: number;
  totalOrders: number;
  approvedOrders: number;
  activeOrders: number;
  cancelledOrders: number;
  bestSellerName: string | null;
  bestSellerQuantity: number;
  averageTicketCents: number | null;
  averagePreparationSeconds: number | null;
  serviceDate: string;
  serviceDateLabel: string;
  hourlyOrders: DashboardHourBucket[];
  weeklyRevenue: DashboardRevenueBucket[];
  weeklyAverageTicket: DashboardAverageTicketBucket[];
  weeklyAveragePreparation: DashboardPreparationBucket[];
  truckStatus: TruckStatus;
};

const MS_PER_DAY = 86_400_000;

function getServiceDateFor(timezone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function getServiceDate(timezone: string) {
  return getServiceDateFor(timezone, new Date());
}

function getServiceDateLabel(timezone: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date());
}

function getWeekdayInTimezone(timezone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(new Date());

  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);

  return weekdayIndex === -1 ? 0 : weekdayIndex;
}

function parseSqliteDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

function getOperatingHourRange(opensAt: string | null, closesAt: string | null) {
  const fallback = Array.from({ length: 11 }, (_, index) => 12 + index);

  if (!opensAt || !closesAt) {
    return fallback;
  }

  const startHour = Number.parseInt(opensAt.slice(0, 2), 10);
  const endHour = Number.parseInt(closesAt.slice(0, 2), 10);

  if (
    Number.isNaN(startHour) ||
    Number.isNaN(endHour) ||
    endHour <= startHour ||
    endHour - startHour > 18
  ) {
    return fallback;
  }

  return Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
}

function toLocalHourLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).format(date);
}

function getRecentServiceDates(timezone: string, totalDays: number) {
  return Array.from({ length: totalDays }, (_, index) => {
    const offsetDays = totalDays - index - 1;
    const date = new Date(Date.now() - offsetDays * MS_PER_DAY);

    return {
      serviceDate: getServiceDateFor(timezone, date),
      label: new Intl.DateTimeFormat("es-AR", {
        timeZone: timezone,
        weekday: "short",
        day: "numeric",
        month: "numeric",
      }).format(date),
    };
  });
}

function getPreparationSeconds(order: DashboardOrderRow) {
  const createdAt = parseSqliteDate(order.created_at);
  const readyAt = parseSqliteDate(order.ready_at);

  if (!createdAt || !readyAt) {
    return null;
  }

  return Math.max(0, Math.round((readyAt.getTime() - createdAt.getTime()) / 1_000));
}

export async function getDashboardToday() {
  const db = getDb();
  const [config, hours] = await Promise.all([getTruckConfig(), getOpeningHours()]);
  const serviceDate = getServiceDate(config.timezone);
  const recentDates = getRecentServiceDates(config.timezone, 7);
  const orderRows = db
    .prepare<{ serviceDate: string }, DashboardOrderRow>(
      `
        select status, payment_status, total_cents, created_at, ready_at
        from customer_order
        where service_date = @serviceDate
        order by created_at asc
      `,
    )
    .all({ serviceDate });
  const bestSeller = db
    .prepare<{ serviceDate: string }, BestSellerRow>(
      `
        select
          order_item.name_snapshot,
          coalesce(sum(order_item.quantity), 0) as quantity
        from order_item
        join customer_order on customer_order.id = order_item.order_id
        where customer_order.service_date = @serviceDate
          and customer_order.payment_status = 'approved'
        group by order_item.name_snapshot
        order by quantity desc, order_item.name_snapshot asc
        limit 1
      `,
    )
    .get({ serviceDate });
  const weeklyRevenueRows = db
    .prepare<{ fromDate: string; toDate: string }, WeeklyRevenueRow>(
      `
        select
          service_date,
          coalesce(sum(total_cents), 0) as revenue_cents
        from customer_order
        where payment_status = 'approved'
          and service_date >= @fromDate
          and service_date <= @toDate
        group by service_date
      `,
    )
    .all({
      fromDate: recentDates[0]?.serviceDate ?? serviceDate,
      toDate: recentDates.at(-1)?.serviceDate ?? serviceDate,
    });
  const todaysHours = hours.find(
    (entry) => entry.weekday === getWeekdayInTimezone(config.timezone),
  );
  const hourRange = getOperatingHourRange(todaysHours?.opensAt ?? null, todaysHours?.closesAt ?? null);
  const hourlyBuckets = new Map<string, number>(
    hourRange.map((hour) => [String(hour).padStart(2, "0"), 0]),
  );
  const weeklyRevenueByDate = new Map(
    weeklyRevenueRows.map((row) => [row.service_date, row.revenue_cents]),
  );
  const approvedOrders = orderRows.filter((order) => order.payment_status === "approved");
  const soldTodayCents = approvedOrders.reduce((total, order) => total + order.total_cents, 0);
  const activeOrders = orderRows.filter((order) =>
    order.status === "pending" ||
    order.status === "preparing" ||
    order.status === "ready"
  ).length;
  const cancelledOrders = orderRows.filter((order) => order.status === "cancelled").length;
  const averagePreparationValues = approvedOrders
    .map(getPreparationSeconds)
    .filter((value): value is number => value !== null);

  orderRows.forEach((order) => {
    const createdAt = parseSqliteDate(order.created_at);

    if (!createdAt) {
      return;
    }

    const hourLabel = toLocalHourLabel(createdAt, config.timezone);

    if (!hourlyBuckets.has(hourLabel)) {
      return;
    }

    hourlyBuckets.set(hourLabel, (hourlyBuckets.get(hourLabel) ?? 0) + 1);
  });

  const weeklyAverageTicket = recentDates.map((entry) => {
    const dailyOrders = db
      .prepare<{ serviceDate: string }, DashboardOrderRow>(
        `
          select status, payment_status, total_cents, created_at, ready_at
          from customer_order
          where service_date = @serviceDate
            and payment_status = 'approved'
        `,
      )
      .all({ serviceDate: entry.serviceDate });

    return {
      serviceDate: entry.serviceDate,
      label: entry.label,
      averageTicketCents: dailyOrders.length
        ? Math.round(
            dailyOrders.reduce((total, order) => total + order.total_cents, 0) / dailyOrders.length,
          )
        : null,
    };
  });

  const weeklyAveragePreparation = recentDates.map((entry) => {
    const dailyOrders = db
      .prepare<{ serviceDate: string }, DashboardOrderRow>(
        `
          select status, payment_status, total_cents, created_at, ready_at
          from customer_order
          where service_date = @serviceDate
            and payment_status = 'approved'
        `,
      )
      .all({ serviceDate: entry.serviceDate });
    const values = dailyOrders
      .map(getPreparationSeconds)
      .filter((value): value is number => value !== null);

    return {
      serviceDate: entry.serviceDate,
      label: entry.label,
      averagePreparationSeconds: values.length
        ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
        : null,
    };
  });

  return {
    soldTodayCents,
    totalOrders: orderRows.length,
    approvedOrders: approvedOrders.length,
    activeOrders,
    cancelledOrders,
    bestSellerName: bestSeller?.name_snapshot ?? null,
    bestSellerQuantity: bestSeller?.quantity ?? 0,
    averageTicketCents: approvedOrders.length
      ? Math.round(soldTodayCents / approvedOrders.length)
      : null,
    averagePreparationSeconds: averagePreparationValues.length
      ? Math.round(
          averagePreparationValues.reduce((total, value) => total + value, 0) /
            averagePreparationValues.length,
        )
      : null,
    serviceDate,
    serviceDateLabel: getServiceDateLabel(config.timezone),
    hourlyOrders: Array.from(hourlyBuckets.entries()).map(([label, count]) => ({
      label,
      count,
    })),
    weeklyRevenue: recentDates.map((entry) => ({
      serviceDate: entry.serviceDate,
      label: entry.label,
      revenueCents: weeklyRevenueByDate.get(entry.serviceDate) ?? 0,
    })),
    weeklyAverageTicket,
    weeklyAveragePreparation,
    truckStatus: buildTruckStatus(config, hours),
  } satisfies DashboardToday;
}
