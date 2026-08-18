import { cookies } from "next/headers";

import { ApiError } from "@/lib/api/errors";
import { verifyPassword } from "@/lib/auth/password";
import {
  ACTIVE_TRUCK_COOKIE,
  STAFF_SESSION_COOKIE,
  verifyStaffSessionToken,
} from "@/lib/auth/staff-token";
import { getDb } from "@/lib/db/client";

export type PlatformAdmin = {
  id: string;
  email: string;
  fullName: string;
};

type PlatformAdminRow = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  active: number;
};

function mapPlatformAdmin(row: PlatformAdminRow): PlatformAdmin {
  return { id: row.id, email: row.email, fullName: row.full_name };
}

export async function authenticatePlatformAdmin(
  email: string,
  password: string,
): Promise<PlatformAdmin | null> {
  const result = await getDb().execute({
    sql: "select * from platform_admin where lower(email) = lower(?) and active = 1",
    args: [email],
  });
  const row = result.rows[0] as unknown as PlatformAdminRow | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    return null;
  }

  return mapPlatformAdmin(row);
}

export async function getPlatformAdminById(id: string): Promise<PlatformAdmin | null> {
  const result = await getDb().execute({
    sql: "select * from platform_admin where id = ? and active = 1",
    args: [id],
  });
  const row = result.rows[0] as unknown as PlatformAdminRow | undefined;

  return row ? mapPlatformAdmin(row) : null;
}

export async function getPlatformSession(): Promise<PlatformAdmin | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    const payload = await verifyStaffSessionToken(token);
    if (payload.kind !== "platform" || !payload.platformAdminId) return null;

    return getPlatformAdminById(payload.platformAdminId);
  } catch {
    return null;
  }
}

export async function requirePlatformAdmin() {
  const admin = await getPlatformSession();

  if (!admin) {
    throw new ApiError(401, "UNAUTHORIZED", "Necesitás una sesión de superadmin");
  }

  return admin;
}

/** Truck que el superadmin eligió en su home. Null si todavía no eligió ninguno. */
export async function getActiveTruckIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_TRUCK_COOKIE)?.value ?? null;
}
