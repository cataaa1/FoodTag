import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.STAFF_SESSION_SECRET = "x".repeat(48);
  process.env.CUSTOMER_JWT_SECRET = "y".repeat(48);
  process.env.HANDOFF_TOKEN_SECRET = "z".repeat(48);
  process.env.TURSO_DATABASE_URL = "file:test.sqlite";
  process.env.TURSO_AUTH_TOKEN = "dummy";
});

describe("cifrado del token de Mercado Pago", () => {
  it("devuelve el mismo token al descifrarlo", async () => {
    const { encryptToken, decryptToken } = await import("./token-crypto");
    const token = "APP_USR-1234567890-abcdef-ghijkl";

    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("nunca guarda el token en claro", async () => {
    const { encryptToken } = await import("./token-crypto");
    const token = "APP_USR-secreto-que-no-debe-verse";

    expect(encryptToken(token)).not.toContain("secreto");
    expect(encryptToken(token)).not.toContain(token);
  });

  it("produce un cifrado distinto cada vez, aun con el mismo token", async () => {
    const { encryptToken } = await import("./token-crypto");

    // Si el IV no fuera aleatorio, dos trucks con el mismo token serian
    // distinguibles mirando la base.
    expect(encryptToken("mismo-token")).not.toBe(encryptToken("mismo-token"));
  });

  it("rechaza un valor alterado en vez de devolver basura", async () => {
    const { encryptToken, decryptToken } = await import("./token-crypto");
    const encrypted = encryptToken("APP_USR-original");
    const [iv, tag, payload = ""] = encrypted.split(".");
    const alterado = `${iv}.${tag}.${payload.slice(0, -4)}AAAA`;

    expect(decryptToken(alterado)).toBeNull();
  });

  it("enmascara dejando ver solo los ultimos 4", async () => {
    const { maskToken } = await import("./token-crypto");

    expect(maskToken("APP_USR-1234567890")).toBe("···· 7890");
    expect(maskToken("abc")).toBe("····");
  });
});
