import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { getDb } from "@/lib/db/client";

export async function migrateDb() {
  const db = getDb();
  const migrationsPath = path.join(process.cwd(), "db", "migrations");
  const migrationFiles = readdirSync(migrationsPath)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  await db.execute(`
    create table if not exists _migrations (
      filename text primary key,
      applied_at text not null default (datetime('now'))
    )
  `);

  for (const file of migrationFiles) {
    const result = await db.execute({
      sql: "select filename from _migrations where filename = ?",
      args: [file],
    });

    if (result.rows.length > 0) continue;

    const migration = readFileSync(path.join(migrationsPath, file), "utf8");

    const statements = migration
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => ({ sql: s, args: [] as never[] }));

    await db.batch(
      [...statements, { sql: "insert into _migrations (filename) values (?)", args: [file] }],
      "write",
    );
  }
}
