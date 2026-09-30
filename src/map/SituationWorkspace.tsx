"use client";

import "./situation-workspace.css";
import {
  Alert,
  Box,
  CloseButton,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ActionResult } from "@/app/action-result";
import {
  type JournalEntryView,
  JournalPanel,
} from "@/app/operations/[id]/JournalPanel";
import { LageansichtShell } from "@/app/operations/[id]/LageansichtShell";
import type { EntryContent } from "@/journal/entry-route";
import type { GeoHit } from "@/server/geocoder/geocoder";
import type { KmlSourceType } from "@/server/kml/kml-overlays";
import type { PositionSource } from "@/server/mapsymbols/map-symbols";
import type { OperationStatus } from "@/server/operations/operations";
import { type StationView, StrengthPanel } from "@/strength/StrengthPanel";
import type { StrengthValues } from "@/strength/strength";
import { AdvancedSymbolForm } from "./AdvancedSymbolForm";
import { AreaEditorModal } from "./AreaEditorModal";
import { AreasPanel } from "./AreasPanel";
import type { MapAdapterFactory } from "./adapter";
import type { AreaGeometry, AreaShape, AreaStyle } from "./area";
import type { SymbolComposition } from "./composition";
import { ImageOverlayEditor } from "./ImageOverlayEditor";
import { ImageOverlayPanel } from "./ImageOverlayPanel";
import type { ImagePlacement } from "./image-overlay";
import { KmlPanel } from "./KmlPanel";
import { MainViewBar } from "./MainViewBar";
import { MAP_PANEL_LABEL, MapControls } from "./MapControls";
import { ModeBand } from "./ModeBand";
import { toPlacedSymbols } from "./placed-symbols";
import { QUICK_SELECT } from "./quick-select";
import { SearchBar } from "./SearchBar";
import {
  type PlacedSymbol,
  type RenderedArea,
  SituationMap,
  type SituationMapHandle,
} from "./SituationMap";
import { SymbolDetailModal } from "./SymbolDetailModal";
import { SymbolsPanel } from "./SymbolsPanel";
import { useMainView } from "./useMainView";
import { useMapFocus } from "./useMapFocus";
import { useMapMode } from "./useMapMode";
import { useMapSearch } from "./useMapSearch";
import { type LiveConnection, useOperationEvents } from "./useOperationEvents";
import { useStalenessClock } from "./useStalenessClock";
import type { ViewLinkItem } from "./ViewLinkPanel";
import type { MapView } from "./view";

