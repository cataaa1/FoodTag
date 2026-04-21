import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";

import { hashPassword } from "../lib/auth/password";
import { getServerEnv } from "../lib/config/env";
import { SYSTEM_ROLES } from "../lib/constants/permissions";
import { getDb } from "../lib/db/client";
import { migrateDb } from "../lib/db/migrate";

loadEnv({ path: ".env.local" });

function upsertRole(name: string, permissions: readonly string[]) {
  const db = getDb();
  const existing = db
    .prepare<{ name: string }, { id: string }>("select id from role where name = @name")
    .get({ name });
  const id = existing?.id ?? randomUUID();

  db.prepare(
    `
      insert into role (id, name, is_system, permissions_json)
      values (@id, @name, 1, @permissionsJson)
      on conflict(name) do update set
        is_system = excluded.is_system,
        permissions_json = excluded.permissions_json
    `,
  ).run({
    id,
    name,
    permissionsJson: JSON.stringify(permissions),
  });

  return id;
}

function seedTruckConfig() {
  const db = getDb();
  const existing = db
    .prepare<[], { id: string }>("select id from truck_config limit 1")
    .get();

  if (existing) {
    return;
  }

  db.prepare(
    `
      insert into truck_config (
        id, name, primary_color, timezone, tip_defaults_json, beep_sound_id
      )
      values (@id, @name, @primaryColor, @timezone, @tipDefaultsJson, @beepSoundId)
    `,
  ).run({
    id: randomUUID(),
    name: "FoodTag Truck",
    primaryColor: "#F97316",
    timezone: "America/Argentina/Buenos_Aires",
    tipDefaultsJson: JSON.stringify([0, 5, 10, 15]),
    beepSoundId: "classic",
  });
}

function seedOpeningHours() {
  const db = getDb();
  const hours = [
    { weekday: 0, opensAt: null, closesAt: null, closed: 1 },
    { weekday: 1, opensAt: "12:00:00", closesAt: "23:00:00", closed: 0 },
    { weekday: 2, opensAt: "12:00:00", closesAt: "23:00:00", closed: 0 },
    { weekday: 3, opensAt: "12:00:00", closesAt: "23:00:00", closed: 0 },
    { weekday: 4, opensAt: "12:00:00", closesAt: "23:30:00", closed: 0 },
    { weekday: 5, opensAt: "12:00:00", closesAt: "23:59:00", closed: 0 },
    { weekday: 6, opensAt: "18:00:00", closesAt: "23:59:00", closed: 0 },
  ];

  const statement = db.prepare(
    `
      insert into opening_hours (id, weekday, opens_at, closes_at, closed)
      values (@id, @weekday, @opensAt, @closesAt, @closed)
      on conflict(weekday) do update set
        opens_at = excluded.opens_at,
        closes_at = excluded.closes_at,
        closed = excluded.closed
    `,
  );

  const transaction = db.transaction(() => {
    hours.forEach((entry) => {
      statement.run({ id: randomUUID(), ...entry });
    });
  });

  transaction();
}

function seedAdmin(adminRoleId: string) {
  const env = getServerEnv();
  const db = getDb();
  const email = env.SEED_ADMIN_EMAIL ?? "admin@foodtag.ar";
  const password = env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const fullName = env.SEED_ADMIN_FULL_NAME ?? "Admin FoodTag";
  const existing = db
    .prepare<{ email: string }, { id: string }>(
      "select id from staff_user where email = @email",
    )
    .get({ email });

  db.prepare(
    `
      insert into staff_user (
        id, email, full_name, password_hash, role_id, active
      )
      values (@id, @email, @fullName, @passwordHash, @roleId, 1)
      on conflict(email) do update set
        full_name = excluded.full_name,
        role_id = excluded.role_id,
        active = 1
    `,
  ).run({
    id: existing?.id ?? randomUUID(),
    email,
    fullName,
    passwordHash: hashPassword(password),
    roleId: adminRoleId,
  });
}

async function main() {
  migrateDb();

  const adminRoleId = upsertRole("admin", SYSTEM_ROLES.admin);
  upsertRole("cajero", SYSTEM_ROLES.cajero);
  upsertRole("cocina", SYSTEM_ROLES.cocina);
  seedTruckConfig();
  seedOpeningHours();
  seedAdmin(adminRoleId);

  console.log("SQLite migrado y seed completado con éxito");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
