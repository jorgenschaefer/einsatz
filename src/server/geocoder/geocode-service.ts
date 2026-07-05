import { shouldGeocode } from "@/map/search";
import { type Geocoder, type GeoHit, RateGate } from "./geocoder";
import { photonGeocoder } from "./photon";

// Serverweites Rate-Limit ~1 req/s über eine Container-Instanz – geteilt von der
// Führungs-Action und der Geräte-Route, damit beide zusammen den externen
// Geocoder schonen. An globalThis gepinnt, um HMR/Modul-Neuladen zu überstehen.
const globalForGate = globalThis as unknown as { s2GeocodeGate?: RateGate };
globalForGate.s2GeocodeGate ??= new RateGate(1000);
export const geocodeGate = globalForGate.s2GeocodeGate;

/**
 * Adress-Suche mit Guard (zu kurze Anfragen unterdrückt), Rate-Limit und
 * Fehler-Degradierung (bei Geocoder-Fehler leere Liste, damit die Objektsuche
 * nutzbar bleibt). Der Geocoder ist für Tests injizierbar.
 */
export async function geocodeQuery(
  query: string,
  geocoder: Geocoder = photonGeocoder,
): Promise<GeoHit[]> {
  const q = query.trim();
  if (!shouldGeocode(q)) return [];
  if (!geocodeGate.tryAcquire()) return [];
  try {
    return await geocoder.geocode(q);
  } catch {
    return [];
  }
}
