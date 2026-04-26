import { randomUUID } from "node:crypto";
import webpush from "web-push";

import { getDb } from "@/lib/db/client";
import {
  getPushSubscriptionsForOrder,
  markPushSubscriptionFailed,
  markPushSubscriptionUsed,
} from "@/lib/push/subscriptions";
import { initVapid, isVapidConfigured } from "@/lib/push/vapid";

export type PushPayload = {
  type: "ready" | "pulse";
  ticket: number;
  title: string;
  body: string;
  tag: string;
  orderId: string;
};

function logBeeperEvent(
  orderId: string,
  kind: "push_sent" | "push_failed",
  metadata?: Record<string, unknown>,
) {
  try {
    const db = getDb();
    db.prepare<{ id: string; order_id: string; kind: string; metadata_json: string | null }>(
      "insert into beeper_event (id, order_id, kind, metadata_json) values (@id, @order_id, @kind, @metadata_json)",
    ).run({
      id: randomUUID(),
      order_id: orderId,
      kind,
      metadata_json: metadata ? JSON.stringify(metadata) : null,
    });
  } catch {
    // fire-and-forget, never throw
  }
}

export async function sendPushToOrder(orderId: string, payload: PushPayload): Promise<void> {
  if (!isVapidConfigured()) return;

  initVapid();

  const subscriptions = getPushSubscriptionsForOrder(orderId);
  if (subscriptions.length === 0) return;

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 },
        );
        markPushSubscriptionUsed(sub.endpoint);
        logBeeperEvent(orderId, "push_sent", { endpoint: sub.endpoint, type: payload.type });
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          markPushSubscriptionFailed(sub.endpoint);
        }
        logBeeperEvent(orderId, "push_failed", {
          endpoint: sub.endpoint,
          status,
          type: payload.type,
        });
      }
    }),
  );
}
