import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";

import { hashPassword } from "../lib/auth/password";
import { getServerEnv } from "../lib/config/env";
import { SYSTEM_ROLES } from "../lib/constants/permissions";
import { getDb } from "../lib/db/client";
import { migrateDb } from "../lib/db/migrate";

loadEnv({ path: ".env.local" });

async function upsertRole(name: string, permissions: readonly string[]) {
  const db = getDb();
  const result = await db.execute({
    sql: "select id from role where name = @name",
    args: { name },
  });
  const existing = result.rows[0] as { id: string } | undefined;
  const id = existing?.id ?? randomUUID();

  await db.execute({
    sql: `
      insert into role (id, name, is_system, permissions_json)
      values (@id, @name, 1, @permissionsJson)
      on conflict(name) do update set
        is_system = excluded.is_system,
        permissions_json = excluded.permissions_json
    `,
    args: { id, name, permissionsJson: JSON.stringify(permissions) },
  });

  return id;
}

async function seedTruckConfig() {
  const db = getDb();
  const result = await db.execute("select id from truck_config limit 1");
  const existing = result.rows[0] as { id: string } | undefined;

  if (existing) {
    return existing.id;
  }

  const id = randomUUID();
  await db.execute({
    sql: `
      insert into truck_config (
        id, name, primary_color, timezone, tip_defaults_json, beep_sound_id
      )
      values (@id, @name, @primaryColor, @timezone, @tipDefaultsJson, @beepSoundId)
    `,
    args: {
      id,
      name: "El Smash del Barrio",
      primaryColor: "#F97316",
      timezone: "America/Argentina/Buenos_Aires",
      tipDefaultsJson: JSON.stringify([0, 5, 10, 15]),
      beepSoundId: "classic",
    },
  });

  return id;
}

async function seedTruckProfile(truckConfigId: string) {
  const db = getDb();
  const result = await db.execute({
    sql: "select id from truck_profile where truck_config_id = @truckConfigId",
    args: { truckConfigId },
  });

  if (result.rows.length > 0) return;

  await db.execute({
    sql: `
      insert into truck_profile (
        id, truck_config_id, address, public_tagline, instagram_handle
      )
      values (@id, @truckConfigId, @address, @publicTagline, @instagramHandle)
    `,
    args: {
      id: randomUUID(),
      truckConfigId,
      address: "Av. Corrientes 1500",
      publicTagline: "Food Truck · Av. Corrientes 1500",
      instagramHandle: "@foodtag",
    },
  });
}

async function seedOpeningHours() {
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

  for (const entry of hours) {
    await db.execute({
      sql: `
        insert into opening_hours (id, weekday, opens_at, closes_at, closed)
        values (@id, @weekday, @opensAt, @closesAt, @closed)
        on conflict(weekday) do update set
          opens_at = excluded.opens_at,
          closes_at = excluded.closes_at,
          closed = excluded.closed
      `,
      args: { id: randomUUID(), ...entry },
    });
  }
}

