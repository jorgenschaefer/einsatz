"use client";

import "./situation-workspace.css";
import { Box, Modal, Stack } from "@mantine/core";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { ActionResult } from "@/app/action-result";
import {
  type JournalEntryView,
  JournalPanel,
} from "@/app/operations/[id]/JournalPanel";
import { LageansichtShell } from "@/app/operations/[id]/LageansichtShell";
import type { EntryContent } from "@/journal/entry-route";
import type { GeoHit } from "@/server/geocoder/geocoder";
import type { KmlSourceType } from "@/server/kml/kml-overlays";
import type { OperationStatus } from "@/server/operations/operations";
import { type StationView, StrengthPanel } from "@/strength/StrengthPanel";
import type { StrengthValues } from "@/strength/strength";
import { AdvancedSymbolForm } from "./AdvancedSymbolForm";
import { AreaEditorModal } from "./AreaEditorModal";
import { AreasPanel } from "./AreasPanel";
import type { MapAdapterFactory } from "./adapter";
import type { AreaGeometry, AreaStyle } from "./area";
import type { SymbolComposition } from "./composition";
import type { ImagePlacement } from "./image-overlay";
import { LayersPanel } from "./LayersPanel";
import { MainViewBar } from "./MainViewBar";
import { MapControls } from "./MapControls";
import { MapErrorAlert } from "./MapErrorAlert";
import { MapModeBands } from "./MapModeBands";
import { MapPanelSheet } from "./MapPanelSheet";
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
import { useMainView } from "./useMainView";
import { useMapActionError } from "./useMapActionError";
import { useMapFocus } from "./useMapFocus";
import { useMapMode } from "./useMapMode";
import { useMapSearch } from "./useMapSearch";
import { type LiveConnection, useOperationEvents } from "./useOperationEvents";
import { useStalenessClock } from "./useStalenessClock";
import { useSymbolPlacement } from "./useSymbolPlacement";
import type { ViewLinkItem } from "./ViewLinkPanel";
import type { MapView } from "./view";

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

export interface SituationWorkspaceProps {
  operationId: string;
  operationName: string;
  status: OperationStatus;
  /** Nutzername des angemeldeten Nutzers; eigene ETB-Einträge zählen nicht als neu. */
  currentUsername: string;
  viewLinks: ViewLinkItem[];
  onCreateViewLink: (label: string) => Promise<ActionResult>;
  onDeleteViewLink: (id: string) => Promise<ActionResult>;
  operationDefaultView: MapView | null;
  tileUrl: string;
  attribution: string;
  symbols: WorkspaceSymbol[];
  journalEntries: JournalEntryView[];
  /** Die Werte für Von und An eines neuen ETB-Eintrags und einer Korrektur. */
  correspondents: string[];
  onAddJournalEntry: (entry: EntryContent) => Promise<ActionResult>;
  onCorrectJournalEntry: (
    id: string,
    content: EntryContent,
  ) => Promise<ActionResult>;
  onAnnulJournalEntry: (id: string) => Promise<ActionResult>;
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
  onAddImage: (file: File) => Promise<ActionResult>;
  onUpdateImagePlacement: (
    id: string,
    placement: ImagePlacement,
  ) => Promise<ActionResult>;
  onReplaceImage: (id: string, file: File) => Promise<ActionResult>;
  onSetImageVisibility: (id: string, visible: boolean) => Promise<ActionResult>;
  onDeleteImage: (id: string) => Promise<ActionResult>;
  stations: StationView[];
  onCreateStation: (name: string) => Promise<ActionResult>;
  onRenameStation: (id: string, name: string) => Promise<ActionResult>;
  onRecordStrengthReport: (
    stationId: string,
    values: StrengthValues,
  ) => Promise<ActionResult>;
  onReportTotalStrength: () => Promise<ActionResult>;
  onCorrectStrengthReport: (
    reportId: string,
    stationId: string,
    values: StrengthValues,
  ) => Promise<ActionResult>;
  onAnnulStrengthReport: (reportId: string) => Promise<ActionResult>;
  /** Für Tests injizierbar. */
  factory?: MapAdapterFactory;
  /** Für Tests injizierbar; sonst der echte SSE-Hook. */
  eventsHook?: (url: string, onChanged: () => void) => LiveConnection;
}

