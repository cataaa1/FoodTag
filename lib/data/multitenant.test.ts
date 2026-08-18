import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Tests de aislamiento entre foodtrucks, contra una SQLite real y descartable.
 *
 * Se corren sobre la base y no sobre mocks a proposito: lo que hay que proteger
 * son las constraints del esquema y los filtros por truck_id. Un mock no puede
 * decirnos si la migracion realmente impide que dos trucks compartan la
 * numeracion de tickets.
 */
let db: Client;
let dir: string;
let truckA: string;
let truckB: string;

async function runMigrations(client: Client) {
  const migrationsDir = path.join(process.cwd(), "db", "migrations");

  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    const statements = readFileSync(path.join(migrationsDir, file), "utf8")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((sql) => ({ sql, args: [] as never[] }));

    await client.batch(statements, "write");
  }
}

async function createTruck(name: string, slug: string) {
  const id = randomUUID();
  await db.execute({
    sql: "insert into truck_config (id, name, slug) values (?, ?, ?)",
    args: [id, name, slug],
  });
  await db.execute({
    sql: "insert into truck_profile (id, truck_config_id, address, public_tagline) values (?, ?, ?, ?)",
    args: [randomUUID(), id, `${name} 100`, name],
  });
  return id;
}

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "foodtag-test-"));
  db = createClient({ url: `file:${path.join(dir, "test.sqlite")}` });

  await runMigrations(db);
  truckA = await createTruck("Truck A", "truck-a");
  truckB = await createTruck("Truck B", "truck-b");
});

afterAll(() => {
  db?.close();

  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // En Windows el archivo queda tomado un instante despues del close. Es un
    // temporal del sistema: si no se puede borrar ahora, lo limpia el SO.
  }
});

describe("el esquema permite convivir a varios foodtrucks", () => {
  it("cada truck tiene sus propios horarios", async () => {
    // Antes de la migracion 015 `weekday` era unique global: solo 7 filas en
    // toda la base, o sea un unico truck con horarios.
    for (const truckId of [truckA, truckB]) {
      for (let weekday = 0; weekday < 7; weekday++) {
        await db.execute({
          sql: "insert into opening_hours (id, truck_id, weekday, opens_at, closes_at, closed) values (?, ?, ?, '10:00:00', '23:00:00', 0)",
          args: [randomUUID(), truckId, weekday],
        });
      }
    }

    const count = await db.execute("select count(*) as n from opening_hours");
    expect(Number((count.rows[0] as unknown as { n: number }).n)).toBe(14);
  });

  it("no deja repetir el mismo dia dentro de un truck", async () => {
    await expect(
      db.execute({
        sql: "insert into opening_hours (id, truck_id, weekday, closed) values (?, ?, 1, 1)",
        args: [randomUUID(), truckA],
      }),
    ).rejects.toThrow();
  });

  it("cada truck puede tener un rol llamado igual", async () => {
    for (const truckId of [truckA, truckB]) {
      await db.execute({
        sql: "insert into role (id, truck_id, name, is_system, permissions_json) values (?, ?, 'cajero', 1, '[]')",
        args: [randomUUID(), truckId],
      });
    }

    const roles = await db.execute("select count(*) as n from role where name = 'cajero'");
    expect(Number((roles.rows[0] as unknown as { n: number }).n)).toBe(2);
  });

  it("no deja repetir el nombre de rol dentro del mismo truck", async () => {
    await expect(
      db.execute({
        sql: "insert into role (id, truck_id, name, is_system, permissions_json) values (?, ?, 'cajero', 0, '[]')",
        args: [randomUUID(), truckA],
      }),
    ).rejects.toThrow();
  });

  it("los dos trucks arrancan el dia en el ticket numero 1", async () => {
    const customer = randomUUID();
    await db.execute({
      sql: "insert into customer (id, name, phone) values (?, 'Cliente', '1122334455')",
      args: [customer],
    });

    // Antes de la 016 el unique era (service_date, ticket_number) sin el truck:
    // el segundo foodtruck no podia emitir su propio ticket #1 del dia.
    for (const truckId of [truckA, truckB]) {
      await db.execute({
        sql: "insert into customer_order (id, truck_id, ticket_number, service_date, customer_id, subtotal_cents, total_cents) values (?, ?, 1, '2026-08-18', ?, 1000, 1000)",
        args: [randomUUID(), truckId, customer],
      });
    }

    const orders = await db.execute(
      "select count(*) as n from customer_order where ticket_number = 1 and service_date = '2026-08-18'",
    );
    expect(Number((orders.rows[0] as unknown as { n: number }).n)).toBe(2);
  });

  it("no deja repetir el numero de ticket del dia dentro de un truck", async () => {
    const customer = await db.execute("select id from customer limit 1");

    await expect(
      db.execute({
        sql: "insert into customer_order (id, truck_id, ticket_number, service_date, customer_id, subtotal_cents, total_cents) values (?, ?, 1, '2026-08-18', ?, 500, 500)",
        args: [randomUUID(), truckA, (customer.rows[0] as unknown as { id: string }).id],
      }),
    ).rejects.toThrow();
  });

  it("cada truck contabiliza su propio contador diario", async () => {
    for (const truckId of [truckA, truckB]) {
      await db.execute({
        sql: "insert into ticket_counter (truck_id, service_date, next_ticket_number) values (?, '2026-08-18', 2)",
        args: [truckId],
      });
    }

    const counters = await db.execute(
      "select count(*) as n from ticket_counter where service_date = '2026-08-18'",
    );
    expect(Number((counters.rows[0] as unknown as { n: number }).n)).toBe(2);
  });

  it("el slug del truck es unico en toda la plataforma", async () => {
    // Dos trucks con el mismo slug harian que un QR apunte a cualquiera.
    await expect(
      db.execute({
        sql: "insert into truck_config (id, name, slug) values (?, 'Impostor', 'truck-a')",
        args: [randomUUID()],
      }),
    ).rejects.toThrow();
  });

  it("el email del staff es unico en toda la plataforma", async () => {
    // El login pide email y contraseña sin elegir truck: si el email se
    // repitiera entre trucks, no habria forma de saber a cual entrar.
    const roleA = await db.execute({
      sql: "select id from role where truck_id = ? limit 1",
      args: [truckA],
    });
    const roleB = await db.execute({
      sql: "select id from role where truck_id = ? limit 1",
      args: [truckB],
    });

    await db.execute({
      sql: "insert into staff_user (id, truck_id, email, full_name, password_hash, role_id) values (?, ?, 'repetido@foodtag.ar', 'A', 'h', ?)",
      args: [randomUUID(), truckA, (roleA.rows[0] as unknown as { id: string }).id],
    });

    await expect(
      db.execute({
        sql: "insert into staff_user (id, truck_id, email, full_name, password_hash, role_id) values (?, ?, 'repetido@foodtag.ar', 'B', 'h', ?)",
        args: [randomUUID(), truckB, (roleB.rows[0] as unknown as { id: string }).id],
      }),
    ).rejects.toThrow();
  });
});

