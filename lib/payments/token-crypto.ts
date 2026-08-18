import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

import { getServerEnv } from "@/lib/config/env";

/**
 * Cifrado del access token de Mercado Pago de cada foodtruck.
 *
 * El token permite cobrar en nombre del truck, asi que no puede quedar en
 * texto plano en la base: quien lea una copia del backup podria usarlo. Se
 * guarda cifrado con AES-256-GCM, que ademas autentica: si alguien altera el
 * valor guardado, el descifrado falla en vez de devolver basura.
 *
 * La clave sale de STAFF_SESSION_SECRET para no sumar otra variable de entorno
 * obligatoria. Cambiarla invalida los tokens guardados, que es el mismo efecto
 * que ya tiene sobre las sesiones.
 */
const ALGORITHM = "aes-256-gcm";
const SALT = "foodtag.mp.token.v1";

function getKey() {
  return scryptSync(getServerEnv().STAFF_SESSION_SECRET, SALT, 32);
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);

  // iv.tag.payload — todo en base64url para que entre en una columna de texto
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptToken(stored: string): string | null {
  try {
    const [ivPart, tagPart, payloadPart] = stored.split(".");
    if (!ivPart || !tagPart || !payloadPart) return null;

    const decipher = createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(payloadPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Token alterado, o cifrado con otra clave. Se trata como "sin token".
    return null;
  }
}

/** Muestra los ultimos 4 caracteres para que el admin reconozca cual cargó. */
export function maskToken(plain: string): string {
  if (plain.length <= 4) return "····";
  return `···· ${plain.slice(-4)}`;
}