async function seedAdmin(adminRoleId: string) {
  const env = getServerEnv();
  const db = getDb();
  const email = env.SEED_ADMIN_EMAIL ?? "admin@foodtag.ar";
  const password = env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const fullName = env.SEED_ADMIN_FULL_NAME ?? "Admin FoodTag";

  const result = await db.execute({
    sql: "select id from staff_user where email = @email",
    args: { email },
  });
  const existing = result.rows[0] as { id: string } | undefined;

  await db.execute({
    sql: `
      insert into staff_user (
        id, email, full_name, password_hash, role_id, active
      )
      values (@id, @email, @fullName, @passwordHash, @roleId, 1)
      on conflict(email) do update set
        full_name = excluded.full_name,
        role_id = excluded.role_id,
        active = 1
    `,
    args: {
      id: existing?.id ?? randomUUID(),
      email,
      fullName,
      passwordHash: hashPassword(password),
      roleId: adminRoleId,
    },
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

async function upsertCategory(category: SeedCategory) {
  const db = getDb();
  const result = await db.execute({
    sql: "select id from category where name = @name",
    args: { name: category.name },
  });
  const existing = result.rows[0] as { id: string } | undefined;
  const id = existing?.id ?? randomUUID();

  if (existing) {
    await db.execute({
      sql: `
        update category
        set position = @position, visible = @visible
        where id = @id
      `,
      args: { id, position: category.position, visible: category.visible ? 1 : 0 },
    });
  } else {
    await db.execute({
      sql: `
        insert into category (id, name, position, visible)
        values (@id, @name, @position, @visible)
      `,
      args: {
        id,
        name: category.name,
        position: category.position,
        visible: category.visible ? 1 : 0,
      },
    });
  }

  return id;
}

async function upsertMenuItem(categoryId: string, item: SeedMenuItem) {
  const db = getDb();
  const result = await db.execute({
    sql: "select id from menu_item where category_id = @categoryId and name = @name",
    args: { categoryId, name: item.name },
  });
  const existing = result.rows[0] as { id: string } | undefined;
  const id = existing?.id ?? randomUUID();

  if (existing) {
    await db.execute({
      sql: `
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
      args: {
        id,
        description: item.description,
        priceCents: item.priceCents,
        available: item.available ? 1 : 0,
        hasVariants: item.hasVariants ? 1 : 0,
        position: item.position,
      },
    });
  } else {
    await db.execute({
      sql: `
        insert into menu_item (
          id, category_id, name, description, price_cents,
          available, has_variants, position
        )
        values (
          @id, @categoryId, @name, @description, @priceCents,
          @available, @hasVariants, @position
        )
      `,
      args: {
        id,
        categoryId,
        name: item.name,
        description: item.description,
        priceCents: item.priceCents,
        available: item.available ? 1 : 0,
        hasVariants: item.hasVariants ? 1 : 0,
        position: item.position,
      },
    });
  }

  return id;
}

async function upsertVariant(
  menuItemId: string,
  variant: NonNullable<SeedMenuItem["variants"]>[number],
) {
  const db = getDb();
  const result = await db.execute({
    sql: "select id from menu_variant where menu_item_id = @menuItemId and name = @name",
    args: { menuItemId, name: variant.name },
  });
  const existing = result.rows[0] as { id: string } | undefined;
  const id = existing?.id ?? randomUUID();

  if (existing) {
    await db.execute({
      sql: `
        update menu_variant
        set price_cents = @priceCents, available = @available, position = @position
        where id = @id
      `,
      args: {
        id,
        priceCents: variant.priceCents,
        available: variant.available ? 1 : 0,
        position: variant.position,
      },
    });
  } else {
    await db.execute({
      sql: `
        insert into menu_variant (
          id, menu_item_id, name, price_cents, available, position
        )
        values (@id, @menuItemId, @name, @priceCents, @available, @position)
      `,
      args: {
        id,
        menuItemId,
        name: variant.name,
        priceCents: variant.priceCents,
        available: variant.available ? 1 : 0,
        position: variant.position,
      },
    });
  }
}

async function upsertModifier(
  menuItemId: string,
  modifier: NonNullable<SeedMenuItem["modifiers"]>[number],
) {
  const db = getDb();
  const result = await db.execute({
    sql: "select id from menu_item_modifier where menu_item_id = @menuItemId and label = @label",
    args: { menuItemId, label: modifier.label },
  });
  const existing = result.rows[0] as { id: string } | undefined;
  const id = existing?.id ?? randomUUID();

  if (existing) {
    await db.execute({
      sql: `
        update menu_item_modifier
        set default_checked = @defaultChecked, position = @position
        where id = @id
      `,
      args: { id, defaultChecked: modifier.defaultChecked ? 1 : 0, position: modifier.position },
    });
  } else {
    await db.execute({
      sql: `
        insert into menu_item_modifier (
          id, menu_item_id, label, default_checked, position
        )
        values (@id, @menuItemId, @label, @defaultChecked, @position)
      `,
      args: {
        id,
        menuItemId,
        label: modifier.label,
        defaultChecked: modifier.defaultChecked ? 1 : 0,
        position: modifier.position,
      },
    });
  }
}

async function seedDemoMenu() {
  for (const category of demoMenu) {
    const categoryId = await upsertCategory(category);

    for (const item of category.items) {
      const itemId = await upsertMenuItem(categoryId, item);

      for (const variant of item.variants ?? []) {
        await upsertVariant(itemId, variant);
      }
      for (const modifier of item.modifiers ?? []) {
        await upsertModifier(itemId, modifier);
      }
    }
  }
}

async function main() {
  await migrateDb();

  const adminRoleId = await upsertRole("admin", SYSTEM_ROLES.admin);
  await upsertRole("cajero", SYSTEM_ROLES.cajero);
  await upsertRole("cocina", SYSTEM_ROLES.cocina);
  const truckConfigId = await seedTruckConfig();
  await seedTruckProfile(truckConfigId);
  await seedOpeningHours();
  await seedAdmin(adminRoleId);
  await seedDemoMenu();

  console.log("Turso DB migrada y seed completado con éxito");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
