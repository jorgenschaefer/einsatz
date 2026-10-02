import type { AreaGeometry, AreaShape } from "./area";
import type { ImagePlacement } from "./image-overlay";
import type { LatLng, MapView, ViewExtent } from "./view";

/** Ein Marker auf der Karte (z. B. ein Kartenzeichen), per id verwaltet. */
export interface MarkerSpec {
  lat: number;
  lng: number;
  /** SVG-data:-URI des taktischen Zeichens. */
  iconUrl: string;
  /** Bezeichnung, permanent als Label rechts neben dem Marker. */
  label?: string;
  draggable?: boolean;
  /** 0–1; für ausgegraute (veraltete) Kartenzeichen. Default voll deckend. */
  opacity?: number;
  onDragEnd?: (pos: LatLng) => void;
  onClick?: () => void;
}

/**
 * Imperatives Karten-Adapter-Interface. Die App spricht ausschließlich hierüber
 * mit der Karte, nie direkt mit Leaflet – so bleibt ein späterer Anbieterwechsel
 * ein eng umgrenzter Umbau. Marker werden per id gesetzt/entfernt (add/update/
 * remove) passend zum Reconciliation-Muster aus dem geladenen Einsatz-Zustand.
 */
/** Ein Bereich (Polygon/Linie/Kreis) auf der Karte, per id verwaltet. */
export interface AreaSpec {
  geometry: AreaGeometry;
  color: string;
  /** 0–1; Füllung bei Polygon/Kreis, Strich bei der Linie. */
  opacity: number;
  label: string;
}

/** Ein Bild-Overlay (Lageplan aus PDF/PNG) auf der Karte, per id verwaltet. */
export interface ImageOverlaySpec {
  imageUrl: string;
  placement: ImagePlacement;
  /** Seitenverhältnis Breite/Höhe des Bildes. */
  aspect: number;
  visible: boolean;
}

/** Look of the preview circle while a circle area is being moved. */
export interface CirclePreviewSpec {
  radius: number;
  color: string;
  opacity: number;
}

export interface MapAdapter {
  getView(): MapView;
  /** The whole map area: its centre and its width and height on the ground. */
  getViewExtent(): ViewExtent;
  setView(view: MapView): void;
  setMarker(id: string, marker: MarkerSpec): void;
  removeMarker(id: string): void;
  setArea(id: string, area: AreaSpec): void;
  removeArea(id: string): void;
  /** Rendert (bei visible) den KML-Inhalt als Ebene; entfernt sie bei !visible. */
  setKmlOverlay(
    id: string,
    overlay: { content: string; visible: boolean },
  ): void;
  removeKmlOverlay(id: string): void;
  /** Rendert (bei visible) das Bild als gedrehte Ebene; entfernt sie bei !visible. */
  setImageOverlay(id: string, overlay: ImageOverlaySpec): void;
  removeImageOverlay(id: string): void;
  /**
   * Draws the overlay and, while it is edited, its handles on the placement
   * last set, undoing a gesture whose saving failed.
   */
  restoreImageOverlay(id: string): void;
  /**
   * Zeigt Griffe (Ecken zum Skalieren, Dreh-Griff, Bildfläche zum Verschieben)
   * für das Overlay und meldet jede fertige Geste über `onChange`.
   */
  startImageOverlayEdit(
    id: string,
    onChange: (placement: ImagePlacement) => void,
  ): void;
  stopImageOverlayEdit(): void;
  /** Startet das interaktive Zeichnen einer Form; ruft `onComplete` mit der fertigen Geometrie. */
  startDrawing(
    shape: AreaShape,
    onComplete: (geometry: AreaGeometry) => void,
  ): void;
  cancelDrawing(): void;
  /**
   * Draws a preview circle around the current map centre that follows every
   * pan and zoom; calling it again replaces the preview.
   */
  startCirclePreview(spec: CirclePreviewSpec): void;
  stopCirclePreview(): void;
  /**
   * Marks the Suchtreffer with a pin above every other layer; taps pass
   * through the pin. Calling it again moves the one pin.
   */
  setSearchHit(position: LatLng): void;
  clearSearchHit(): void;
  destroy(): void;
}

export interface CreateMapOptions {
  initialView: MapView;
  tileUrl: string;
  attribution: string;
  onViewChange?: (view: MapView) => void;
  onMapClick?: (pos: LatLng) => void;
}

export interface MapAdapterFactory {
  create(container: HTMLElement, options: CreateMapOptions): MapAdapter;
}
