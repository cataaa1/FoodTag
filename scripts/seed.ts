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
    return existing.id;
  }

  const id = randomUUID();
  db.prepare(
    `
      insert into truck_config (
        id, name, primary_color, timezone, tip_defaults_json, beep_sound_id
      )
      values (@id, @name, @primaryColor, @timezone, @tipDefaultsJson, @beepSoundId)
    `,
  ).run({
    id,
    name: "El Smash del Barrio",
    primaryColor: "#F97316",
    timezone: "America/Argentina/Buenos_Aires",
    tipDefaultsJson: JSON.stringify([0, 5, 10, 15]),
    beepSoundId: "classic",
  });

  return id;
}

function seedTruckProfile(truckConfigId: string) {
  const db = getDb();
  const existing = db
    .prepare<{ truckConfigId: string }, { id: string }>(
      "select id from truck_profile where truck_config_id = @truckConfigId",
    )
    .get({ truckConfigId });

  if (existing) {
    return;
  }

  db.prepare(
    `
      insert into truck_profile (
        id, truck_config_id, address, public_tagline, instagram_handle
      )
      values (
        @id, @truckConfigId, @address, @publicTagline, @instagramHandle
      )
    `,
  ).run({
    id: randomUUID(),
    truckConfigId,
    address: "Av. Corrientes 1500",
    publicTagline: "Food Truck · Av. Corrientes 1500",
    instagramHandle: "@foodtag",
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

type SeedCategory = {
  name: string;
  position: number;
  visible: boolean;
  items: SeedMenuItem[];
};

type SeedMenuItem = {
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
  hasVariants?: boolean;
  position: number;
  variants?: {
    name: string;
    priceCents: number;
    available: boolean;
    position: number;
  }[];
  modifiers?: {
    label: string;
    defaultChecked: boolean;
    position: number;
  }[];
};

const demoMenu: SeedCategory[] = [
  {
    name: "Hamburguesas",
    position: 0,
    visible: true,
    items: [
      {
        name: "Classic Smash",
        description: "Doble medallón, cheddar fundido, pickles y salsa secreta",
        priceCents: 2_800_00,
        available: true,
        hasVariants: true,
        position: 0,
        variants: [
          { name: "Simple", priceCents: 2_800_00, available: true, position: 0 },
          { name: "Doble", priceCents: 3_600_00, available: true, position: 1 },
          { name: "Triple", priceCents: 4_200_00, available: true, position: 2 },
        ],
        modifiers: [
          { label: "Con lechuga", defaultChecked: true, position: 0 },
          { label: "Con pickles", defaultChecked: true, position: 1 },
          { label: "Con salsa secreta", defaultChecked: true, position: 2 },
          { label: "Con cebolla caramelizada", defaultChecked: false, position: 3 },
        ],
      },
      {
        name: "Crispy Chicken",
        description: "Pollo rebozado, coleslaw y mayo ahumada",
        priceCents: 2_600_00,
        available: true,
        position: 1,
        modifiers: [
          { label: "Con mayo ahumada", defaultChecked: true, position: 0 },
          { label: "Con coleslaw", defaultChecked: true, position: 1 },
          { label: "Con jalapeños", defaultChecked: false, position: 2 },
        ],
      },
      {
        name: "BBQ Bacon",
        description: "Bacon crocante, anillos de cebolla y salsa BBQ",
        priceCents: 3_200_00,
        available: false,
        hasVariants: true,
        position: 2,
        variants: [
          { name: "Simple", priceCents: 3_200_00, available: false, position: 0 },
          { name: "Doble", priceCents: 4_000_00, available: false, position: 1 },
        ],
      },
    ],
  },
  {
    name: "Papas",
    position: 1,
    visible: true,
    items: [
      {
        name: "Papas Fritas",
        description: "Crocantes, con sal gruesa",
        priceCents: 1_200_00,
        available: true,
        position: 0,
      },
      {
        name: "Papas Cheddar",
        description: "Con cheddar fundido y cebolla de verdeo",
        priceCents: 1_600_00,
        available: true,
        position: 1,
        modifiers: [
          { label: "Con cheddar extra", defaultChecked: false, position: 0 },
          { label: "Con cebolla de verdeo", defaultChecked: true, position: 1 },
        ],
      },
    ],
  },
  {
    name: "Bebidas",
    position: 2,
    visible: true,
    items: [
      {
        name: "Gaseosa",
        description: "Coca, Sprite o Fanta - 500ml",
        priceCents: 800_00,
        available: true,
        position: 0,
        modifiers: [
          { label: "Con hielo", defaultChecked: true, position: 0 },
          { label: "Con limón", defaultChecked: false, position: 1 },
        ],
      },
      {
        name: "Agua con gas",
        description: "500ml, bien fría",
        priceCents: 600_00,
        available: true,
        position: 1,
        modifiers: [{ label: "Con hielo", defaultChecked: true, position: 0 }],
      },
    ],
  },
  {
    name: "Postres",
    position: 3,
    visible: true,
    items: [
      {
        name: "Brownie",
        description: "Tibio, con helado de vainilla",
        priceCents: 1_400_00,
        available: false,
        position: 0,
      },
      {
        name: "Alfajor artesanal",
        description: "Triple de maicena, bañado en chocolate",
        priceCents: 900_00,
        available: true,
        position: 1,
      },
    ],
  },
];

function upsertCategory(category: SeedCategory) {
  const db = getDb();
  const existing = db
    .prepare<{ name: string }, { id: string }>("select id from category where name = @name")
    .get({ name: category.name });
  const id = existing?.id ?? randomUUID();

  if (existing) {
    db.prepare(
      `
        update category
        set position = @position, visible = @visible
        where id = @id
      `,
    ).run({
      id,
      position: category.position,
      visible: category.visible ? 1 : 0,
    });
  } else {
    db.prepare(
      `
        insert into category (id, name, position, visible)
        values (@id, @name, @position, @visible)
      `,
    ).run({
      id,
      name: category.name,
      position: category.position,
      visible: category.visible ? 1 : 0,
    });
  }

  return id;
}

function upsertMenuItem(categoryId: string, item: SeedMenuItem) {
  const db = getDb();
  const existing = db
    .prepare<{ categoryId: string; name: string }, { id: string }>(
      "select id from menu_item where category_id = @categoryId and name = @name",
    )
    .get({ categoryId, name: item.name });
  const id = existing?.id ?? randomUUID();

  if (existing) {
    db.prepare(
      `
        update menu_item
        set
          description = @description,
          price_cents = @priceCents,
          available = @available,
          has_variants = @hasVariants,
          position = @position,
          updated_at = datetime('now')
        where id = @id
      `,
    ).run({
      id,
      description: item.description,
      priceCents: item.priceCents,
      available: item.available ? 1 : 0,
      hasVariants: item.hasVariants ? 1 : 0,
      position: item.position,
    });
  } else {
    db.prepare(
      `
        insert into menu_item (
          id, category_id, name, description, price_cents,
          available, has_variants, position
        )
        values (
          @id, @categoryId, @name, @description, @priceCents,
          @available, @hasVariants, @position
        )
      `,
    ).run({
      id,
      categoryId,
      name: item.name,
      description: item.description,
      priceCents: item.priceCents,
      available: item.available ? 1 : 0,
      hasVariants: item.hasVariants ? 1 : 0,
      position: item.position,
    });
  }

  return id;
}

function upsertVariant(
  menuItemId: string,
  variant: NonNullable<SeedMenuItem["variants"]>[number],
) {
  const db = getDb();
  const existing = db
    .prepare<{ menuItemId: string; name: string }, { id: string }>(
      "select id from menu_variant where menu_item_id = @menuItemId and name = @name",
    )
    .get({ menuItemId, name: variant.name });
  const id = existing?.id ?? randomUUID();

  if (existing) {
    db.prepare(
      `
        update menu_variant
        set price_cents = @priceCents, available = @available, position = @position
        where id = @id
      `,
    ).run({
      id,
      priceCents: variant.priceCents,
      available: variant.available ? 1 : 0,
      position: variant.position,
    });
  } else {
    db.prepare(
      `
        insert into menu_variant (
          id, menu_item_id, name, price_cents, available, position
        )
        values (@id, @menuItemId, @name, @priceCents, @available, @position)
      `,
    ).run({
      id,
      menuItemId,
      name: variant.name,
      priceCents: variant.priceCents,
      available: variant.available ? 1 : 0,
      position: variant.position,
    });
  }
}

function upsertModifier(
  menuItemId: string,
  modifier: NonNullable<SeedMenuItem["modifiers"]>[number],
) {
  const db = getDb();
  const existing = db
    .prepare<{ menuItemId: string; label: string }, { id: string }>(
      "select id from menu_item_modifier where menu_item_id = @menuItemId and label = @label",
    )
    .get({ menuItemId, label: modifier.label });
  const id = existing?.id ?? randomUUID();

  if (existing) {
    db.prepare(
      `
        update menu_item_modifier
        set default_checked = @defaultChecked, position = @position
        where id = @id
      `,
    ).run({
      id,
      defaultChecked: modifier.defaultChecked ? 1 : 0,
      position: modifier.position,
    });
  } else {
    db.prepare(
      `
        insert into menu_item_modifier (
          id, menu_item_id, label, default_checked, position
        )
        values (@id, @menuItemId, @label, @defaultChecked, @position)
      `,
    ).run({
      id,
      menuItemId,
      label: modifier.label,
      defaultChecked: modifier.defaultChecked ? 1 : 0,
      position: modifier.position,
    });
  }
}

function seedDemoMenu() {
  const db = getDb();
  const transaction = db.transaction(() => {
    demoMenu.forEach((category) => {
      const categoryId = upsertCategory(category);

      category.items.forEach((item) => {
        const itemId = upsertMenuItem(categoryId, item);

        (item.variants ?? []).forEach((variant) => {
          upsertVariant(itemId, variant);
        });
        (item.modifiers ?? []).forEach((modifier) => {
          upsertModifier(itemId, modifier);
        });
      });
    });
  });

  transaction();
}

async function main() {
  migrateDb();

  const adminRoleId = upsertRole("admin", SYSTEM_ROLES.admin);
  upsertRole("cajero", SYSTEM_ROLES.cajero);
  upsertRole("cocina", SYSTEM_ROLES.cocina);
  const truckConfigId = seedTruckConfig();
  seedTruckProfile(truckConfigId);
  seedOpeningHours();
  seedAdmin(adminRoleId);
  seedDemoMenu();

  console.log("SQLite migrado y seed completado con éxito");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
