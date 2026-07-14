"use client";

import { ActionIcon, Box, Menu } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type { LatLng, MapAdapter, MapAdapterFactory } from "./adapter";
import type { AreaGeometry, AreaShape } from "./area";
import type { SymbolComposition } from "./composition";
import type { ImagePlacement } from "./image-overlay";
import { readLastView, writeLastView } from "./last-view-storage";
import { chooseInitialView, type MapView } from "./view";

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

export interface SituationMapProps {
  operationId: string;
  operationDefaultView: MapView | null;
  tileUrl: string;
  attribution: string;
  onSetDefault?: (view: MapView) => void;
  /** Read-only (mobile Geräteansicht): keine Werkzeuge/Bearbeitung, kein Standard-Ausschnitt-Knopf. */
  readOnly?: boolean;
  symbols?: PlacedSymbol[];
  /** Die aktuell in der Schnellauswahl scharfgestellte Komposition (oder null). */
  armedComposition?: SymbolComposition | null;
  onPlace?: (composition: SymbolComposition, lat: number, lng: number) => void;
  onMove?: (id: string, lat: number, lng: number) => void;
  onSelect?: (id: string) => void;
  /** Setzt (bei Änderung) den Kartenausschnitt – zum Springen aus der Suche. */
  focusTarget?: MapView | null;
  areas?: RenderedArea[];
  /** Eine Form ist zum Zeichnen scharfgestellt; die fertige Geometrie kommt über onDrawComplete. */
  drawShape?: AreaShape | null;
  onDrawComplete?: (geometry: AreaGeometry) => void;
  kmlOverlays?: RenderedKmlOverlay[];
  imageOverlays?: RenderedImageOverlay[];
  /** Ein Bild-Overlay wird per Griff bearbeitet; Griffe erscheinen auf der Karte. */
  editingImageId?: string | null;
  onEditImagePlacement?: (id: string, placement: ImagePlacement) => void;
  /** Für Tests injizierbar; sonst wird zur Laufzeit der Leaflet-Adapter geladen. */
  factory?: MapAdapterFactory;
}

const EMPTY: PlacedSymbol[] = [];
const EMPTY_AREAS: RenderedArea[] = [];
const EMPTY_KML: RenderedKmlOverlay[] = [];
const EMPTY_IMAGES: RenderedImageOverlay[] = [];

export function SituationMap({
  operationId,
  operationDefaultView,
  tileUrl,
  attribution,
  onSetDefault,
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
  const [saving, setSaving] = useState(false);

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
      knownIds.current = new Set();
      knownAreaIds.current = new Set();
      knownKmlIds.current = new Set();
      knownImageIds.current = new Set();
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
    const next = new Set(symbols.map((s) => s.id));
    for (const id of knownIds.current) {
      if (!next.has(id)) adapter.removeMarker(id);
    }
    for (const symbol of symbols) {
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
      });
    }
    knownIds.current = next;
  }, [ready, symbols, readOnly]);

  // Auf ein Suchergebnis springen (Ausschnitt setzen), wenn sich das Ziel ändert.
  useEffect(() => {
    if (ready && focusTarget) adapterRef.current?.setView(focusTarget);
  }, [ready, focusTarget]);

  // Bereichs-Reconciliation aus dem geladenen Einsatz-Zustand (add/update/remove).
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!ready || !adapter) return;
    const next = new Set(areas.map((a) => a.id));
    for (const id of knownAreaIds.current) {
      if (!next.has(id)) adapter.removeArea(id);
    }
    for (const area of areas) {
      adapter.setArea(area.id, {
        geometry: area.geometry,
        color: area.color,
        opacity: area.opacity,
        label: area.label,
      });
    }
    knownAreaIds.current = next;
  }, [ready, areas]);

  // KML-Overlay-Reconciliation: jede Ebene mit ihrer Sichtbarkeit setzen, entfernte lösen.
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!ready || !adapter) return;
    const next = new Set(kmlOverlays.map((o) => o.id));
    for (const id of knownKmlIds.current) {
      if (!next.has(id)) adapter.removeKmlOverlay(id);
    }
    for (const overlay of kmlOverlays) {
      adapter.setKmlOverlay(overlay.id, {
        content: overlay.content,
        visible: overlay.visible,
      });
    }
    knownKmlIds.current = next;
  }, [ready, kmlOverlays]);

  // Bild-Overlay-Reconciliation: jede Ebene mit Platzierung und Sichtbarkeit setzen, entfernte lösen.
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!ready || !adapter) return;
    const next = new Set(imageOverlays.map((o) => o.id));
    for (const id of knownImageIds.current) {
      if (!next.has(id)) adapter.removeImageOverlay(id);
    }
    for (const overlay of imageOverlays) {
      adapter.setImageOverlay(overlay.id, {
        imageUrl: overlay.imageUrl,
        placement: overlay.placement,
        aspect: overlay.aspect,
        visible: overlay.visible,
      });
    }
    knownImageIds.current = next;
  }, [ready, imageOverlays]);

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

  const handleSetDefault = async () => {
    const adapter = adapterRef.current;
    if (!adapter || !onSetDefault) return;
    setSaving(true);
    try {
      await onSetDefault(adapter.getView());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box pos="relative" h="100%" w="100%">
      <Box ref={containerRef} h="100%" w="100%" />
      {!readOnly && onSetDefault && (
        <Box pos="absolute" top={12} right={12} style={{ zIndex: 1100 }}>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="default"
                size="lg"
                aria-label="Karten-Optionen"
                disabled={!ready}
              >
                ⋯
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={handleSetDefault} disabled={saving || !ready}>
                Standard-Ausschnitt festlegen
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Box>
      )}
    </Box>
  );
}
