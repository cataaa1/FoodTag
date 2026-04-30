import { createClient } from "@libsql/client";

import { getServerEnv } from "@/lib/config/env";

let client: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (client) return client;

  const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = getServerEnv();
  client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });
  return client;
}
