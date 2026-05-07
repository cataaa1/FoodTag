"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const PERSIST_KEYS = new Set([
  JSON.stringify(["truck-status"]),
  JSON.stringify(["menu"]),
  JSON.stringify(["public-menu"]),
  JSON.stringify(["admin", "settings"]),
  JSON.stringify(["admin", "categories"]),
  JSON.stringify(["admin", "menu-items"]),
]);

const STORAGE_KEY = "foodtag-qcache-v1";
const CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function readPersistedCache(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { ts: number; entries: Record<string, unknown> };
    if (Date.now() - parsed.ts > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    return parsed.entries;
  } catch {
    return {};
  }
}

function writePersistedCache(entries: Record<string, unknown>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), entries }));
  } catch {}
}

// Module-level singleton — survives navigations, only recreated on hard refresh.
let browserClient: QueryClient | undefined;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 15_000,
        // 24 h in-memory — navigating between admin pages never hits a loading state.
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: true,
      },
    },
  });
}

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always fresh, never shared between requests.
    return makeQueryClient();
  }
  if (!browserClient) {
    browserClient = makeQueryClient();
  }
  return browserClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(getQueryClient);

  // After hydration, save successful fetches to localStorage so the
  // HydrationBoundary on subsequent hard-refreshes still has something to
  // fall back on when server prefetch is unavailable.
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const unsubscribe = cache.subscribe((event) => {
      if (event.type !== "updated") return;
      if (!("action" in event) || (event.action as { type: string }).type !== "success") return;

      const keyStr = JSON.stringify(event.query.queryKey);
      if (!PERSIST_KEYS.has(keyStr)) return;

      const current = readPersistedCache();
      current[keyStr] = event.query.state.data;
      writePersistedCache(current);
    });

    return unsubscribe;
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
