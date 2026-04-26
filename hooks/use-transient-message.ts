"use client";

import { useEffect } from "react";

export function useTransientMessage(
  value: string | null,
  onClear: () => void,
  duration = 3_500,
) {
  useEffect(() => {
    if (!value) {
      return;
    }

    const timeoutId = window.setTimeout(onClear, duration);

    return () => window.clearTimeout(timeoutId);
  }, [duration, onClear, value]);
}
