import { shouldGeocode } from "@/map/search";
import { type Geocoder, type GeoHit, RateGate } from "./geocoder";
import { photonGeocoder } from "./photon";

/** Längere Anfragen ergeben keine Treffer, ohne Photon zu fragen. */
const MAX_GEOCODE_QUERY_LENGTH = 200;

// Serverweites Rate-Limit ~1 req/s über eine Container-Instanz – geteilt von der
// Führungs-Action und den Token-Routen, damit alle zusammen den externen
// Geocoder schonen. Die Token-Routen (Ansichts- und Gerätelinks) gehen vorher
// zusätzlich durch ein eigenes, langsameres Limit, damit den angemeldeten
// Nutzern mindestens zwei Drittel bleiben. An globalThis gepinnt, um
// HMR/Modul-Neuladen zu überstehen.
const globalForGate = globalThis as unknown as {
  s2GeocodeGate?: RateGate;
  tokenLinkGeocodeGate?: RateGate;
};
globalForGate.s2GeocodeGate ??= new RateGate(1000);
globalForGate.tokenLinkGeocodeGate ??= new RateGate(3000);
export const geocodeGate = globalForGate.s2GeocodeGate;
export const tokenLinkGeocodeGate = globalForGate.tokenLinkGeocodeGate;

/**
 * Adress-Suche mit Guard (zu kurze und zu lange Anfragen unterdrückt),
 * Rate-Limit und Fehler-Degradierung (bei Geocoder-Fehler leere Liste, damit
 * die Objektsuche nutzbar bleibt). Der Geocoder ist für Tests injizierbar.
 */
export async function geocodeQuery(
  query: string,
  geocoder: Geocoder = photonGeocoder,
): Promise<GeoHit[]> {
  const q = query.trim();
  if (!isWorthGeocoding(q)) return [];
  if (!geocodeGate.tryAcquire()) return [];
  try {
    return await geocoder.geocode(q);
  } catch {
    return [];
  }
}

/**
 * Adress-Suche über einen Ansichts- oder Gerätelink: zuerst das eigene Limit
 * der Token-Routen, dann das gemeinsame. In dieser Reihenfolge belegt eine
 * abgewiesene Token-Suche nie einen Platz, der angemeldeten Nutzern fehlt.
 */
export async function geocodeQueryForTokenLink(
  query: string,
  geocoder: Geocoder = photonGeocoder,
): Promise<GeoHit[]> {
  if (!isWorthGeocoding(query.trim())) return [];
  if (!tokenLinkGeocodeGate.tryAcquire()) return [];
  return geocodeQuery(query, geocoder);
}

function isWorthGeocoding(trimmedQuery: string): boolean {
  return (
    shouldGeocode(trimmedQuery) &&
    [...trimmedQuery].length <= MAX_GEOCODE_QUERY_LENGTH
  );
}
