import type { PositionSource } from "@/server/mapsymbols/map-symbols";

/** Ein gerätegemeldeter Standort gilt nach 3 Minuten ohne neue Meldung als veraltet. */
export const STALE_AFTER_MS = 3 * 60 * 1000;

/** Takt, in dem Ansichten die Veraltung ohne neue Meldung periodisch neu bewerten. */
export const STALE_TICK_MS = 30 * 1000;

/**
 * Veraltet ist nur ein **gerätegemeldetes** Kartenzeichen, dessen letzte Meldung
 * länger als 3 Minuten zurückliegt. Manuell gesetzte Zeichen werden nie veraltet.
 */
export function isStale(
  source: PositionSource,
  reportedAt: Date | null,
  now: number,
): boolean {
  if (source !== "device" || !reportedAt) return false;
  return now - reportedAt.getTime() > STALE_AFTER_MS;
}
