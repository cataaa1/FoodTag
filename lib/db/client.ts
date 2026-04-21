import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { getServerEnv } from "@/lib/config/env";

let db: Database.Database | null = null;

function resolveDbPath() {
  const configuredPath = getServerEnv().SQLITE_DB_PATH;
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(/*turbopackIgnore: true*/ process.cwd(), configuredPath);
}

export function getDb() {
  if (db) {
    return db;
  }

  const dbPath = resolveDbPath();
  mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  return db;
}
