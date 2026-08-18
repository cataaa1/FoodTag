import { getDb } from "@/lib/db/client";

/** Intentos fallidos antes de bloquear la cuenta. */
const MAX_ATTEMPTS = 5;
/** Cuanto dura el bloqueo. */
const LOCK_MINUTES = 15;
/** Si pasa este tiempo sin fallar, el contador arranca de cero. */
const WINDOW_MINUTES = 15;

type Row = {
  failed_count: number;
  first_failed_at: string | null;
  locked_until: string | null;
};

export type LockState = { locked: true; minutesLeft: number } | { locked: false };

async function readAttempt(email: string): Promise<Row | undefined> {
  const result = await getDb().execute({
    sql: "select failed_count, first_failed_at, locked_until from login_attempt where email = ?",
    args: [email.toLowerCase()],
  });
  return result.rows[0] as unknown as Row | undefined;
}

export async function getLockState(email: string): Promise<LockState> {
  const row = await readAttempt(email);

  if (!row?.locked_until) return { locked: false };

  const lockedUntil = new Date(`${row.locked_until.replace(" ", "T")}Z`).getTime();
  const msLeft = lockedUntil - Date.now();

  if (msLeft <= 0) return { locked: false };

  return { locked: true, minutesLeft: Math.max(1, Math.ceil(msLeft / 60_000)) };
}

export async function registerFailedAttempt(email: string): Promise<void> {
  const db = getDb();
  const key = email.toLowerCase();
  const row = await readAttempt(key);

  // Si el ultimo fallo quedo lejos, no acumulamos: alguien que se equivoca una
  // vez por semana no tiene por que arrastrar el contador.
  const stale =
    row?.first_failed_at &&
    Date.now() - new Date(`${row.first_failed_at.replace(" ", "T")}Z`).getTime() >
      WINDOW_MINUTES * 60_000;

  const failedCount = !row || stale ? 1 : row.failed_count + 1;
  const shouldLock = failedCount >= MAX_ATTEMPTS;

  await db.execute({
    sql: `
      insert into login_attempt (email, failed_count, first_failed_at, locked_until)
      values (?, ?, datetime('now'), ?)
      on conflict(email) do update set
        failed_count = excluded.failed_count,
        first_failed_at = case
          when ? = 1 then datetime('now')
          else login_attempt.first_failed_at
        end,
        locked_until = excluded.locked_until
    `,
    args: [
      key,
      failedCount,
      shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString().slice(0, 19).replace("T", " ") : null,
      failedCount,
    ],
  });
}

export async function clearFailedAttempts(email: string): Promise<void> {
  await getDb().execute({
    sql: "delete from login_attempt where email = ?",
    args: [email.toLowerCase()],
  });
}

export const LOGIN_THROTTLE_LIMITS = { MAX_ATTEMPTS, LOCK_MINUTES, WINDOW_MINUTES };
