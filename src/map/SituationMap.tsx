"use client";

import { Box } from "@mantine/core";
import {
  type Ref,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { MapAdapter, MapAdapterFactory } from "./adapter";
import type { AreaGeometry, AreaShape } from "./area";
import type { SymbolComposition } from "./composition";
import type { ImagePlacement } from "./image-overlay";
import { readLastView, writeLastView } from "./last-view-storage";
import type { FocusTarget } from "./useMapFocus";
import {
  chooseInitialView,
  type LatLng,
  type MapView,
  type ViewExtent,
} from "./view";

/** Ein platziertes Kartenzeichen, fertig zum Setzen als Marker. */
export interface PlacedSymbol {
  id: string;
  lat: number;
  lng: number;
  iconUrl: string;
  /** Bezeichnung, als Label rechts neben dem Marker (oder keine). */
  label?: string;
  /** 0–1; für ausgegraute (veraltete) Kartenzeichen. */
  opacity?: number;
}

/** Ein Bereich, fertig zum Rendern. */
export interface RenderedArea {
  id: string;
  geometry: AreaGeometry;
  color: string;
  opacity: number;
  label: string;
}

/** Ein KML-Overlay, fertig zum Rendern als ein-/ausblendbare Ebene. */
export interface RenderedKmlOverlay {
  id: string;
  content: string;
  visible: boolean;
}

/** Ein Bild-Overlay, fertig zum Rendern als gedrehte, ein-/ausblendbare Ebene. */
export interface RenderedImageOverlay {
  id: string;
  imageUrl: string;
  placement: ImagePlacement;
  aspect: number;
  visible: boolean;
}

/** Was die Karte ihrem Besitzer über ihre Ref preisgibt. */
export interface SituationMapHandle {
  /** Der aktuelle Ausschnitt, oder null, solange die Karte noch nicht steht. */
  getView(): MapView | null;
  /** Die ganze Kartenfläche in Metern, oder null, solange die Karte noch nicht steht. */
  getViewExtent(): ViewExtent | null;
  /** Puts the Bild-Overlay and its handles back on its saved placement. */
  restoreImagePlacement(id: string): void;
}

export interface SituationMapProps {
  ref?: Ref<SituationMapHandle>;
  operationId: string;
  operationDefaultView: MapView | null;
  tileUrl: string;
  attribution: string;
  /** Read-only (mobile Geräteansicht): keine Werkzeuge/Bearbeitung. */
  readOnly?: boolean;
  symbols?: PlacedSymbol[];
  /** Die aktuell in der Schnellauswahl scharfgestellte Komposition (oder null). */
  armedComposition?: SymbolComposition | null;
  onPlace?: (composition: SymbolComposition, lat: number, lng: number) => void;
  onMove?: (id: string, lat: number, lng: number) => void;
  onSelect?: (id: string) => void;
  /** Setzt (bei Änderung) den Kartenausschnitt – zum Springen zu einem Punkt oder zum Standard-Ausschnitt. */
  focusTarget?: FocusTarget | null;
  areas?: RenderedArea[];
  /** Eine Form ist zum Zeichnen scharfgestellt; die fertige Geometrie kommt über onDrawComplete. */
  drawShape?: AreaShape | null;
  onDrawComplete?: (geometry: AreaGeometry) => void;
  kmlOverlays?: RenderedKmlOverlay[];
  imageOverlays?: RenderedImageOverlay[];
  /** Ein Bild-Overlay wird per Griff bearbeitet; Griffe erscheinen auf der Karte. */
  editingImageId?: string | null;
  onEditImagePlacement?: (id: string, placement: ImagePlacement) => void;
  /**
   * A circle area is being moved: the map centres on it, and it follows the map
   * centre as a preview instead of standing at its saved centre.
   */
  movingCircleId?: string | null;
  /** The chosen address of the map search, marked with a pin (or none). */
  searchHit?: LatLng | null;
  /** Für Tests injizierbar; sonst wird zur Laufzeit der Leaflet-Adapter geladen. */
  factory?: MapAdapterFactory;
}

const EMPTY: PlacedSymbol[] = [];
const EMPTY_AREAS: RenderedArea[] = [];
const EMPTY_KML: RenderedKmlOverlay[] = [];
const EMPTY_IMAGES: RenderedImageOverlay[] = [];

export function SituationMap({
  ref,
  operationId,
  operationDefaultView,
  tileUrl,
  attribution,
  readOnly = false,
  symbols = EMPTY,
  armedComposition = null,
  onPlace,
  onMove,
  onSelect,
  focusTarget = null,
  areas = EMPTY_AREAS,
  drawShape = null,
  onDrawComplete,
  kmlOverlays = EMPTY_KML,
  imageOverlays = EMPTY_IMAGES,
  editingImageId = null,
  onEditImagePlacement,
  movingCircleId = null,
  searchHit = null,
  factory,
}: SituationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<MapAdapter | null>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const knownAreaIds = useRef<Set<string>>(new Set());
  const knownKmlIds = useRef<Set<string>>(new Set());
  const knownImageIds = useRef<Set<string>>(new Set());
  const onDrawCompleteRef = useRef(onDrawComplete);
  onDrawCompleteRef.current = onDrawComplete;
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    getView: () => adapterRef.current?.getView() ?? null,
    getViewExtent: () => adapterRef.current?.getViewExtent() ?? null,
    restoreImagePlacement: (id) => adapterRef.current?.restoreImageOverlay(id),
  }));

  // Marker-Callbacks lesen jeweils die aktuellen Props, damit die Marker-Specs
  // beim Reconcile keine veralteten Closures tragen.
  const armedRef = useRef(armedComposition);
  armedRef.current = armedComposition;
  const onPlaceRef = useRef(onPlace);
  onPlaceRef.current = onPlace;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onEditImagePlacementRef = useRef(onEditImagePlacement);
  onEditImagePlacementRef.current = onEditImagePlacement;
  // Nur beim ersten Aufbau gelesen; als Ref, damit ein Refresh (neues, wertgleiches
  // defaultView-Objekt bzw. neue tileUrl-Zeichenkette) die Karte nicht neu erzeugt.
  const tileUrlRef = useRef(tileUrl);
  tileUrlRef.current = tileUrl;
  const attributionRef = useRef(attribution);
  attributionRef.current = attribution;
  const operationDefaultViewRef = useRef(operationDefaultView);
  operationDefaultViewRef.current = operationDefaultView;
  const areasRef = useRef(areas);
  areasRef.current = areas;

  useEffect(() => {
    let disposed = false;
    const initialView = chooseInitialView(
      readLastView(operationId),
      operationDefaultViewRef.current,
    );

    const handleMapClick = (pos: LatLng) => {
      if (armedRef.current) {
        onPlaceRef.current?.(armedRef.current, pos.lat, pos.lng);
      }
    };

    const start = async () => {
      const resolved =
        factory ?? (await import("./leaflet-adapter")).leafletMapAdapterFactory;
      if (disposed || !containerRef.current) return;
      adapterRef.current = resolved.create(containerRef.current, {
        initialView,
        tileUrl: tileUrlRef.current,
        attribution: attributionRef.current,
        onViewChange: (view) => writeLastView(operationId, view),
        onMapClick: handleMapClick,
      });
      setReady(true);
    };
    void start();

    return () => {
      disposed = true;
      adapterRef.current?.destroy();
      adapterRef.current = null;
      knownIds.current = new Set();
      knownAreaIds.current = new Set();
      knownKmlIds.current = new Set();
      knownImageIds.current = new Set();
      setReady(false);
    };
  }, [operationId, factory]);

  // Marker-Reconciliation aus dem geladenen Einsatz-Zustand (add/update/remove).
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!ready || !adapter) return;
    reconcile(knownIds, symbols, adapter.removeMarker, (symbol) =>
      adapter.setMarker(symbol.id, {
        lat: symbol.lat,
        lng: symbol.lng,
        iconUrl: symbol.iconUrl,
        label: symbol.label,
        opacity: symbol.opacity,
        draggable: !readOnly,
        onDragEnd: readOnly
          ? undefined
          : (pos) => onMoveRef.current?.(symbol.id, pos.lat, pos.lng),
        onClick: () => onSelectRef.current?.(symbol.id),
      }),
    );
    // `readOnly` ist pro Mount konstant (Workspace immer editierbar, Device-/
    // ViewLink-Ansicht immer nur-lesend) und steht nur der Vollständigkeit halber
    // in den Deps; der Adapter aktualisiert `draggable` an bestehenden Markern
    // ohnehin nicht neu.
  }, [ready, symbols, readOnly]);

  // Zum Ziel springen (Ausschnitt setzen), wenn sich das Ziel ändert.
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!ready || !focusTarget || !adapter) return;
    const { zoomInOnly, ...view } = focusTarget;
    const zoom = zoomInOnly
      ? Math.max(view.zoom, adapter.getView().zoom)
      : view.zoom;
    adapter.setView({ ...view, zoom });
  }, [ready, focusTarget]);

  // Bereichs-Reconciliation aus dem geladenen Einsatz-Zustand (add/update/remove).
  // The circle being moved is not drawn at its saved centre; its preview stands
  // around the map centre instead.
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!ready || !adapter) return;
    const shown = areas.filter((a) => a.id !== movingCircleId);
    reconcile(knownAreaIds, shown, adapter.removeArea, (area) =>
      adapter.setArea(area.id, {
        geometry: area.geometry,
        color: area.color,
        opacity: area.opacity,
        label: area.label,
      }),
    );
  }, [ready, areas, movingCircleId]);

  // Moving a circle: centre on it once when the mode starts, keeping the zoom.
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!ready || !adapter || !movingCircleId) return;
    const geometry = areasRef.current.find(
      (a) => a.id === movingCircleId,
    )?.geometry;
    if (geometry?.shape !== "circle") return;
    adapter.setView({ ...geometry.center, zoom: adapter.getView().zoom });
  }, [ready, movingCircleId]);

  // Preview of the circle being moved; a radius or style changed elsewhere is
  // taken over.
  const movingCircle = areas.find((a) => a.id === movingCircleId);
  const previewRadius =
    movingCircle?.geometry.shape === "circle"
      ? movingCircle.geometry.radius
      : null;
  const previewColor = movingCircle?.color;
  const previewOpacity = movingCircle?.opacity;
  useEffect(() => {
    const adapter = adapterRef.current;
    if (
      !ready ||
      !adapter ||
      previewRadius === null ||
      previewColor === undefined ||
      previewOpacity === undefined
    )
      return;
    adapter.startCirclePreview({
      radius: previewRadius,
      color: previewColor,
      opacity: previewOpacity,
    });
    return () => adapter.stopCirclePreview();
  }, [ready, previewRadius, previewColor, previewOpacity]);

  // KML-Overlay-Reconciliation: jede Ebene mit ihrer Sichtbarkeit setzen, entfernte lösen.
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!ready || !adapter) return;
    reconcile(knownKmlIds, kmlOverlays, adapter.removeKmlOverlay, (overlay) =>
      adapter.setKmlOverlay(overlay.id, {
        content: overlay.content,
        visible: overlay.visible,
      }),
    );
  }, [ready, kmlOverlays]);

  // Bild-Overlay-Reconciliation: jede Ebene mit Platzierung und Sichtbarkeit setzen, entfernte lösen.
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!ready || !adapter) return;
    reconcile(
      knownImageIds,
      imageOverlays,
      adapter.removeImageOverlay,
      (overlay) =>
        adapter.setImageOverlay(overlay.id, {
          imageUrl: overlay.imageUrl,
          placement: overlay.placement,
          aspect: overlay.aspect,
          visible: overlay.visible,
        }),
    );
  }, [ready, imageOverlays]);

  useEffect(() => {
    const adapter = adapterRef.current;
    if (!ready || !adapter) return;
    if (searchHit) adapter.setSearchHit(searchHit);
    else adapter.clearSearchHit();
  }, [ready, searchHit]);

  // Bearbeiten-Modus: Griffe fürs gewählte Overlay zeigen und Platzierungs-Gesten melden.
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!ready || !adapter || !editingImageId) return;
    adapter.startImageOverlayEdit(editingImageId, (placement) =>
      onEditImagePlacementRef.current?.(editingImageId, placement),
    );
    return () => adapter.stopImageOverlayEdit();
  }, [ready, editingImageId]);

  // Zeichen-Modus scharfstellen: startet das Zeichnen der Form und meldet die Geometrie.
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!ready || !adapter || !drawShape) return;
    adapter.startDrawing(drawShape, (geometry) =>
      onDrawCompleteRef.current?.(geometry),
    );
    return () => adapter.cancelDrawing();
  }, [ready, drawShape]);

  return <Box ref={containerRef} h="100%" w="100%" />;
}

/**
 * Gleicht eine Kartenebene mit dem geladenen Einsatz-Zustand ab: entfernt, was
 * nicht mehr vorkommt, setzt jedes Element (add/update) und merkt sich die ids.
 */
function reconcile<T extends { id: string }>(
  known: RefObject<Set<string>>,
  items: T[],
  remove: (id: string) => void,
  set: (item: T) => void,
): void {
  const next = new Set(items.map((item) => item.id));
  for (const id of known.current) {
    if (!next.has(id)) remove(id);
  }
  for (const item of items) set(item);
  known.current = next;
}
