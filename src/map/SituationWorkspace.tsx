"use client";

import "./situation-workspace.css";
import {
  Alert,
  Badge,
  Box,
  Button,
  CloseButton,
  Group,
  Image,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ActionResult } from "@/app/action-result";
import { ConfirmationModal } from "@/app/ConfirmationModal";
import {
  type JournalEntryView,
  JournalPanel,
} from "@/app/operations/[id]/JournalPanel";
import { LageansichtShell } from "@/app/operations/[id]/LageansichtShell";
import type { GeoHit } from "@/server/geocoder/geocoder";
import type { KmlSourceType } from "@/server/kml/kml-overlays";
import type { PositionSource } from "@/server/mapsymbols/map-symbols";
import type { OperationStatus } from "@/server/operations/operations";
import { type StationView, StrengthPanel } from "@/strength/StrengthPanel";
import type { StrengthValues } from "@/strength/strength";
import { AdvancedSymbolForm } from "./AdvancedSymbolForm";
import { AreaEditor } from "./AreaEditor";
import type { MapAdapterFactory } from "./adapter";
import {
  type AreaGeometry,
  type AreaShape,
  type AreaStyle,
  areaCenter,
} from "./area";
import type { SymbolComposition } from "./composition";
import { DeviceLinkPanel } from "./DeviceLinkPanel";
import { ImageOverlayEditor } from "./ImageOverlayEditor";
import { ImageOverlayPanel } from "./ImageOverlayPanel";
import type { ImagePlacement } from "./image-overlay";
import { KmlPanel } from "./KmlPanel";
import { type MainView, MainViewBar } from "./MainViewBar";
import { MAP_PANEL_LABEL, MapControls, type MapPanel } from "./MapControls";
import { ModeBand } from "./ModeBand";
import { PanelRow } from "./PanelRow";
import { toPlacedSymbols } from "./placed-symbols";
import { QuickSelectToolbar } from "./QuickSelectToolbar";
import { QUICK_SELECT } from "./quick-select";
import { SearchBar } from "./SearchBar";
import {
  type PlacedSymbol,
  type RenderedArea,
  SituationMap,
  type SituationMapHandle,
} from "./SituationMap";
import { renderSymbolDataUrl } from "./tactical-symbol";
import { countUnseenEntries } from "./unseen-entries";
import { useIsDesktop } from "./useIsDesktop";
import { useMapFocus } from "./useMapFocus";
import { useMapMode } from "./useMapMode";
import { useMapSearch } from "./useMapSearch";
import { type LiveConnection, useOperationEvents } from "./useOperationEvents";
import { useStalenessClock } from "./useStalenessClock";
import type { ViewLinkItem } from "./ViewLinkPanel";
import type { MapView } from "./view";

const AREA_SHAPES: { shape: AreaShape; label: string }[] = [
  { shape: "polygon", label: "Polygon" },
  { shape: "line", label: "Linie" },
  { shape: "circle", label: "Kreis" },
];

const SHAPE_LABEL = Object.fromEntries(
  AREA_SHAPES.map(({ shape, label }) => [shape, label]),
) as Record<AreaShape, string>;

