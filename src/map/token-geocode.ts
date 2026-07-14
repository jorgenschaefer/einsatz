import type { GeoHit } from "@/server/geocoder/geocoder";

/**
 * Token-gebundene Adresssuche ohne Login, geteilt von Geräte- und Ansichtslink.
 * `basePath` ist `/device` bzw. `/view`. Eine nicht-ok-Antwort liefert eine leere
 * Trefferliste, damit die Suche im Frontend nicht abbricht.
 */
export async function tokenGeocode(
  basePath: string,
  token: string,
  query: string,
): Promise<GeoHit[]> {
  const res = await fetch(
    `${basePath}/${token}/geocode?q=${encodeURIComponent(query)}`,
  );
  return res.ok ? ((await res.json()) as GeoHit[]) : [];
}
