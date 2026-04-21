import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const ITERATIONS = 120_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString(
    "hex",
  );

  return `${ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [iterationsRaw, salt, hash] = storedHash.split(":");

  if (!iterationsRaw || !salt || !hash) {
    return false;
  }

  const iterations = Number(iterationsRaw);

  if (!Number.isInteger(iterations) || iterations <= 0) {
    return false;
  }

  const candidate = pbkdf2Sync(
    password,
    salt,
    iterations,
    KEY_LENGTH,
    DIGEST,
  );
  const expected = Buffer.from(hash, "hex");

  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}
