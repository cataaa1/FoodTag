import { readFileSync } from "node:fs";
import path from "node:path";

import { getDb } from "@/lib/db/client";

export function migrateDb() {
  const db = getDb();
  const migration = readFileSync(
    path.join(process.cwd(), "db", "migrations", "001_initial_sqlite.sql"),
    "utf8",
  );

  db.exec(migration);
}
