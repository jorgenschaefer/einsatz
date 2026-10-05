import L from "leaflet";
import "./leaflet-markers.css";
import type { MarkerSpec } from "./adapter";
import { tooltipText } from "./tooltip-text";

/** Kantenlänge (px) eines Kartenzeichen-Markers. */
const MARKER_SIZE = 40;

/** Die Marker der Kartenzeichen, per id gesetzt und entfernt. */
export function createMarkerLayers(map: L.Map) {
  const markers = new Map<string, L.Marker>();
  // Zuletzt gerenderte Signatur je id – erlaubt das Überspringen
  // unveränderter Marker bei jedem Reconcile (kein Flackern).
  const markerSigs = new Map<string, string>();
  // Während des Ziehens gehört die Position der Hand, nicht dem Server.
  const dragged = new Set<string>();

  return {
    set(id: string, spec: MarkerSpec) {
      const existing = markers.get(id);
      if (existing) {
        if (!dragged.has(id)) existing.setLatLng([spec.lat, spec.lng]);
        const sig = markerVisualSignature(spec);
        if (markerSigs.get(id) !== sig) {
          // Nur bei geändertem Icon/Deckkraft/Label neu setzen (setIcon allokiert).
          existing.setIcon(iconFor(spec));
          existing.setOpacity(spec.opacity ?? 1);
          applyLabel(existing, spec.label);
          markerSigs.set(id, sig);
        }
        return;
      }
      const marker = L.marker([spec.lat, spec.lng], {
        icon: iconFor(spec),
        draggable: spec.draggable ?? false,
        opacity: spec.opacity ?? 1,
      }).addTo(map);
      applyLabel(marker, spec.label);
      marker.on("dragstart", () => dragged.add(id));
      marker.on("dragend", () => dragged.delete(id));
      const { onDragEnd, onClick } = spec;
      if (onDragEnd) {
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          onDragEnd({ lat: p.lat, lng: p.lng });
        });
      }
      if (onClick) {
        marker.on("click", () => onClick());
      }
      markers.set(id, marker);
      markerSigs.set(id, markerVisualSignature(spec));
    },
    remove(id: string) {
      const marker = markers.get(id);
      if (marker) {
        marker.remove();
        markers.delete(id);
        markerSigs.delete(id);
        dragged.delete(id);
      }
    },
  };
}

const iconFor = (spec: MarkerSpec) =>
  L.icon({
    iconUrl: spec.iconUrl,
    iconSize: [MARKER_SIZE, MARKER_SIZE],
    iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
    // Das Bezeichnungs-Tooltip (direction "right") setzt am Anker an. Ohne
    // Versatz läge es über dem Symbol; um die rechte Symbolhälfte plus 6 px
    // für den Tooltip-Pfeil nach rechts rücken, damit die Beschriftung
    // vollständig neben dem Zeichen steht.
    tooltipAnchor: [MARKER_SIZE / 2 + 6, 0],
  });

// Bezeichnung als permanentes Label rechts neben dem Marker (statt im Symbol).
// Eigene Klasse: kastenlos mit weißem Halo statt weißem Kasten (siehe CSS).
function applyLabel(marker: L.Marker, label: string | undefined) {
  marker.unbindTooltip();
  if (label)
    marker.bindTooltip(tooltipText(label), {
      permanent: true,
      direction: "right",
      className: "kartenzeichen-label",
    });
}

/**
 * Icon, Deckkraft und Bezeichnung eines Markers – was neu gesetzt werden
 * muss. Die Position wird separat (günstig) aktualisiert; Callbacks
 * (onClick/onDragEnd) wechseln bei jedem Render die Identität, ändern aber
 * nichts am Erscheinungsbild.
 */
export function markerVisualSignature(spec: MarkerSpec): string {
  return JSON.stringify({
    iconUrl: spec.iconUrl,
    label: spec.label,
    opacity: spec.opacity,
  });
}
