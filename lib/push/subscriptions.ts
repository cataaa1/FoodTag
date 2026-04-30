import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/client";

type PushSubscriptionRow = {
  id: string;
  order_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  platform: string | null;
  created_at: string;
  last_used_at: string | null;
  failed_at: string | null;
};

export type StoredPushSubscription = {
  id: string;
  orderId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  platform: string | null;
};

function rowToSubscription(row: PushSubscriptionRow): StoredPushSubscription {
  return {
    id: row.id,
    orderId: row.order_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    userAgent: row.user_agent,
    platform: row.platform as StoredPushSubscription["platform"],
  };
}

export type SavePushSubscriptionInput = {
  orderId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  platform?: "android" | "ios" | "desktop";
};

export async function savePushSubscription(
  input: SavePushSubscriptionInput,
): Promise<StoredPushSubscription> {
  const db = getDb();
  const id = randomUUID();

  await db.execute({
    sql: `
      insert into push_subscription (id, order_id, endpoint, p256dh, auth, user_agent, platform)
      values (?, ?, ?, ?, ?, ?, ?)
      on conflict(endpoint) do update set
        order_id = excluded.order_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        platform = excluded.platform,
        failed_at = null,
        last_used_at = datetime('now')
    `,
    args: [
      id,
      input.orderId,
      input.endpoint,
      input.p256dh,
      input.auth,
      input.userAgent ?? null,
      input.platform ?? null,
    ],
  });

  const rowResult = await db.execute({
    sql: "select * from push_subscription where endpoint = ?",
    args: [input.endpoint],
  });
  const row = rowResult.rows[0] as unknown as PushSubscriptionRow | undefined;

  if (!row) throw new Error("push_subscription insert failed");
  return rowToSubscription(row);
}

export async function getPushSubscriptionsForOrder(
  orderId: string,
): Promise<StoredPushSubscription[]> {
  const result = await getDb().execute({
    sql: "select * from push_subscription where order_id = ? and failed_at is null",
    args: [orderId],
  });
  return (result.rows as unknown as PushSubscriptionRow[]).map(rowToSubscription);
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await getDb().execute({
    sql: "delete from push_subscription where endpoint = ?",
    args: [endpoint],
  });
}

export async function markPushSubscriptionFailed(endpoint: string): Promise<void> {
  await getDb().execute({
    sql: "update push_subscription set failed_at = datetime('now') where endpoint = ?",
    args: [endpoint],
  });
}

export async function markPushSubscriptionUsed(endpoint: string): Promise<void> {
  await getDb().execute({
    sql: "update push_subscription set last_used_at = datetime('now') where endpoint = ?",
    args: [endpoint],
  });
}
