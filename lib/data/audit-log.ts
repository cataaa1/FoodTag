import { randomUUID } from "node:crypto";

import { getCurrentTruckId } from "@/lib/data/truck-status";
import { getDb } from "@/lib/db/client";

type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  metadata_json: string;
  at: string;
};

export type AuditLogEntry = {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  at: string;
};

export type AuditLogWriteInput = {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

function parseMetadata(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function listAuditLog(limit = 200): Promise<AuditLogEntry[]> {
  const result = await getDb().execute({
    sql: `
      select
        audit_log.id,
        audit_log.actor_user_id,
        staff_user.full_name as actor_name,
        staff_user.email as actor_email,
        audit_log.action,
        audit_log.target_type,
        audit_log.target_id,
        audit_log.reason,
        audit_log.metadata_json,
        audit_log.at
      from audit_log
      left join staff_user on staff_user.id = audit_log.actor_user_id
      order by audit_log.at desc
      limit ?
    `,
    args: [limit],
  });

  return (result.rows as unknown as AuditLogRow[]).map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    actorEmail: row.actor_email,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    metadata: parseMetadata(row.metadata_json),
    at: row.at,
  }));
}

export async function writeAuditLog(input: AuditLogWriteInput): Promise<void> {
  await getDb().execute({
    sql: `
      insert into audit_log (
        id,
        truck_id,
        actor_user_id,
        action,
        target_type,
        target_id,
        reason,
        metadata_json
      )
      -- el actor puede ser el superadmin, que no tiene fila en staff_user:
      -- la subconsulta devuelve null en vez de romper la foreign key
      values (?, ?, (select id from staff_user where id = ?), ?, ?, ?, ?, ?)
    `,
    args: [
      randomUUID(),
      await getCurrentTruckId(),
      input.actorUserId,
      input.action,
      input.targetType,
      input.targetId,
      input.reason ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  });
}