export function SituationWorkspace({
  operationId,
  operationName,
  status,
  currentUsername,
  viewLinks,
  onCreateViewLink,
  onDeleteViewLink,
  operationDefaultView,
  tileUrl,
  attribution,
  symbols,
  journalEntries,
  correspondents,
  onAddJournalEntry,
  onCorrectJournalEntry,
  onAnnulJournalEntry,
  onSetDefault,
  onPlace,
  onMove,
  onUpdate,
  onDelete,
  onGenerateDeviceLink,
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
  stations,
  onCreateStation,
  onRenameStation,
  onRecordStrengthReport,
  onReportTotalStrength,
  onCorrectStrengthReport,
  onAnnulStrengthReport,
  factory,
  eventsHook = useOperationEvents,
}: SituationWorkspaceProps) {
  const router = useRouter();
  const { connected } = eventsHook(`/operations/${operationId}/events`, () =>
    router.refresh(),
  );
  const mapRef = useRef<SituationMapHandle>(null);
  const mode = useMapMode();
  const { editingImageId, drawShape, movingCircleId } = mode;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const imageEditing = useImageOverlayEditing({
    imageOverlays,
    mode,
    onUpdateImagePlacement,
    onReplaceImage,
    onDeleteImage,
  });
  const {
    isDesktop,
    mainView,
    selectMainView,
    newEtbEntries,
    newEntryRef,
    mapShown,
    shownPanel,
    selectMapPanel,
    closeSheet,
    closeSheetOnPhone,
  } = useMainView({ journalEntries, currentUsername, onMapHidden: mode.reset });
  const now = useStalenessClock();
  const { focusTarget, jumpTo, returnToDefaultView } =
    useMapFocus(operationDefaultView);
  const search = useMapSearch(symbols, onGeocode, jumpTo);
  const { mapError, dismissMapError, runMapAction } =
    useMapActionError(closeSheetOnPhone);
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
    if (!view) return { error: "Die Karte lädt noch. Bitte erneut versuchen." };
    return onSetDefault(view);
  };

  const mainViewBar = (
    <MainViewBar
      activeView={mainView}
      onSelect={selectMainView}
      newEtbEntries={newEtbEntries}
    />
  );

  return (
    <LageansichtShell
      operationName={operationName}
      status={status}
      viewLinks={viewLinks}
      onCreateViewLink={onCreateViewLink}
      onDeleteViewLink={onDeleteViewLink}
      navigation={mainViewBar}
      connected={connected}
    >
      <Box
        className="situation-workspace"
        data-layout={isDesktop === null ? "unknown" : undefined}
      >
        <Box
          className="map-view"
          data-view="map"
          data-panel-open={shownPanel ? "" : undefined}
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
            <MapErrorAlert error={mapError} onClose={dismissMapError} />
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
                  onEndMode={mode.reset}
                  onSetCircleHere={areaFlows.setCircleHere}
                  circleMoveSaving={areaFlows.circleMoveSaving}
                />
              </Stack>
            </Box>
            <MapControls
              openPanel={shownPanel}
              onSelectPanel={selectMapPanel}
              onSetDefault={saveDefaultView}
              onReturnToDefault={returnToDefaultView}
              canReturnToDefault={operationDefaultView !== null}
            />
          </Box>

          {shownPanel && (
            <MapPanelSheet
              panel={shownPanel}
              onClose={isDesktop ? undefined : closeSheet}
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
                  onAddImage={onAddImage}
                  onSetImageVisibility={onSetImageVisibility}
                  onEditImage={startEditImage}
                  imageEditing={imageEditing}
                  onEndMode={mode.reset}
                />
              )}
            </MapPanelSheet>
          )}
        </Box>

        <Box
          className="etb-pane"
          data-view="etb"
          style={{
            flex: 1,
            minHeight: 0,
            display: mainView === "etb" ? undefined : "none",
          }}
          py="sm"
        >
          <JournalPanel
            operationId={operationId}
            entries={journalEntries}
            correspondents={correspondents}
            onAdd={onAddJournalEntry}
            onCorrect={onCorrectJournalEntry}
            onAnnul={onAnnulJournalEntry}
            newEntryRef={newEntryRef}
            visible={mainView === "etb"}
          />
        </Box>

        <Box
          className="strength-pane"
          data-view="strength"
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            display: mainView === "strength" ? undefined : "none",
          }}
          py="sm"
        >
          <StrengthPanel
            stations={stations}
            onCreateStation={onCreateStation}
            onRenameStation={onRenameStation}
            onRecordStrengthReport={onRecordStrengthReport}
            onReportTotalStrength={onReportTotalStrength}
            onCorrectStrengthReport={onCorrectStrengthReport}
            onAnnulStrengthReport={onAnnulStrengthReport}
            now={now}
          />
        </Box>

        <Box className="sidebar-bar">{mainViewBar}</Box>

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
        />
      </Box>
    </LageansichtShell>
  );
}
