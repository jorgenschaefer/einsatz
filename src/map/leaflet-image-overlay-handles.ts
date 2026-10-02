import L from "leaflet";
import "./leaflet-image-overlay-handles.css";
import type { ImageOverlaySpec } from "./adapter";
import {
  type ImagePlacement,
  imageOverlayHandles,
  rotationFromHandle,
  scaleMFromCorner,
} from "./image-overlay";
import type { LatLng } from "./view";

/**
 * Die Griffe zum Verschieben, Skalieren und Drehen eines Bild-Overlays. Jede
 * Geste meldet die Platzierung, die sie ergibt: laufend über `onDrag`, am
 * Ende über `onDragEnd`.
 */
export function createImageOverlayHandles(map: L.Map) {
  const handleMarkers: L.Marker[] = [];
  const cornerIcon = L.divIcon({
    className: "overlay-handle overlay-handle--corner",
    iconSize: [14, 14],
  });
  const rotateIcon = L.divIcon({
    className: "overlay-handle overlay-handle--rotate",
    iconSize: [18, 18],
  });
  const moveIcon = L.divIcon({
    className: "overlay-handle overlay-handle--move",
    iconSize: [22, 22],
  });

  const clear = () => {
    for (const m of handleMarkers) m.remove();
    handleMarkers.length = 0;
  };

  return {
    show(
      spec: Pick<ImageOverlaySpec, "placement" | "aspect">,
      gesture: {
        onDrag: (placement: ImagePlacement) => void;
        onDragEnd: (placement: ImagePlacement) => void;
      },
    ) {
      clear();
      const addHandle = (
        point: LatLng,
        icon: L.DivIcon,
        compute: (pos: LatLng) => ImagePlacement,
      ) => {
        const marker = L.marker([point.lat, point.lng], {
          draggable: true,
          icon,
          keyboard: false,
          zIndexOffset: 2000,
        }).addTo(map);
        const at = () => {
          const p = marker.getLatLng();
          return compute({ lat: p.lat, lng: p.lng });
        };
        marker.on("drag", () => gesture.onDrag(at()));
        marker.on("dragend", () => gesture.onDragEnd(at()));
        handleMarkers.push(marker);
      };

      const h = imageOverlayHandles(spec.placement, spec.aspect);
      const scaleFrom = (pos: LatLng): ImagePlacement => ({
        ...spec.placement,
        scaleM: scaleMFromCorner(spec.placement, spec.aspect, pos),
      });
      for (const corner of [
        h.topLeft,
        h.topRight,
        h.bottomRight,
        h.bottomLeft,
      ]) {
        addHandle(corner, cornerIcon, scaleFrom);
      }
      addHandle(h.rotate, rotateIcon, (pos) => ({
        ...spec.placement,
        rotationDeg: rotationFromHandle(spec.placement, pos),
      }));
      // Verschiebe-Griff in der Mitte: setzt den Mittelpunkt direkt. So bleibt die
      // Bildfläche selbst frei, damit die Karte überall per Drag schwenkbar ist.
      addHandle(h.center, moveIcon, (pos) => ({
        ...spec.placement,
        centerLat: pos.lat,
        centerLng: pos.lng,
      }));
    },
    clear,
  };
}
