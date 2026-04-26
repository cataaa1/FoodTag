import webpush from "web-push";

import { getClientEnv, getServerEnv } from "@/lib/config/env";

let initialized = false;

export function initVapid() {
  if (initialized) return;

  const { VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL } = getServerEnv();
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY } = getClientEnv();

  if (!VAPID_PRIVATE_KEY || !VAPID_CONTACT_EMAIL || !NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return;
  }

  webpush.setVapidDetails(
    `mailto:${VAPID_CONTACT_EMAIL}`,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );

  initialized = true;
}

export function isVapidConfigured(): boolean {
  const { VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL } = getServerEnv();
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY } = getClientEnv();
  return !!(VAPID_PRIVATE_KEY && VAPID_CONTACT_EMAIL && NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}
