"use client";

import { Box, Modal, Stack } from "@mantine/core";
import { useMemo, useRef, useState } from "react";
import type { ActionResult } from "@/app/action-result";
import { useNotifyingActionRunner } from "@/app/useNotifyingActionRunner";
import type { GeoHit } from "@/server/geocoder/geocoder";
import type { KmlSourceType } from "@/server/kml/kml-overlays";
import { AdvancedSymbolForm } from "./AdvancedSymbolForm";
import { AreaEditorModal } from "./AreaEditorModal";
import { AreasPanel } from "./AreasPanel";
import type { MapAdapterFactory } from "./adapter";
import type { AreaGeometry, AreaStyle } from "./area";
import type { SymbolComposition } from "./composition";
import type { ImagePlacement } from "./image-overlay";
import { LayersPanel } from "./LayersPanel";
import { MapControls } from "./MapControls";
import { MapModeBands } from "./MapModeBands";
import { MapPanelSheet } from "./MapPanelSheet";
import { type MapPanel, MapPanelSwitch } from "./MapPanelSwitch";
import { SITUATION_MAP } from "./notification-sources";
import { type StatefulSymbol, toPlacedSymbols } from "./placed-symbols";
import { SearchBar } from "./SearchBar";
import {
  type PlacedSymbol,
  type RenderedArea,
  SituationMap,
  type SituationMapHandle,
} from "./SituationMap";
import { SymbolDetailModal } from "./SymbolDetailModal";
import { SymbolsPanel } from "./SymbolsPanel";
import { useAreaFlows } from "./useAreaFlows";
import { useImageOverlayEditing } from "./useImageOverlayEditing";
import { useMapFocus } from "./useMapFocus";
import { useMapMode } from "./useMapMode";
import { useMapSearch } from "./useMapSearch";
import { useSymbolPlacement } from "./useSymbolPlacement";
import type { MapView, ViewExtent } from "./view";

const MAP_LOADING = "Die Karte lädt noch. Bitte erneut versuchen.";

export interface WorkspaceSymbol extends StatefulSymbol {
  deviceLinkToken: string | null;
}

export interface WorkspaceKmlOverlay {
  id: string;
  name: string;
  sourceType: KmlSourceType;
  visible: boolean;
  content: string;
}

export interface WorkspaceImageOverlay {
  id: string;
  name: string;
  imageUrl: string;
  placement: ImagePlacement;
  aspect: number;
  visible: boolean;
}

/** Was die Lagekarte vom Arbeitsplatz bekommt: ihre Daten und Aktionen. */
export interface SituationMapViewProps {
  operationId: string;
  operationDefaultView: MapView | null;
  tileUrl: string;
  attribution: string;
  symbols: WorkspaceSymbol[];
  onSetDefault: (view: MapView) => Promise<ActionResult>;
  onPlace: (
    composition: SymbolComposition,
    lat: number,
    lng: number,
  ) => Promise<ActionResult>;
  onMove: (id: string, lat: number, lng: number) => Promise<ActionResult>;
  onUpdate: (
    id: string,
    composition: SymbolComposition,
  ) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
  onGenerateDeviceLink: (id: string) => Promise<ActionResult>;
  onRemoveDeviceLink: (id: string) => Promise<ActionResult>;
  onGeocode: (query: string) => Promise<GeoHit[]>;
  geocoderAttribution: string;
  areas: RenderedArea[];
  onCreateArea: (
    geometry: AreaGeometry,
  ) => Promise<ActionResult & { id?: string }>;
  onUpdateAreaStyle: (id: string, style: AreaStyle) => Promise<ActionResult>;
  onUpdateAreaGeometry: (
    id: string,
    geometry: AreaGeometry,
  ) => Promise<ActionResult>;
  onDeleteArea: (id: string) => Promise<ActionResult>;
  kmlOverlays: WorkspaceKmlOverlay[];
  onAddKmlFile: (name: string, content: string) => Promise<ActionResult>;
  onAddKmlUrl: (name: string, url: string) => Promise<ActionResult>;
  onSetKmlVisibility: (id: string, visible: boolean) => Promise<ActionResult>;
  onReloadKml: (id: string) => Promise<ActionResult>;
  onRemoveKml: (id: string) => Promise<ActionResult>;
  imageOverlays: WorkspaceImageOverlay[];
  onAddImage: (file: File, view: ViewExtent) => Promise<ActionResult>;
  onUpdateImagePlacement: (
    id: string,
    placement: ImagePlacement,
  ) => Promise<ActionResult>;
  onReplaceImage: (id: string, file: File) => Promise<ActionResult>;
  onSetImageVisibility: (id: string, visible: boolean) => Promise<ActionResult>;
  onDeleteImage: (id: string) => Promise<ActionResult>;
  /** Für Tests injizierbar. */
  factory?: MapAdapterFactory;
}

