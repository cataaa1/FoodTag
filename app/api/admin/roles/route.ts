import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import {
  requireStaffPermission,
  requireSuperAdmin,
} from "@/lib/auth/staff-session";
import { writeAuditLog } from "@/lib/data/audit-log";
import { getCurrentTruckId } from "@/lib/data/truck-status";
import { getDb } from "@/lib/db/client";
import { roleCreateSchema } from "@/lib/validators/menu";

type RoleRow = {
  id: string;
  name: string;
  is_system: number;
  permissions_json: string;
};

function mapRole(row: RoleRow) {
  return {
    id: row.id,
    name: row.name,
    is_system: Boolean(row.is_system),
    permissions: JSON.parse(row.permissions_json) as string[],
  };
}

export async function GET() {
  try {
    await requireStaffPermission("roles.manage");

    const result = await getDb().execute(
      "select * from role order by is_system desc, name asc",
    );
    const roles = (result.rows as unknown as RoleRow[]).map(mapRole);

    return NextResponse.json({ roles });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireSuperAdmin();
    const body = await parseJsonBody(request, roleCreateSchema);
    const id = randomUUID();

    await getDb().execute({
      sql: `
        insert into role (id, truck_id, name, is_system, permissions_json)
        values (?, ?, ?, 0, ?)
      `,
      args: [id, await getCurrentTruckId(), body.name, JSON.stringify(body.permissions)],
    });

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "role.created",
      targetType: "role",
      targetId: id,
      metadata: {
        name: body.name,
        permissions: body.permissions,
      },
    });

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
