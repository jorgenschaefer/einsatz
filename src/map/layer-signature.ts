import type { AreaSpec, ImageOverlaySpec, MarkerSpec } from "./adapter";

/**
 * Serialisierbare „Signaturen" der sichtbaren Eigenschaften einer Kartenebene.
 * Callbacks (onClick/onDragEnd) fließen bewusst nicht ein – sie wechseln bei
 * jedem Render die Identität, ändern aber nichts am Erscheinungsbild. Gleicht
 * die Signatur der zuletzt gerenderten, kann der Adapter das Neuaufbauen der
 * Ebene überspringen (kein Flackern, kein Bild-Neuladen bei jedem SSE-Ereignis).
 */

/** Icon/Deckkraft eines Markers – Position wird separat (günstig) aktualisiert. */
export function markerVisualSignature(spec: MarkerSpec): string {
  return JSON.stringify({
    iconUrl: spec.iconUrl,
    label: spec.label,
    opacity: spec.opacity,
  });
}

export function areaSignature(spec: AreaSpec): string {
  return JSON.stringify({
    geometry: spec.geometry,
    color: spec.color,
    opacity: spec.opacity,
    label: spec.label,
  });
}

export function kmlSignature(spec: {
  content: string;
  visible: boolean;
}): string {
  return JSON.stringify({ content: spec.content, visible: spec.visible });
}

export function imageSignature(spec: ImageOverlaySpec): string {
  return JSON.stringify({
    imageUrl: spec.imageUrl,
    placement: spec.placement,
    aspect: spec.aspect,
    visible: spec.visible,
  });
}
