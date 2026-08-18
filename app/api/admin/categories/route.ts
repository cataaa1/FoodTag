import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/route";
import { requireStaffPermission } from "@/lib/auth/staff-session";
import { writeAuditLog } from "@/lib/data/audit-log";
import { getCurrentTruckId } from "@/lib/data/truck-status";
import { getDb } from "@/lib/db/client";
import { categoryCreateSchema } from "@/lib/validators/menu";

type CategoryRow = {
  id: string;
  name: string;
  position: number;
  visible: number;
  created_at: string;
};

function mapCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    visible: Boolean(row.visible),
    created_at: row.created_at,
  };
}

export async function GET() {
  try {
    await requireStaffPermission("menu.read");

    const result = await getDb().execute({
      sql: "select * from category where truck_id = ? order by position asc",
      args: [await getCurrentTruckId()],
    });
    const categories = (result.rows as unknown as CategoryRow[]).map(mapCategory);

    return NextResponse.json({ categories });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireStaffPermission("menu.write");

    const body = await parseJsonBody(request, categoryCreateSchema);
    const db = getDb();
    const id = randomUUID();

    await db.execute({
      sql: `
        insert into category (id, truck_id, name, position, visible)
        values (?, ?, ?, ?, ?)
      `,
      args: [id, await getCurrentTruckId(), body.name, body.position, body.visible ? 1 : 0],
    });

    const categoryResult = await db.execute({
      sql: "select * from category where id = ?",
      args: [id],
    });
    const category = categoryResult.rows[0] as unknown as CategoryRow | undefined;

    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/admin/menu");

    await writeAuditLog({
      actorUserId: context.user.id,
      action: "menu.category.created",
      targetType: "category",
      targetId: id,
      metadata: {
        name: body.name,
        position: body.position,
        visible: body.visible,
      },
    });

    return NextResponse.json({ category: category ? mapCategory(category) : null }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
