/** Ab dieser Bewegung seit der letzten Meldung wird eine neue gesendet. */
const MIN_MOVE_M = 10;
/** Spätestens nach dieser Zeit wird auch ohne Bewegung neu gesendet. */
const MIN_INTERVAL_MS = 30_000;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Übergabe-URL an die Karten-App des Geräts (geo-URI, kein eigenes Routing). */
export function navigationUrl(lat: number, lng: number): string {
  return `geo:${lat},${lng}?q=${lat},${lng}`;
}

export interface LastReport extends LatLng {
  at: number;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Großkreis-Distanz zwischen zwei Punkten in Metern (Haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Gesendet wird, wenn seit der letzten Meldung > ~10 m Bewegung ODER > ~30 s
 * vergangen sind – was zuerst eintritt. Ohne vorherige Meldung immer.
 */
export function shouldSendPosition(
  last: LastReport | null,
  next: LatLng,
  now: number,
): boolean {
  if (!last) return true;
  return (
    haversineMeters(last, next) > MIN_MOVE_M || now - last.at > MIN_INTERVAL_MS
  );
}
