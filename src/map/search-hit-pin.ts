import L from "leaflet";
import type { LatLng } from "./view";

/**
 * Above Leaflet's tooltip pane (650: Bezeichnungen of Kartenzeichen, labels of
 * Bereiche), below the popup pane (700). A `zIndexOffset` only lifts a marker
 * within the marker pane, which lies below the tooltip pane.
 */
const SEARCH_HIT_PANE_Z_INDEX = 660;

/**
 * The pin's path spans x -13…13 and y -39…0 around its tip at (0, 0); the
 * frame, in pixels, leaves room for the white outline.
 */
const PIN_FRAME = { left: -14, top: -41, width: 28, height: 42 };

/** Orange pin with white outline and dot. */
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${PIN_FRAME.width}" height="${PIN_FRAME.height}" viewBox="${PIN_FRAME.left} ${PIN_FRAME.top} ${PIN_FRAME.width} ${PIN_FRAME.height}" aria-hidden="true"><path d="M0 0 C -4 -10 -13 -16 -13 -26 A 13 13 0 1 1 13 -26 C 13 -16 4 -10 0 0 Z" fill="#e8590c" stroke="#fff" stroke-width="2"/><circle cx="0" cy="-26" r="5" fill="#fff"/></svg>`;

/**
 * The Suchtreffer's pin, in a pane of its own above every other layer. It
 * catches no taps: placing on the map and tapping a Kartenzeichen beneath it
 * pass through.
 */
export function createSearchHitPin(map: L.Map) {
  const pane = map.createPane("searchHitPane");
  pane.style.zIndex = String(SEARCH_HIT_PANE_Z_INDEX);
  pane.style.pointerEvents = "none";
  const icon = L.divIcon({
    className: "search-hit",
    html: PIN_SVG,
    iconSize: [PIN_FRAME.width, PIN_FRAME.height],
    iconAnchor: [-PIN_FRAME.left, -PIN_FRAME.top],
  });
  let pin: L.Marker | null = null;

  return {
    set(position: LatLng) {
      if (pin) {
        pin.setLatLng([position.lat, position.lng]);
        return;
      }
      pin = L.marker([position.lat, position.lng], {
        icon,
        pane: "searchHitPane",
        interactive: false,
        keyboard: false,
      }).addTo(map);
    },
    clear() {
      pin?.remove();
      pin = null;
    },
  };
}
