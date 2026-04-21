import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { getDb } from "@/lib/db/client";

export function migrateDb() {
  const db = getDb();
  const migrationsPath = path.join(process.cwd(), "db", "migrations");
  const migrationFiles = readdirSync(migrationsPath)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  migrationFiles.forEach((file) => {
    const migration = readFileSync(path.join(migrationsPath, file), "utf8");
    db.exec(migration);
  });
}
