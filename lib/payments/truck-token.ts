import { getDb } from "@/lib/db/client";
import { decryptToken, encryptToken, maskToken } from "@/lib/payments/token-crypto";

/**
 * Guarda el token de Mercado Pago del truck. Una cadena vacia lo borra y hace
 * que el truck vuelva a usar el token de las variables de entorno, si existe.
 */
export async function setMpAccessToken(truckId: string, plain: string) {
  await getDb().execute({
    sql: "update truck_config set mp_access_token_encrypted = ?, updated_at = datetime('now') where id = ?",
    args: [plain ? encryptToken(plain) : null, truckId],
  });
}

/**
 * Ultimos 4 caracteres del token, para que el admin reconozca cual cargo.
 * Nunca se devuelve el token completo a la UI.
 */
export async function getMaskedMpToken(truckId: string): Promise<string | null> {
  const result = await getDb().execute({
    sql: "select mp_access_token_encrypted from truck_config where id = ?",
    args: [truckId],
  });
  const stored = (result.rows[0] as unknown as { mp_access_token_encrypted: string | null } | undefined)
    ?.mp_access_token_encrypted;

  if (!stored) return null;

  const plain = decryptToken(stored);
  return plain ? maskToken(plain) : null;
}
