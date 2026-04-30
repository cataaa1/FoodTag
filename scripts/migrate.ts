import { config as loadEnv } from "dotenv";

import { migrateDb } from "../lib/db/migrate";

loadEnv({ path: ".env.local" });

migrateDb()
  .then(() => console.log("Turso DB migrada con éxito"))
  .catch((err) => { console.error("Error en migración:", err); process.exit(1); });