export interface WorkspaceSymbol {
  id: string;
  lat: number;
  lng: number;
  composition: SymbolComposition;
  positionSource: PositionSource;
  reportedAt: Date | null;
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
  const {
    armedQuickId,
    armedCustom,
    editingImageId,
    drawShape,
    redrawAreaId,
    movingCircleId,
    armQuick,
    armCustom,
    armImageEdit,
    toggleDraw,
    redraw,
    armMoveCircle,
    endMoveCircle,
    reset: resetMode,
  } = useMapMode();
  const [advancedOpened, advanced] = useDisclosure(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Fehlerkanal für die Karten-Interaktionen ohne eigenes Panel (Platzieren,
  // Zeichnen); wird als Alert über der Karte gezeigt.
  const [mapError, setMapError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const endMode = () => {
    setImageError(null);
    resetMode();
  };
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
  } = useMainView({ journalEntries, currentUsername, onMapHidden: endMode });
  const now = useStalenessClock();
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    objectResults,
    addressResults,
  } = useMapSearch(symbols, onGeocode);
  const { focusTarget, jumpTo, returnToDefaultView } =
    useMapFocus(operationDefaultView);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [circleMoveSaving, setCircleMoveSaving] = useState(false);
  const selected = symbols.find((s) => s.id === selectedId) ?? null;
  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null;
  const movingCircle = areas.find((a) => a.id === movingCircleId) ?? null;

  const placed = useMemo<PlacedSymbol[]>(
    () => toPlacedSymbols(symbols, now),
    [symbols, now],
  );
  const armedComposition =
    armedCustom ??
    QUICK_SELECT.find((i) => i.id === armedQuickId)?.composition ??
    null;

  const editingImage =
    imageOverlays.find((o) => o.id === editingImageId) ?? null;

  const armQuickSymbol = (quickId: string | null) => {
    armQuick(quickId);
    if (quickId) closeSheetOnPhone();
  };
  const armAdvanced = (composition: SymbolComposition) => {
    armCustom(composition);
    advanced.close();
    closeSheetOnPhone();
  };
  const toggleAreaDraw = (shape: AreaShape) => {
    toggleDraw(shape);
    if (drawShape !== shape) closeSheetOnPhone();
  };
  const jumpFromPanel = (lat: number, lng: number) => {
    jumpTo(lat, lng);
    closeSheetOnPhone();
  };
  const saveDefaultView = async (): Promise<ActionResult> => {
    const view = mapRef.current?.getView();
    if (!view) return { error: "Die Karte lädt noch. Bitte erneut versuchen." };
    return onSetDefault(view);
  };
  // Dialoge und Panels zeigen die Fehler ihrer Actions selbst. Karten-
  // Interaktionen ohne Panel (Platzieren, Zeichnen, Kreis verschieben) laufen
  // über diesen gemeinsamen Fehlerkanal: ein zurückgegebener {error} landet im
  // mapError-Alert, eine geworfene Ausnahme (kein ValidationError – z. B. DB-/
  // Netzfehler, die operationAction weiterwirft) im gleichen Kanal mit
  // Fallback-Text. Bewusst ohne Fehleranzeige bleiben nur die strukturell stets
  // gültigen: onMove (Drag auf gültige Koordinaten) und „Gerätelink erzeugen".
  const runMapAction = async <R extends ActionResult>(
    op: () => Promise<R>,
  ): Promise<R | undefined> => {
    setMapError(null);
    try {
      const result = await op();
      if (result.error) showMapError(result.error);
      return result;
    } catch {
      showMapError("Aktion fehlgeschlagen. Bitte erneut versuchen.");
      return undefined;
    }
  };
  // Der Fehler steht unten auf der Karte; am Handy läge er sonst unter dem Blatt.
  const showMapError = (error: string) => {
    setMapError(error);
    closeSheetOnPhone();
  };

  // Wie bei Bild: nach einer Platzierung den Modus beenden, sonst platziert
  // jeder weitere Kartenklick unaufhörlich weiter (kein Abbruch möglich). Der
  // Reset läuft vor dem (evtl. langsamen) Server-Roundtrip, damit ein zweiter
  // Tap währenddessen kein zweites Zeichen platziert.
  const placeSymbolAt = async (
    composition: SymbolComposition,
    lat: number,
    lng: number,
  ) => {
    resetMode();
    await runMapAction(() => onPlace(composition, lat, lng));
  };

  const handleDrawComplete = async (geometry: AreaGeometry) => {
    // Kein Panel für diesen Fluss, und der Modus muss in jedem Fall enden. Ein
    // etwaiger {error} – etwa eine entartete Geometrie (Kreis mit Radius 0 aus
    // einem Tap ohne Ziehen) – wird über den mapError-Kanal gezeigt. resetMode
    // läuft (wie beim Platzieren) vor dem Roundtrip; die Branch-Entscheidung
    // hält die id vorher fest, weil resetMode redrawAreaId leert.
    const redrawId = redrawAreaId;
    resetMode();
    if (redrawId) {
      await runMapAction(() => onUpdateAreaGeometry(redrawId, geometry));
      return;
    }
    const created = await runMapAction(() => onCreateArea(geometry));
    // A new circle opens its editor for the radius. The area arrives with the
    // next refresh; the Modal opens once `areas` contains it.
    if (created?.id && geometry.shape === "circle") {
      setSelectedAreaId(created.id);
    }
  };
  const startRedraw = (area: RenderedArea) => {
    redraw(area.geometry.shape, area.id);
    setSelectedAreaId(null);
    closeSheetOnPhone();
  };
  const startMoveCircle = (area: RenderedArea) => {
    armMoveCircle(area.id);
    setSelectedAreaId(null);
    closeSheetOnPhone();
  };
  // The new centre is the map centre under the crosshair; the radius comes from
  // the latest `areas`, so that a radius changed elsewhere meanwhile is kept.
  const setCircleHere = async () => {
    const view = mapRef.current?.getView();
    if (!view || movingCircle?.geometry.shape !== "circle") return;
    const { id, geometry } = movingCircle;
    setCircleMoveSaving(true);
    const result = await runMapAction(() =>
      onUpdateAreaGeometry(id, {
        shape: "circle",
        center: { lat: view.lat, lng: view.lng },
        radius: geometry.radius,
      }),
    );
    setCircleMoveSaving(false);
    if (result && !result.error) endMoveCircle(id);
  };
  // Deleted elsewhere while being moved: nothing left to move.
  useEffect(() => {
    if (movingCircleId && !movingCircle) endMoveCircle(movingCircleId);
  }, [movingCircleId, movingCircle, endMoveCircle]);

  // Platzierungs-/Deckkraft-/Ersetzen-Änderungen speichern, ohne den
  // Bearbeiten-Modus zu verlassen (nur „Fertig"/„Löschen" beenden ihn).
  const persistImage = async (op: () => Promise<ActionResult>) => {
    setImageBusy(true);
    try {
      setImageError((await op()).error ?? null);
    } finally {
      setImageBusy(false);
    }
  };
  const startEditImage = (id: string) => {
    setImageError(null);
    armImageEdit(id);
    closeSheetOnPhone();
  };
  const saveImagePlacement = (id: string, placement: ImagePlacement) =>
    persistImage(() => onUpdateImagePlacement(id, placement));
  const changeImageOpacity = (opacity: number) => {
    if (!editingImage) return;
    void persistImage(() =>
      onUpdateImagePlacement(editingImage.id, {
        ...editingImage.placement,
        opacity,
      }),
    );
  };
  const replaceImage = (file: File) => {
    if (!editingImageId) return;
    void persistImage(() => onReplaceImage(editingImageId, file));
  };
  const deleteImage = async (id: string) => {
    const result = await onDeleteImage(id);
    if (!result.error) endMode();
    return result;
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
              armedComposition={armedComposition}
              onPlace={placeSymbolAt}
              onMove={onMove}
              onSelect={setSelectedId}
              focusTarget={focusTarget}
              areas={areas}
              drawShape={drawShape}
              onDrawComplete={handleDrawComplete}
              kmlOverlays={kmlOverlays}
              imageOverlays={imageOverlays}
              editingImageId={editingImageId}
              onEditImagePlacement={saveImagePlacement}
              movingCircleId={movingCircleId}
              factory={factory}
            />
            {movingCircleId && (
              <Box className="map-crosshair" aria-hidden="true" />
            )}
            {mapError && (
              <Box
                pos="absolute"
                bottom={24}
                left={12}
                right={64}
                style={{ zIndex: 1200 }}
              >
                <Alert
                  color="red"
                  radius="sm"
                  py="xs"
                  role="alert"
                  withCloseButton
                  onClose={() => setMapError(null)}
                >
                  {mapError}
                </Alert>
              </Box>
            )}
            <Box className="map-search">
              <Stack gap={8}>
                <SearchBar
                  query={searchQuery}
                  onQueryChange={setSearchQuery}
                  objectResults={objectResults}
                  addressResults={addressResults}
                  attribution={geocoderAttribution}
                  onJump={jumpTo}
                />
                {armedComposition && (
                  <ModeBand
                    label="Kartenzeichen platzieren"
                    actionLabel="Abbrechen"
                    onAction={endMode}
                  />
                )}
                {drawShape && (
                  <ModeBand
                    label="Bereich zeichnen"
                    actionLabel="Abbrechen"
                    onAction={endMode}
                  />
                )}
                {movingCircleId && (
                  <ModeBand
                    label="Kreis verschieben"
                    confirm={{ label: "Hier setzen", onClick: setCircleHere }}
                    actionLabel="Abbrechen"
                    onAction={endMode}
                    busy={circleMoveSaving}
                  />
                )}
                {editingImageId && (
                  <ModeBand
                    label="Bild-Overlay bearbeiten"
                    actionLabel="Fertig"
                    onAction={endMode}
                  />
                )}
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
            <Box
              component="section"
              aria-labelledby="map-panel-title"
              className="map-panel"
            >
              <Group justify="space-between" wrap="nowrap" px="sm" py={6}>
                <Text id="map-panel-title" fw={600}>
                  {MAP_PANEL_LABEL[shownPanel]}
                </Text>
                {!isDesktop && (
                  <CloseButton aria-label="Schließen" onClick={closeSheet} />
                )}
              </Group>
              <Box className="map-panel__content" p="sm">
                {shownPanel === "symbols" && (
                  <SymbolsPanel
                    symbols={symbols}
                    placed={placed}
                    armedQuickId={armedQuickId}
                    onArmQuick={armQuickSymbol}
                    onOpenAdvanced={advanced.open}
                    onJump={jumpFromPanel}
                    onEdit={setSelectedId}
                  />
                )}
                {shownPanel === "areas" && (
                  <AreasPanel
                    areas={areas}
                    drawShape={drawShape}
                    onToggleDraw={toggleAreaDraw}
                    onJump={jumpFromPanel}
                    onEdit={setSelectedAreaId}
                  />
                )}
                {shownPanel === "layers" && (
                  <Stack>
                    <KmlPanel
                      overlays={kmlOverlays}
                      onAddFile={onAddKmlFile}
                      onAddUrl={onAddKmlUrl}
                      onToggleVisibility={onSetKmlVisibility}
                      onReload={onReloadKml}
                      onRemove={onRemoveKml}
                    />
                    <Stack
                      component="section"
                      aria-labelledby="image-overlay-heading"
                      gap="xs"
                    >
                      <Text id="image-overlay-heading" fw={600} size="sm">
                        Bild-Overlays
                      </Text>
                      <ImageOverlayPanel
                        overlays={imageOverlays}
                        editingId={editingImageId}
                        onAdd={onAddImage}
                        onToggleVisibility={onSetImageVisibility}
                        onEdit={startEditImage}
                        renderEditor={() =>
                          editingImage && (
                            <ImageOverlayEditor
                              opacity={editingImage.placement.opacity}
                              onOpacityChange={changeImageOpacity}
                              onReplace={replaceImage}
                              onDelete={() => deleteImage(editingImage.id)}
                              onDone={endMode}
                              busy={imageBusy}
                              error={imageError}
                            />
                          )
                        }
                      />
                    </Stack>
                  </Stack>
                )}
              </Box>
            </Box>
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
          area={selectedArea}
          onClose={() => setSelectedAreaId(null)}
          onUpdateAreaStyle={onUpdateAreaStyle}
          onUpdateAreaGeometry={onUpdateAreaGeometry}
          onDeleteArea={onDeleteArea}
          onRedraw={startRedraw}
          onMoveCircle={startMoveCircle}
        />

        <Modal
          opened={advancedOpened}
          onClose={advanced.close}
          title="Kartenzeichen zusammensetzen"
        >
          <AdvancedSymbolForm submitLabel="Platzieren" onSubmit={armAdvanced} />
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
