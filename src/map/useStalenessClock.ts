"use client";

import { useEffect, useState } from "react";
import { STALE_TICK_MS } from "./staleness";

/**
 * Liefert einen Zeitstempel, der alle {@link STALE_TICK_MS} tickt. Staleness ist
 * zeitabhängig: ohne neue Meldung altert ein Standort weiter, daher periodisch
 * neu bewerten (kein SSE für die Alterung). Von Führungs- und Geräteansicht
 * geteilt.
 */
export function useStalenessClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), STALE_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}
