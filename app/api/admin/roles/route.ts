import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
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

    const roles = getDb()
      .prepare<[], RoleRow>("select * from role order by is_system desc, name asc")
      .all()
      .map(mapRole);

    return NextResponse.json({ roles });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireStaffPermission("roles.manage");

    const body = await parseJsonBody(request, roleCreateSchema);
    const id = randomUUID();

    getDb()
      .prepare(
        `
          insert into role (id, name, is_system, permissions_json)
          values (@id, @name, 0, @permissionsJson)
        `,
      )
      .run({
        id,
        name: body.name,
        permissionsJson: JSON.stringify(body.permissions),
      });

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
