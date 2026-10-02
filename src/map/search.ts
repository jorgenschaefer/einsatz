import type { GeoHit } from "@/server/geocoder/geocoder";

/** Ein Kartenzeichen, wie die Suche es braucht: Bezeichnung und Position. */
export interface SearchableSymbol {
  id: string;
  composition: { text?: string | null };
  lat: number;
  lng: number;
}

/** Ab wann eine Adresssuche sinnvoll ist (zu kurze Anfragen werden unterdrückt). */
const MIN_GEOCODE_QUERY_LENGTH = 3;

export function shouldGeocode(query: string): boolean {
  return query.trim().length >= MIN_GEOCODE_QUERY_LENGTH;
}

export interface ObjectResult {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

/**
 * Durchsucht die geladenen Einsatzobjekte: Kartenzeichen über die Bezeichnung –
 * tolerant, case-insensitiv, Teilstring.
 */
export function searchOperationObjects(
  query: string,
  symbols: SearchableSymbol[],
): ObjectResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: ObjectResult[] = [];

  for (const symbol of symbols) {
    const label = symbol.composition.text;
    if (label?.toLowerCase().includes(q)) {
      results.push({
        id: symbol.id,
        label,
        lat: symbol.lat,
        lng: symbol.lng,
      });
    }
  }

  return results;
}

/** Identifies an address result; the result list holds each key once. */
export function addressResultKey(hit: GeoHit): string {
  return `${hit.label}-${hit.lat}-${hit.lng}`;
}
