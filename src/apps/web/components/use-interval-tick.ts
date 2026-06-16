"use client";

import { useEffect, useState } from "react";

/**
 * Forces a re-render on a fixed interval so that values derived from the current
 * time (e.g. SLA countdown badges computed from Date.now()) stay live instead of
 * freezing at their first-render value until the next manual refresh.
 */
export function useIntervalTick(intervalMs: number): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((tick) => tick + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
}
