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

/**
 * La cookie de sesion sirve a los dos tipos de cuenta:
 *   kind "staff"    -> empleado de un truck (staffUserId)
 *   kind "platform" -> superadmin de plataforma (platformAdminId)
 * Los tokens viejos no traen `kind`; se asumen "staff".
 */
export type StaffSessionJwt = {
  staffUserId?: string;
  platformAdminId?: string;
  kind?: "staff" | "platform";
};

/** Truck en el que esta parado el superadmin. Los empleados no la usan. */
export const ACTIVE_TRUCK_COOKIE = "foodtag_active_truck";

function getStaffSecret() {
  return new TextEncoder().encode(getServerEnv().STAFF_SESSION_SECRET);
}

export async function createStaffSessionToken(staffUserId: string) {
  return new SignJWT({ staffUserId, kind: "staff" } satisfies StaffSessionJwt)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(getStaffSecret());
}

export async function createPlatformSessionToken(platformAdminId: string) {
  return new SignJWT({ platformAdminId, kind: "platform" } satisfies StaffSessionJwt)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(getStaffSecret());
}

export async function verifyStaffSessionToken(token: string) {
  const verified = await jwtVerify<StaffSessionJwt>(token, getStaffSecret());
  return verified.payload;
}