/**
 * Die Lagekarte des Arbeitsplatzes: die Karte mit Suche, Modus-Band und
 * Kartenknöpfen, das Kartenpanel mit seiner Reihe und die Dialoge zu
 * Kartenzeichen und Bereichen. Bleibt gemountet, wenn die Karte verborgen ist;
 * verschwindet sie, endet jeder Karten-Modus.
 */
export function SituationMapView({
  operationId,
  operationDefaultView,
  tileUrl,
  attribution,
  symbols,
  onSetDefault,
  onPlace,
  onMove,
  onUpdate,
  onDelete,
  onGenerateDeviceLink,
  onRemoveDeviceLink,
  onGeocode,
  geocoderAttribution,
  areas,
  onCreateArea,
  onUpdateAreaStyle,
  onUpdateAreaGeometry,
  onDeleteArea,
  kmlOverlays,
  onAddKmlFile,
  onAddKmlUrl,
  onSetKmlVisibility,
  onReloadKml,
  onRemoveKml,
  imageOverlays,
  onAddImage,
  onUpdateImagePlacement,
  onReplaceImage,
  onSetImageVisibility,
  onDeleteImage,
  factory,
  isDesktop,
  mapShown,
  shownPanel,
  panelSwitchShown,
  onSelectPanel,
  onCloseSheet,
  closeSheetOnPhone,
  now,
}: SituationMapViewProps & {
  isDesktop: boolean | null;
  mapShown: boolean;
  shownPanel: MapPanel | null;
  panelSwitchShown: boolean;
  onSelectPanel: (panel: MapPanel) => void;
  onCloseSheet: () => void;
  closeSheetOnPhone: () => void;
  now: number;
}) {
  const mapRef = useRef<SituationMapHandle>(null);
  const { run: runMapAction, closeError: closeMapError } =
    useNotifyingActionRunner(SITUATION_MAP);
  const mode = useMapMode({ onTransition: closeMapError });
  const { editingImageId, drawShape, movingCircleId } = mode;
  useEndModeWhenHidden(mapShown, mode.endForHiddenMap);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const imageEditing = useImageOverlayEditing({
    imageOverlays,
    mode,
    onUpdateImagePlacement,
    onReplaceImage,
    onDeleteImage,
    restoreImagePlacement: (id) => mapRef.current?.restoreImagePlacement(id),
  });
  const { focusTarget, jumpTo, returnToDefaultView } =
    useMapFocus(operationDefaultView);
  const search = useMapSearch(symbols, onGeocode, jumpTo);
  const areaFlows = useAreaFlows({
    areas,
    mapRef,
    mode,
    runMapAction,
    closeSheetOnPhone,
    onCreateArea,
    onUpdateAreaGeometry,
  });
  const symbolPlacement = useSymbolPlacement({
    mode,
    runMapAction,
    closeSheetOnPhone,
    onPlace,
  });
  const selected = symbols.find((s) => s.id === selectedId) ?? null;

  const placed = useMemo<PlacedSymbol[]>(
    () => toPlacedSymbols(symbols, now),
    [symbols, now],
  );
  const jumpFromPanel = (lat: number, lng: number) => {
    jumpTo(lat, lng);
    closeSheetOnPhone();
  };
  const startEditImage = (id: string) => {
    imageEditing.startEditImage(id);
    closeSheetOnPhone();
  };
  const saveDefaultView = async (): Promise<ActionResult> => {
    const view = mapRef.current?.getView();
    if (!view) return { error: MAP_LOADING };
    return onSetDefault(view);
  };
  const addImage = async (file: File): Promise<ActionResult> => {
    const view = mapRef.current?.getViewExtent();
    if (!view) return { error: MAP_LOADING };
    return onAddImage(file, view);
  };

  return (
    <>
      <Box
        className="map-view"
        data-view="map"
        data-panel-open={shownPanel ? "" : undefined}
        data-panel-switch={panelSwitchShown ? "" : undefined}
        // Inline, damit es jede Klasse schlägt (auch die Regel für unbekannte Breite).
        style={{
          display: mapShown ? undefined : "none",
        }}
      >
        <Box className="map-area">
          <SituationMap
            ref={mapRef}
            operationId={operationId}
            operationDefaultView={operationDefaultView}
            tileUrl={tileUrl}
            attribution={attribution}
            symbols={placed}
            armedComposition={symbolPlacement.armedComposition}
            onPlace={symbolPlacement.placeSymbolAt}
            onMove={onMove}
            onSelect={setSelectedId}
            focusTarget={focusTarget}
            areas={areas}
            drawShape={drawShape}
            onDrawComplete={areaFlows.handleDrawComplete}
            kmlOverlays={kmlOverlays}
            imageOverlays={imageOverlays}
            editingImageId={editingImageId}
            onEditImagePlacement={imageEditing.saveImagePlacement}
            movingCircleId={movingCircleId}
            searchHit={search.searchHit}
            factory={factory}
          />
          {movingCircleId && (
            <Box className="map-crosshair" aria-hidden="true" />
          )}
          <Box className="map-search">
            <Stack gap={8}>
              <SearchBar
                query={search.query}
                onQueryChange={search.setQuery}
                objectResults={search.objectResults}
                addressResults={search.addressResults}
                attribution={geocoderAttribution}
                onChooseAddress={search.chooseAddress}
                onChooseObject={search.chooseObject}
              />
              <MapModeBands
                placingSymbol={symbolPlacement.armedComposition !== null}
                drawingArea={drawShape !== null}
                movingCircle={movingCircleId !== null}
                editingImage={editingImageId !== null}
                onEndMode={
                  editingImageId ? imageEditing.finishEdit : mode.reset
                }
                onSetCircleHere={areaFlows.setCircleHere}
                circleMoveSaving={areaFlows.circleMoveSaving}
              />
            </Stack>
          </Box>
          <MapControls
            onSetDefault={saveDefaultView}
            onReturnToDefault={returnToDefaultView}
            canReturnToDefault={operationDefaultView !== null}
          />
        </Box>

        {shownPanel && (
          <MapPanelSheet
            panel={shownPanel}
            onClose={isDesktop ? undefined : onCloseSheet}
          >
            {shownPanel === "symbols" && (
              <SymbolsPanel
                symbols={symbols}
                placed={placed}
                armedQuickId={mode.armedQuickId}
                onArmQuick={symbolPlacement.armQuickSymbol}
                onOpenAdvanced={symbolPlacement.openAdvanced}
                onJump={jumpFromPanel}
                onEdit={setSelectedId}
                onCopy={symbolPlacement.copySymbol}
              />
            )}
            {shownPanel === "areas" && (
              <AreasPanel
                areas={areas}
                drawShape={drawShape}
                onToggleDraw={areaFlows.toggleAreaDraw}
                onJump={jumpFromPanel}
                onEdit={areaFlows.selectArea}
              />
            )}
            {shownPanel === "layers" && (
              <LayersPanel
                kmlOverlays={kmlOverlays}
                onAddKmlFile={onAddKmlFile}
                onAddKmlUrl={onAddKmlUrl}
                onSetKmlVisibility={onSetKmlVisibility}
                onReloadKml={onReloadKml}
                onRemoveKml={onRemoveKml}
                imageOverlays={imageOverlays}
                editingImageId={editingImageId}
                onAddImage={addImage}
                onSetImageVisibility={onSetImageVisibility}
                onEditImage={startEditImage}
                imageEditing={imageEditing}
              />
            )}
          </MapPanelSheet>
        )}

        {panelSwitchShown && (
          <MapPanelSwitch shownPanel={shownPanel} onSelect={onSelectPanel} />
        )}
      </Box>

      <AreaEditorModal
        area={areaFlows.selectedArea}
        onClose={() => areaFlows.selectArea(null)}
        onUpdateAreaStyle={onUpdateAreaStyle}
        onUpdateAreaGeometry={onUpdateAreaGeometry}
        onDeleteArea={onDeleteArea}
        onRedraw={areaFlows.startRedraw}
        onMoveCircle={areaFlows.startMoveCircle}
      />

      <Modal
        opened={symbolPlacement.advancedOpened}
        onClose={symbolPlacement.closeAdvanced}
        title="Kartenzeichen zusammensetzen"
      >
        <AdvancedSymbolForm
          submitLabel="Platzieren"
          onSubmit={symbolPlacement.armAdvanced}
        />
      </Modal>

      <SymbolDetailModal
        symbol={selected}
        onClose={() => setSelectedId(null)}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onGenerateDeviceLink={onGenerateDeviceLink}
        onRemoveDeviceLink={onRemoveDeviceLink}
      />
    </>
  );
}

/**
 * Verschwindet die Karte (Wechsel am Handy, Fenster schmaler als 48 em),
 * endet jeder Karten-Modus, sonst platziert ein späterer Tap auf die wieder
 * gezeigte Karte unerwartet ein Zeichen.
 */
function useEndModeWhenHidden(mapShown: boolean, endMode: () => void) {
  const [mapWasShown, setMapWasShown] = useState(mapShown);
  if (mapShown !== mapWasShown) {
    setMapWasShown(mapShown);
    if (!mapShown) endMode();
  }
}
