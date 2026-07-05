import type { MapView } from "./view";

const storageKey = (operationId: string) => `einsatz:lastView:${operationId}`;

function isMapView(value: unknown): value is MapView {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as MapView).lat === "number" &&
    typeof (value as MapView).lng === "number" &&
    typeof (value as MapView).zoom === "number"
  );
}

/** Liest den lokal je Browser zuletzt genutzten Ausschnitt eines Einsatzes. */
export function readLastView(operationId: string): MapView | null {
  try {
    const raw = localStorage.getItem(storageKey(operationId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isMapView(parsed)
      ? { lat: parsed.lat, lng: parsed.lng, zoom: parsed.zoom }
      : null;
  } catch {
    return null;
  }
}

/** Merkt sich den zuletzt genutzten Ausschnitt eines Einsatzes lokal im Browser. */
export function writeLastView(operationId: string, view: MapView): void {
  try {
    localStorage.setItem(storageKey(operationId), JSON.stringify(view));
  } catch {
    // Speicher nicht verfügbar (z. B. privater Modus) – Ausschnitt geht nur lokal verloren.
  }
}
