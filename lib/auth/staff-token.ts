import { jwtVerify, SignJWT } from "jose";

import { getServerEnv } from "@/lib/config/env";

export const STAFF_SESSION_COOKIE = "foodtag_staff_session";

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
