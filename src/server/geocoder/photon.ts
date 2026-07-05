import type { Geocoder, GeoHit } from "./geocoder";

interface PhotonFeature {
  geometry?: { type?: string; coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
}

/** Übersetzt eine Photon-GeoJSON-Antwort in Treffer (rein, testbar). */
export function mapPhotonFeatures(json: {
  features?: PhotonFeature[];
}): GeoHit[] {
  return (json.features ?? [])
    .filter(
      (
        f,
      ): f is PhotonFeature & { geometry: { coordinates: [number, number] } } =>
        f.geometry?.type === "Point" &&
        Array.isArray(f.geometry?.coordinates) &&
        f.geometry.coordinates.length === 2 &&
        typeof f.geometry.coordinates[0] === "number" &&
        typeof f.geometry.coordinates[1] === "number",
    )
    .map((feature) => {
      const p = feature.properties ?? {};
      const label = [p.name, p.street, p.postcode, p.city, p.state, p.country]
        .filter(Boolean)
        .join(", ");
      const [lng, lat] = feature.geometry.coordinates;
      return { label: label || "Unbenannter Ort", lat, lng };
    });
}

const PHOTON_URL = "https://photon.komoot.io/api";
const USER_AGENT = "einsatz-lagefuehrung (DRK Katastrophenschutz)";
const FETCH_TIMEOUT_MS = 10_000;

/** Photon-Geocoder – die dünne, ungetestete HTTP-Grenze. */
export const photonGeocoder: Geocoder = {
  async geocode(query: string): Promise<GeoHit[]> {
    const url = `${PHOTON_URL}?q=${encodeURIComponent(query)}&limit=5&lang=de`;
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Geocoder-Fehler: ${response.status}`);
    return mapPhotonFeatures(await response.json());
  },
};

export const GEOCODER_ATTRIBUTION =
  "Adresssuche © OpenStreetMap-Mitwirkende, via Photon (Komoot)";
