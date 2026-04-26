"use client";

import { useEffect } from "react";

export function useSwRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // SW registration failing is non-fatal; push won't work but the rest does
      });
  }, []);
}
