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

export function savePushSubscription(input: SavePushSubscriptionInput): StoredPushSubscription {
  const db = getDb();
  const id = randomUUID();

  db.prepare<{
    id: string;
    order_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    user_agent: string | null;
    platform: string | null;
  }>(`
    insert into push_subscription (id, order_id, endpoint, p256dh, auth, user_agent, platform)
    values (@id, @order_id, @endpoint, @p256dh, @auth, @user_agent, @platform)
    on conflict(endpoint) do update set
      order_id = excluded.order_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      platform = excluded.platform,
      failed_at = null,
      last_used_at = datetime('now')
  `).run({
    id,
    order_id: input.orderId,
    endpoint: input.endpoint,
    p256dh: input.p256dh,
    auth: input.auth,
    user_agent: input.userAgent ?? null,
    platform: input.platform ?? null,
  });

  const row = db
    .prepare<{ endpoint: string }, PushSubscriptionRow>(
      "select * from push_subscription where endpoint = @endpoint",
    )
    .get({ endpoint: input.endpoint });

  if (!row) throw new Error("push_subscription insert failed");
  return rowToSubscription(row);
}

export function getPushSubscriptionsForOrder(orderId: string): StoredPushSubscription[] {
  const db = getDb();
  const rows = db
    .prepare<{ order_id: string }, PushSubscriptionRow>(
      "select * from push_subscription where order_id = @order_id and failed_at is null",
    )
    .all({ order_id: orderId });

  return rows.map(rowToSubscription);
}

export function deletePushSubscription(endpoint: string): void {
  const db = getDb();
  db.prepare<{ endpoint: string }>(
    "delete from push_subscription where endpoint = @endpoint",
  ).run({ endpoint });
}

export function markPushSubscriptionFailed(endpoint: string): void {
  const db = getDb();
  db.prepare<{ endpoint: string }>(
    "update push_subscription set failed_at = datetime('now') where endpoint = @endpoint",
  ).run({ endpoint });
}

export function markPushSubscriptionUsed(endpoint: string): void {
  const db = getDb();
  db.prepare<{ endpoint: string }>(
    "update push_subscription set last_used_at = datetime('now') where endpoint = @endpoint",
  ).run({ endpoint });
}
