import { SignJWT, jwtVerify } from "jose";

import { getServerEnv } from "@/lib/config/env";

const HANDOFF_TOKEN_TTL = "30m";

export type HandoffTokenPayload = {
  customerId: string;
  ticketId: string;
  customerName: string;
  customerPhone: string;
};

function getHandoffSecret() {
  return new TextEncoder().encode(getServerEnv().HANDOFF_TOKEN_SECRET);
}

export async function signHandoffToken(payload: HandoffTokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(HANDOFF_TOKEN_TTL)
    .sign(getHandoffSecret());
}

export async function verifyHandoffToken(token: string): Promise<HandoffTokenPayload> {
  const verified = await jwtVerify<HandoffTokenPayload>(token, getHandoffSecret());
  return verified.payload;
}
