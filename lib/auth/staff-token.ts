import { jwtVerify, SignJWT } from "jose";

import { getServerEnv } from "@/lib/config/env";

export const STAFF_SESSION_COOKIE = "foodtag_staff_session";

/**
 * Cookie de un solo uso que emite el login. Le avisa al middleware que la
 * sesion se acaba de crear, para que la primera carga del panel no vuelva a
 * pedir credenciales y quede en bucle.
 */
export const STAFF_FRESH_LOGIN_COOKIE = "foodtag_staff_fresh";
export const STAFF_FRESH_LOGIN_MAX_AGE_SECONDS = 60;

export type StaffSessionJwt = {
  staffUserId: string;
};

function getStaffSecret() {
  return new TextEncoder().encode(getServerEnv().STAFF_SESSION_SECRET);
}

export async function createStaffSessionToken(staffUserId: string) {
  return new SignJWT({ staffUserId } satisfies StaffSessionJwt)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(getStaffSecret());
}

export async function verifyStaffSessionToken(token: string) {
  const verified = await jwtVerify<StaffSessionJwt>(token, getStaffSecret());
  return verified.payload;
}