export interface WorkspaceSymbol {
  id: string;
  lat: number;
  lng: number;
  composition: SymbolComposition;
  positionSource?: PositionSource;
  reportedAt?: Date | null;
  deviceLinkToken?: string | null;
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
  viewLinks?: ViewLinkItem[];
  onCreateViewLink?: (label: string) => void | Promise<void>;
  onDeleteViewLink?: (id: string) => Promise<ActionResult>;
  operationDefaultView: MapView | null;
  tileUrl: string;
  attribution: string;
  symbols: WorkspaceSymbol[];
  journalEntries: JournalEntryView[];
  onAddJournalEntry: (text: string) => Promise<ActionResult>;
  onCorrectJournalEntry: (id: string, text: string) => Promise<ActionResult>;
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
  const [openPanel, setOpenPanel] = useState<MapPanel | null>(null);
  const mapRef = useRef<SituationMapHandle>(null);
  const [mainView, setMainView] = useState<MainView>("etb");
  const isDesktop = useIsDesktop();
  const newEntryRef = useRef<HTMLTextAreaElement>(null);
  const [newEntryFocusRequests, setNewEntryFocusRequests] = useState(0);
  const latestEntryNumber = Math.max(
    0,
    ...journalEntries.map((entry) => entry.number),
  );
  // Höchste Eintragsnummer, die im ETB zu sehen war; beim Laden gilt alles
  // Vorhandene als gesehen. Lebt nur in dieser Seite.
  const [seenUpTo, setSeenUpTo] = useState(latestEntryNumber);
  const newEtbEntries =
    mainView === "map" || mainView === "strength"
      ? countUnseenEntries(journalEntries, seenUpTo, currentUsername)
      : 0;
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
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [deleteAskedFor, setDeleteAskedFor] = useState<string | null>(null);
  // Fehlerkanal für die Karten-Interaktionen ohne eigenes Panel (Platzieren,
  // Zeichnen); wird als Alert über der Karte gezeigt.
  const [mapError, setMapError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
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
  const [areaError, setAreaError] = useState<string | null>(null);
  const [areaBusy, setAreaBusy] = useState(false);
  const [circleMoveSaving, setCircleMoveSaving] = useState(false);
  const selected = symbols.find((s) => s.id === selectedId) ?? null;
  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null;
  const movingCircle = areas.find((a) => a.id === movingCircleId) ?? null;

  const openDetail = (id: string) => {
    setSelectedId(id);
    setDetailError(null);
  };
  const closeDetail = () => {
    setSelectedId(null);
    setDetailError(null);
  };

  const deleteSymbol = async (id: string) => {
    const result = await onDelete(id);
    if (!result.error) closeDetail();
    return result;
  };

  // Fehler-Politik der Action-Ergebnisse: Panel-Bearbeitungen (Kartenzeichen-
  // Detail, Bereich, ETB) reichen ihren `{error}` über runDetail/runArea bzw.
  // JournalPanel sichtbar durch. Platzieren und Zeichnen haben kein Panel,
  // können aber sehr wohl scheitern (eine überlange Bezeichnung aus dem
  // Erweitert-Formular, eine entartete Geometrie), daher zeigen sie ihren
  // `{error}` über den `mapError`-Kanal. Was eine Rückfrage hat – „Kartenzeichen
  // löschen", „Bereich löschen" (AreaEditor), „Bild-Overlay löschen"
  // (ImageOverlayEditor), „KML-Overlay entfernen" (KmlPanel), „Gerätelink neu
  // generieren", „Standard-Ausschnitt festlegen" (MapControls) –, zeigt seinen
  // Fehler in der Rückfrage. Nur die strukturell stets gültigen Interaktionen
  // bleiben bewusst fire-and-forget: onMove (Drag auf gültige Koordinaten) und
  // „Gerätelink erzeugen" (nur eine Objekt-id).
  const runDetail = async (op: () => Promise<ActionResult>) => {
    setDetailBusy(true);
    try {
      const { error } = await op();
      if (error) {
        setDetailError(error);
        return;
      }
      closeDetail();
    } catch {
      setDetailError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setDetailBusy(false);
    }
  };

  const toolbarItems = useMemo(
    () =>
      QUICK_SELECT.map((i) => ({
        id: i.id,
        label: i.label,
        iconUrl: renderSymbolDataUrl(i.composition),
      })),
    [],
  );
  const placed = useMemo<PlacedSymbol[]>(
    () => toPlacedSymbols(symbols, now),
    [symbols, now],
  );
  const symbolRows = useMemo(() => {
    const placedById = new Map(placed.map((p) => [p.id, p]));
    return symbols.map((s) => {
      const marker = placedById.get(s.id);
      return {
        id: s.id,
        iconUrl: marker?.iconUrl ?? renderSymbolDataUrl(s.composition),
        name: s.composition.text?.trim() || "Ohne Bezeichnung",
        stale: (marker?.opacity ?? 1) < 1,
        device: s.positionSource === "device",
        lat: s.lat,
        lng: s.lng,
      };
    });
  }, [placed, symbols]);

  const armedComposition =
    armedCustom ??
    QUICK_SELECT.find((i) => i.id === armedQuickId)?.composition ??
    null;

  const editingImage =
    imageOverlays.find((o) => o.id === editingImageId) ?? null;

  // Am Desktop steht unter „Lagekarte" in der Seitenleiste immer ein Panel;
  // am Handy ist das Panel ein Blatt über der Karte, das auch zu sein kann.
  const shownPanel: MapPanel | null = isDesktop
    ? mainView === "map"
      ? (openPanel ?? "symbols")
      : null
    : openPanel;
  const selectMapPanel = (panel: MapPanel) => {
    if (!isDesktop) {
      setOpenPanel((open) => (open === panel ? null : panel));
      return;
    }
    setOpenPanel(panel);
    switchMainView("map");
  };
  // Am Handy liegt das Blatt über der unteren Kartenhälfte; wer dort auf der
  // Karte weiterarbeitet (platzieren, zeichnen, angesprungenes Ziel ansehen),
  // braucht die Fläche. Am Desktop steht das Panel in der Seitenleiste und bleibt.
  const closeSheetOnPhone = () => {
    if (!isDesktop) setOpenPanel(null);
  };
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
  // Karten-Interaktionen ohne Panel (Platzieren, Zeichnen) über einen
  // gemeinsamen Fehlerkanal: ein zurückgegebener {error} landet im mapError-
  // Alert, eine geworfene Ausnahme (kein ValidationError – z. B. DB-/Netzfehler,
  // die operationAction weiterwirft) im gleichen Kanal mit Fallback-Text.
  // Analog zu runDetail/runArea, nur ohne eigenes Panel.
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
  const closeArea = () => {
    setSelectedAreaId(null);
    setAreaError(null);
  };
  const deleteArea = async (id: string) => {
    const result = await onDeleteArea(id);
    if (!result.error) closeArea();
    return result;
  };
  const runArea = async (op: () => Promise<ActionResult>) => {
    setAreaBusy(true);
    try {
      const { error } = await op();
      if (error) {
        setAreaError(error);
        return;
      }
      closeArea();
    } catch {
      setAreaError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setAreaBusy(false);
    }
  };
  // The centre comes from the latest `areas`, so that a move made elsewhere
  // while the editor was open is not undone.
  const saveArea = async (
    area: RenderedArea,
    style: AreaStyle,
    radius: number | undefined,
  ): Promise<ActionResult> => {
    if (radius !== undefined && area.geometry.shape === "circle") {
      const { error } = await onUpdateAreaGeometry(area.id, {
        shape: "circle",
        center: area.geometry.center,
        radius,
      });
      if (error) return { error };
    }
    return onUpdateAreaStyle(area.id, style);
  };
  const startRedraw = () => {
    if (!selectedArea) return;
    redraw(selectedArea.geometry.shape, selectedArea.id);
    setSelectedAreaId(null);
    setAreaError(null);
    closeSheetOnPhone();
  };

  const startMoveCircle = () => {
    if (!selectedArea) return;
    armMoveCircle(selectedArea.id);
    setSelectedAreaId(null);
    setAreaError(null);
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
  const endMode = () => {
    setImageError(null);
    resetMode();
  };
  // Verschwindet die Karte (Wechsel am Handy, Fenster schmaler als 48 em),
  // endet jeder Karten-Modus, sonst platziert ein späterer Tap auf die wieder
  // gezeigte Karte unerwartet ein Zeichen.
  const mapShown = isMapShown(isDesktop, mainView);
  const [mapWasShown, setMapWasShown] = useState(mapShown);
  if (mapShown !== mapWasShown) {
    setMapWasShown(mapShown);
    if (!mapShown) endMode();
  }
  const switchMainView = (view: MainView) => {
    if (view === mainView) return;
    setMainView(view);
    if (view === "etb" || mainView === "etb") setSeenUpTo(latestEntryNumber);
  };
  // Am Desktop setzt jeder Klick auf „ETB" den Cursor ins Eingabefeld, auch
  // wenn das ETB schon gezeigt wird. Der Effekt fokussiert erst nach dem
  // Rendern, wenn das Feld sichtbar ist.
  const selectMainView = (view: MainView) => {
    switchMainView(view);
    if (view === "etb" && isDesktop) setNewEntryFocusRequests((n) => n + 1);
  };
  useEffect(() => {
    if (newEntryFocusRequests > 0) newEntryRef.current?.focus();
  }, [newEntryFocusRequests]);
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
              onSelect={openDetail}
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
                  <CloseButton
                    aria-label="Schließen"
                    onClick={() => setOpenPanel(null)}
                  />
                )}
              </Group>
              <Box className="map-panel__content" p="sm">
                {shownPanel === "symbols" && (
                  <Stack gap="sm">
                    <Group gap="xs" align="flex-start">
                      <QuickSelectToolbar
                        items={toolbarItems}
                        armedId={armedQuickId}
                        onArm={armQuickSymbol}
                      />
                      <Button size="xs" variant="light" onClick={advanced.open}>
                        Erweitert …
                      </Button>
                    </Group>
                    {symbolRows.length === 0 ? (
                      <Text c="dimmed" size="sm">
                        Noch keine Kartenzeichen. Zeichen wählen und auf die
                        Karte tippen.
                      </Text>
                    ) : (
                      <Stack gap={4}>
                        {symbolRows.map((row) => (
                          <PanelRow
                            key={row.id}
                            name={row.name}
                            onJump={() => jumpFromPanel(row.lat, row.lng)}
                            onEdit={() => openDetail(row.id)}
                            icon={
                              <Image src={row.iconUrl} alt="" w={22} h={22} />
                            }
                            meta={
                              row.stale ? (
                                <Badge size="xs" color="orange">
                                  veraltet
                                </Badge>
                              ) : row.device ? (
                                <Badge size="xs" color="green">
                                  live
                                </Badge>
                              ) : null
                            }
                          />
                        ))}
                      </Stack>
                    )}
                  </Stack>
                )}
                {shownPanel === "areas" && (
                  <Stack gap="sm">
                    <Group gap="xs">
                      {AREA_SHAPES.map(({ shape, label }) => (
                        <Button
                          key={shape}
                          size="xs"
                          variant={drawShape === shape ? "filled" : "default"}
                          aria-pressed={drawShape === shape}
                          onClick={() => toggleAreaDraw(shape)}
                        >
                          {label}
                        </Button>
                      ))}
                    </Group>
                    {areas.length === 0 ? (
                      <Text c="dimmed" size="sm">
                        Noch keine Bereiche. Form wählen und auf die Karte
                        zeichnen.
                      </Text>
                    ) : (
                      <Stack gap={4}>
                        {areas.map((area) => (
                          <PanelRow
                            key={area.id}
                            name={area.label || "Bereich"}
                            onJump={() => {
                              const center = areaCenter(area.geometry);
                              jumpFromPanel(center.lat, center.lng);
                            }}
                            onEdit={() => setSelectedAreaId(area.id)}
                            icon={
                              <Box
                                w={14}
                                h={14}
                                style={{
                                  background: area.color,
                                  borderRadius: 3,
                                  flex: "none",
                                }}
                              />
                            }
                            meta={
                              <Text size="xs" c="dimmed">
                                {SHAPE_LABEL[area.geometry.shape]}
                              </Text>
                            }
                          />
                        ))}
                      </Stack>
                    )}
                  </Stack>
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
            entries={journalEntries}
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

        <Modal.Stack>
          <Modal
            stackId="bereich"
            opened={selectedArea !== null}
            onClose={closeArea}
            title="Bereich"
          >
            {selectedArea && (
              <AreaEditor
                key={selectedArea.id}
                initial={{
                  color: selectedArea.color,
                  opacity: selectedArea.opacity,
                  label: selectedArea.label,
                }}
                radius={
                  selectedArea.geometry.shape === "circle"
                    ? selectedArea.geometry.radius
                    : undefined
                }
                busy={areaBusy}
                error={areaError}
                onSave={(style, radius) =>
                  runArea(() => saveArea(selectedArea, style, radius))
                }
                onRedraw={startRedraw}
                onMove={
                  selectedArea.geometry.shape === "circle"
                    ? startMoveCircle
                    : undefined
                }
                onDelete={() => deleteArea(selectedArea.id)}
              />
            )}
          </Modal>
        </Modal.Stack>

        <Modal
          opened={advancedOpened}
          onClose={advanced.close}
          title="Kartenzeichen zusammensetzen"
        >
          <AdvancedSymbolForm submitLabel="Platzieren" onSubmit={armAdvanced} />
        </Modal>

        <Modal.Stack>
          <Modal
            stackId="kartenzeichen"
            opened={selected !== null}
            onClose={closeDetail}
            title="Kartenzeichen"
          >
            {selected && (
              <Stack>
                {detailError && (
                  <Alert color="red" role="alert">
                    {detailError}
                  </Alert>
                )}
                <AdvancedSymbolForm
                  initial={selected.composition}
                  submitLabel="Speichern"
                  busy={detailBusy}
                  onSubmit={(composition) =>
                    runDetail(() => onUpdate(selected.id, composition))
                  }
                />
                <Button
                  color="red"
                  variant="light"
                  loading={detailBusy}
                  onClick={() => setDeleteAskedFor(selected.id)}
                >
                  Löschen
                </Button>
                <ConfirmationModal
                  stackId="kartenzeichen-loeschen"
                  opened={deleteAskedFor === selected.id}
                  onClose={() => setDeleteAskedFor(null)}
                  title="Kartenzeichen löschen"
                  confirmLabel="Endgültig löschen"
                  onConfirm={() => deleteSymbol(selected.id)}
                >
                  Das Kartenzeichen verschwindet von der Lagekarte, ein
                  Gerätelink wird ungültig. Das lässt sich nicht rückgängig
                  machen.
                </ConfirmationModal>
                <DeviceLinkPanel
                  token={selected.deviceLinkToken ?? null}
                  positionSource={selected.positionSource ?? "manual"}
                  reportedAt={selected.reportedAt ?? null}
                  onGenerate={() => onGenerateDeviceLink(selected.id)}
                />
              </Stack>
            )}
          </Modal>
        </Modal.Stack>
      </Box>
    </LageansichtShell>
  );
}

/**
 * Am Desktop steht die Karte immer neben der Seitenleiste, am Handy nur unter
 * „Lagekarte". Bei unbekannter Breite (vor dem Mount) entscheidet das CSS.
 */
function isMapShown(isDesktop: boolean | null, mainView: MainView) {
  return isDesktop !== false || mainView === "map";
}
