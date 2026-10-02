import L from "leaflet";
import "leaflet-imageoverlay-rotated";
import type { ImageOverlaySpec } from "./adapter";
import { type ImagePlacement, imageOverlayCorners } from "./image-overlay";
import { imageSignature } from "./layer-signature";
import { createImageOverlayHandles } from "./leaflet-image-overlay-handles";

/** Vom Plugin ergänzt: platziert ein (dreh-/scherbares) Bild über drei Ecken. */
type RotatedImageOverlayFactory = (
  imageUrl: string,
  topLeft: L.LatLngExpression,
  topRight: L.LatLngExpression,
  bottomLeft: L.LatLngExpression,
  options?: { opacity?: number },
) => L.ImageOverlay;

type Repositionable = {
  reposition: (
    tl: L.LatLngExpression,
    tr: L.LatLngExpression,
    bl: L.LatLngExpression,
  ) => void;
};

/**
 * Die Bild-Overlays auf der Karte, per id gesetzt und entfernt, und das
 * Bearbeiten eines davon über seine Griffe.
 */
export function createImageOverlayLayers(map: L.Map) {
  const imageLayers = new Map<string, L.ImageOverlay>();
  // Zuletzt gerenderte Signatur je id – unveränderte Bilder werden nicht neu geladen.
  const imageSigs = new Map<string, string>();
  // Zuletzt gesetzte Bild-Spec je id – für die Griffe im Bearbeiten-Modus.
  const imageSpecs = new Map<string, ImageOverlaySpec>();
  const handles = createImageOverlayHandles(map);
  let editing: { id: string; onChange: (p: ImagePlacement) => void } | null =
    null;

  /** Zeichnet das Overlay während einer Geste live an der neuen Platzierung. */
  const previewPlacement = (placement: ImagePlacement) => {
    if (!editing) return;
    const spec = imageSpecs.get(editing.id);
    const layer = imageLayers.get(editing.id);
    if (!spec || !layer) return;
    const c = imageOverlayCorners(placement, spec.aspect);
    (layer as unknown as Repositionable).reposition(
      [c.topLeft.lat, c.topLeft.lng],
      [c.topRight.lat, c.topRight.lng],
      [c.bottomLeft.lat, c.bottomLeft.lng],
    );
  };

  const renderHandles = () => {
    handles.clear();
    if (!editing) return;
    const spec = imageSpecs.get(editing.id);
    if (!spec || !imageLayers.has(editing.id)) return;
    handles.show(spec, {
      onDrag: previewPlacement,
      onDragEnd: (placement) => editing?.onChange(placement),
    });
  };

  const set = (id: string, spec: ImageOverlaySpec) => {
    imageSpecs.set(id, spec);
    const sig = imageSignature(spec);
    if (imageSigs.get(id) === sig) return; // unverändert
    imageSigs.set(id, sig);
    imageLayers.get(id)?.remove();
    imageLayers.delete(id);
    if (!spec.visible) return;
    const layer = renderImageOverlay(spec);
    layer.addTo(map);
    imageLayers.set(id, layer);
    // Nach dem Neuaufbau der Ebene die Griffe neu setzen (neue Instanz).
    if (editing?.id === id) renderHandles();
  };

  const stopEdit = () => {
    editing = null;
    handles.clear();
  };

  return {
    set,
    remove(id: string) {
      imageLayers.get(id)?.remove();
      imageLayers.delete(id);
      imageSigs.delete(id);
      imageSpecs.delete(id);
      if (editing?.id === id) stopEdit();
    },
    restore(id: string) {
      const spec = imageSpecs.get(id);
      if (!spec) return;
      imageSigs.delete(id);
      set(id, spec);
    },
    startEdit(id: string, onChange: (placement: ImagePlacement) => void) {
      editing = { id, onChange };
      renderHandles();
    },
    stopEdit,
  };
}

function renderImageOverlay(spec: ImageOverlaySpec): L.ImageOverlay {
  const plugin = L.imageOverlay as unknown as {
    rotated: RotatedImageOverlayFactory;
  };
  const c = imageOverlayCorners(spec.placement, spec.aspect);
  return plugin.rotated(
    spec.imageUrl,
    [c.topLeft.lat, c.topLeft.lng],
    [c.topRight.lat, c.topRight.lng],
    [c.bottomLeft.lat, c.bottomLeft.lng],
    { opacity: spec.placement.opacity },
  );
}
