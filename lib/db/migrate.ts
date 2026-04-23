import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { getDb } from "@/lib/db/client";

export function migrateDb() {
  const db = getDb();
  const migrationsPath = path.join(process.cwd(), "db", "migrations");
  const migrationFiles = readdirSync(migrationsPath)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  db.exec(`
    create table if not exists _migrations (
      filename text primary key,
      applied_at text not null default (datetime('now'))
    )
  `);

  migrationFiles.forEach((file) => {
    const applied = db
      .prepare<{ filename: string }, { filename: string }>(
        "select filename from _migrations where filename = @filename",
      )
      .get({ filename: file });

    if (applied) {
      return;
    }

    const migration = readFileSync(path.join(migrationsPath, file), "utf8");
    const transaction = db.transaction(() => {
      db.exec(migration);
      db.prepare("insert into _migrations (filename) values (?)").run(file);
    });

    transaction();
  });
}
