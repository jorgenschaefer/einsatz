/** Ein Kartenausschnitt: Mittelpunkt und Zoomstufe. */
export interface MapView {
  lat: number;
  lng: number;
  zoom: number;
}

/**
 * Maximale Zoomstufe des Tile-Layers. Eine gemeinsame Konstante, damit der
 * Leaflet-Tile-Layer (`leaflet-adapter.ts`) und die serverseitige Validierung
 * der Standardansicht (`assertMapView`) nicht auseinanderlaufen.
 */
export const MAX_TILE_ZOOM = 19;

/** Fallback, wenn weder ein lokaler noch ein Einsatz-Standardausschnitt existiert: Mitte Deutschlands. */
export const FALLBACK_VIEW: MapView = { lat: 51.1633, lng: 10.4477, zoom: 6 };

/**
 * Wählt den Startausschnitt beim Öffnen der Lagekarte: der lokal je Browser
 * zuletzt genutzte Ausschnitt hat Vorrang, sonst der Standardausschnitt des
 * Einsatzes, sonst der Fallback.
 */
export function chooseInitialView(
  localLastView: MapView | null,
  operationDefaultView: MapView | null,
): MapView {
  return localLastView ?? operationDefaultView ?? FALLBACK_VIEW;
}