describe("los datos de un truck no se filtran al otro", () => {
  it("el menu de cada truck solo trae lo suyo", async () => {
    for (const [truckId, nombre] of [
      [truckA, "Hamburguesas"],
      [truckB, "Tacos"],
    ] as const) {
      const categoryId = randomUUID();
      await db.execute({
        sql: "insert into category (id, truck_id, name, position, visible) values (?, ?, ?, 0, 1)",
        args: [categoryId, truckId, nombre],
      });
      await db.execute({
        sql: "insert into menu_item (id, truck_id, category_id, name, price_cents, position) values (?, ?, ?, ?, 1000, 0)",
        args: [randomUUID(), truckId, categoryId, `Item de ${nombre}`],
      });
    }

    const categoriasA = await db.execute({
      sql: "select name from category where truck_id = ?",
      args: [truckA],
    });
    const itemsA = await db.execute({
      sql: "select name from menu_item where truck_id = ?",
      args: [truckA],
    });

    expect(categoriasA.rows.map((r) => r.name)).toEqual(["Hamburguesas"]);
    expect(itemsA.rows.map((r) => r.name)).toEqual(["Item de Hamburguesas"]);
  });

  it("borrar un truck se lleva sus horarios y no los del otro", async () => {
    const descartable = await createTruck("Descartable", "descartable");
    await db.execute({
      sql: "insert into opening_hours (id, truck_id, weekday, closed) values (?, ?, 0, 1)",
      args: [randomUUID(), descartable],
    });

    await db.execute({ sql: "delete from truck_config where id = ?", args: [descartable] });

    const restantes = await db.execute("select count(*) as n from opening_hours");
    expect(Number((restantes.rows[0] as unknown as { n: number }).n)).toBe(14);
  });

  it("la base queda integra despues de todo esto", async () => {
    const violaciones = await db.execute("pragma foreign_key_check");
    expect(violaciones.rows).toHaveLength(0);
  });
});
