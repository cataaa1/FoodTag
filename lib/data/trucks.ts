import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { hashPassword } from "@/lib/auth/password";
import { SYSTEM_ROLES } from "@/lib/constants/permissions";
import { getDb } from "@/lib/db/client";

export type TruckSummary = {
  id: string;
  slug: string;
  name: string;
  address: string;
  brandIcon: string;
  primaryColor: string;
  createdAt: string;
  staffCount: number;
  menuItemCount: number;
  ordersToday: number;
};

const DEFAULT_HOURS = [
  { weekday: 0, opensAt: "12:00:00", closesAt: "23:00:00", closed: 1 },
  { weekday: 1, opensAt: "12:00:00", closesAt: "23:00:00", closed: 0 },
  { weekday: 2, opensAt: "12:00:00", closesAt: "23:00:00", closed: 0 },
  { weekday: 3, opensAt: "12:00:00", closesAt: "23:00:00", closed: 0 },
  { weekday: 4, opensAt: "12:00:00", closesAt: "23:00:00", closed: 0 },
  { weekday: 5, opensAt: "12:00:00", closesAt: "23:59:00", closed: 0 },
  { weekday: 6, opensAt: "12:00:00", closesAt: "23:59:00", closed: 0 },
] as const;

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function listTrucks(): Promise<TruckSummary[]> {
  const db = getDb();
  const result = await db.execute(`
    select
      truck_config.id,
      truck_config.slug,
      truck_config.name,
      truck_config.brand_icon,
      truck_config.primary_color,
      truck_config.created_at,
      coalesce(truck_profile.address, '') as address,
      (select count(*) from staff_user where staff_user.truck_id = truck_config.id) as staff_count,
      (select count(*) from menu_item where menu_item.truck_id = truck_config.id) as menu_item_count,
      (
        select count(*) from customer_order
        where customer_order.truck_id = truck_config.id
          and customer_order.created_at >= datetime('now', '-1 day')
      ) as orders_today
    from truck_config
    left join truck_profile on truck_profile.truck_config_id = truck_config.id
    order by truck_config.created_at asc
  `);

  return (result.rows as unknown as Array<Record<string, string | number>>).map((row) => ({
    id: String(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name),
    address: String(row.address ?? ""),
    brandIcon: String(row.brand_icon),
    primaryColor: String(row.primary_color),
    createdAt: String(row.created_at),
    staffCount: Number(row.staff_count),
    menuItemCount: Number(row.menu_item_count),
    ordersToday: Number(row.orders_today),
  }));
}

export type ProvisionTruckInput = {
  name: string;
  address: string;
  adminEmail: string;
  adminFullName: string;
  adminPassword: string;
};

/**
 * Da de alta un truck entero: configuracion, perfil publico, horarios por
 * defecto, los tres roles del sistema y su primer usuario admin.
 *
 * Va todo en un solo batch: si algo falla, no queda un truck a medio crear
 * sin roles ni forma de entrar.
 */
export async function provisionTruck(input: ProvisionTruckInput) {
  const db = getDb();
  const truckId = randomUUID();
  const baseSlug = slugify(input.name) || "truck";

  const taken = await db.execute({
    sql: "select slug from truck_config where slug like ?",
    args: [`${baseSlug}%`],
  });
  const takenSlugs = new Set(
    (taken.rows as unknown as Array<{ slug: string | null }>).map((r) => r.slug),
  );

  let slug = baseSlug;
  let suffix = 2;
  while (takenSlugs.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const emailTaken = await db.execute({
    sql: "select id from staff_user where lower(email) = lower(?)",
    args: [input.adminEmail],
  });
  if (emailTaken.rows.length) {
    throw new ApiError(409, "CONFLICT", "Ya existe un usuario con ese email");
  }

  const profileId = randomUUID();
  const roleIds = {
    admin: randomUUID(),
    cajero: randomUUID(),
    cocina: randomUUID(),
  };

  await db.batch(
    [
      {
        sql: "insert into truck_config (id, name, slug) values (?, ?, ?)",
        args: [truckId, input.name, slug],
      },
      {
        sql: `
          insert into truck_profile (id, truck_config_id, address, public_tagline)
          values (?, ?, ?, ?)
        `,
        args: [profileId, truckId, input.address, `${input.name} · ${input.address}`],
      },
      ...DEFAULT_HOURS.map((entry) => ({
        sql: `
          insert into opening_hours (id, truck_id, weekday, opens_at, closes_at, closed)
          values (?, ?, ?, ?, ?, ?)
        `,
        args: [randomUUID(), truckId, entry.weekday, entry.opensAt, entry.closesAt, entry.closed],
      })),
      ...(Object.keys(roleIds) as Array<keyof typeof roleIds>).map((name) => ({
        sql: `
          insert into role (id, truck_id, name, is_system, permissions_json)
          values (?, ?, ?, 1, ?)
        `,
        args: [roleIds[name], truckId, name, JSON.stringify(SYSTEM_ROLES[name])],
      })),
      {
        sql: `
          insert into staff_user (id, truck_id, email, full_name, password_hash, role_id, active)
          values (?, ?, ?, ?, ?, ?, 1)
        `,
        args: [
          randomUUID(),
          truckId,
          input.adminEmail,
          input.adminFullName,
          hashPassword(input.adminPassword),
          roleIds.admin,
        ],
      },
    ],
    "write",
  );

  return { id: truckId, slug, name: input.name };
}

export async function truckExists(truckId: string) {
  const result = await getDb().execute({
    sql: "select id from truck_config where id = ?",
    args: [truckId],
  });
  return result.rows.length > 0;
}
