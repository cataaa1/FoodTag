import { SignJWT, jwtVerify } from "jose";

import { getServerEnv } from "@/lib/config/env";

export type CustomerSessionPayload = {
  customerName: string;
  customerPhone: string;
};

function getSecret() {
  return new TextEncoder().encode(getServerEnv().CUSTOMER_JWT_SECRET);
}

export async function signCustomerSession(payload: CustomerSessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function verifyCustomerSession(token: string) {
  const verified = await jwtVerify<CustomerSessionPayload>(token, getSecret());
  return verified.payload;
}
