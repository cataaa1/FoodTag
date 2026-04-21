import { config as loadEnv } from "dotenv";

import { migrateDb } from "../lib/db/migrate";

loadEnv({ path: ".env.local" });

migrateDb();
console.log("SQLite migrado con éxito");
