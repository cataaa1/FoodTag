import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
});

const serverEnvSchema = clientEnvSchema.extend({
  TURSO_DATABASE_URL: z.string().min(1),
  TURSO_AUTH_TOKEN: z.string().min(1),
  CUSTOMER_JWT_SECRET: z.string().min(32),
  STAFF_SESSION_SECRET: z.string().min(32),
  MERCADO_PAGO_ACCESS_TOKEN: z.string().min(1).optional(),
  MERCADO_PAGO_WEBHOOK_SECRET: z.string().min(1).optional(),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_ADMIN_FULL_NAME: z.string().min(2).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_CONTACT_EMAIL: z.string().email().optional(),
  HANDOFF_TOKEN_SECRET: z.string().min(32),
});

type ClientEnv = z.infer<typeof clientEnvSchema>;
type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedClientEnv: ClientEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;

export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) {
    return cachedClientEnv;
  }

  cachedClientEnv = clientEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });

  return cachedClientEnv;
}

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  cachedServerEnv = serverEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    CUSTOMER_JWT_SECRET: process.env.CUSTOMER_JWT_SECRET,
    STAFF_SESSION_SECRET: process.env.STAFF_SESSION_SECRET,
    MERCADO_PAGO_ACCESS_TOKEN: process.env.MERCADO_PAGO_ACCESS_TOKEN || undefined,
    MERCADO_PAGO_WEBHOOK_SECRET: process.env.MERCADO_PAGO_WEBHOOK_SECRET || undefined,
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
    SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
    SEED_ADMIN_FULL_NAME: process.env.SEED_ADMIN_FULL_NAME,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || undefined,
    VAPID_CONTACT_EMAIL: process.env.VAPID_CONTACT_EMAIL || undefined,
    HANDOFF_TOKEN_SECRET: process.env.HANDOFF_TOKEN_SECRET,
  });

  return cachedServerEnv;
}
