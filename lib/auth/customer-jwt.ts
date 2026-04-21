import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { ApiError } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/config/env";

export const CUSTOMER_SESSION_COOKIE = "foodtag_customer_session";

export type CustomerSessionPayload = {
  customerId: string;
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

export async function getCustomerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifyCustomerSession(token);
  } catch {
    return null;
  }
}

export async function requireCustomerSession() {
  const session = await getCustomerSession();

  if (!session) {
    throw new ApiError(401, "UNAUTHORIZED", "Completá tus datos para seguir");
  }

  return session;
}
