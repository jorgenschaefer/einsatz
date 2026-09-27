"use client";

import "./situation-workspace.css";
import {
  ActionIcon,
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
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPencil } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ActionResult } from "@/app/operations/[id]/action-result";
import {
  type JournalEntryView,
  JournalPanel,
} from "@/app/operations/[id]/JournalPanel";
import { LageansichtShell } from "@/app/operations/[id]/LageansichtShell";
import type { GeoHit } from "@/server/geocoder/geocoder";
import type { KmlSourceType } from "@/server/kml/kml-overlays";
import type { PositionSource } from "@/server/mapsymbols/map-symbols";
import type { OperationStatus } from "@/server/operations/operations";
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
import {
  type ImageActionResult,
  type ImageOverlayItem,
  ImageOverlayPanel,
} from "./ImageOverlayPanel";
import type { ImagePlacement } from "./image-overlay";
import {
  type KmlActionResult,
  type KmlOverlayView,
  KmlPanel,
} from "./KmlPanel";
import { type MainView, MainViewBar } from "./MainViewBar";
import { MAP_PANEL_LABEL, MapControls, type MapPanel } from "./MapControls";
import { ModeBand } from "./ModeBand";
import { toPlacedSymbols } from "./placed-symbols";
import { QuickSelectToolbar } from "./QuickSelectToolbar";
import { QUICK_SELECT } from "./quick-select";
import { SearchBar } from "./SearchBar";
import {
  type PlacedSymbol,
  type RenderedArea,
  type RenderedImageOverlay,
  type RenderedKmlOverlay,
  SituationMap,
  type SituationMapHandle,
} from "./SituationMap";
import { renderSymbolDataUrl } from "./tactical-symbol";
import { countUnseenEntries } from "./unseen-entries";
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
  onDeleteViewLink?: (id: string) => void | Promise<void>;
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
  onCreateArea: (geometry: AreaGeometry) => Promise<ActionResult>;
  onUpdateAreaStyle: (id: string, style: AreaStyle) => Promise<ActionResult>;
  onUpdateAreaGeometry: (
    id: string,
    geometry: AreaGeometry,
  ) => Promise<ActionResult>;
  onDeleteArea: (id: string) => Promise<ActionResult>;
  kmlOverlays: WorkspaceKmlOverlay[];
  onAddKmlFile: (name: string, content: string) => Promise<KmlActionResult>;
  onAddKmlUrl: (name: string, url: string) => Promise<KmlActionResult>;
  onSetKmlVisibility: (
    id: string,
    visible: boolean,
  ) => Promise<KmlActionResult>;
  onReloadKml: (id: string) => Promise<KmlActionResult>;
  onRemoveKml: (id: string) => Promise<KmlActionResult>;
  imageOverlays: WorkspaceImageOverlay[];
  onAddImage: (file: File) => Promise<ImageActionResult>;
  onUpdateImagePlacement: (
    id: string,
    placement: ImagePlacement,
  ) => Promise<ImageActionResult>;
  onReplaceImage: (id: string, file: File) => Promise<ImageActionResult>;
  onSetImageVisibility: (
    id: string,
    visible: boolean,
  ) => Promise<ImageActionResult>;
  onDeleteImage: (id: string) => Promise<ImageActionResult>;
  /** Für Tests injizierbar. */
  factory?: MapAdapterFactory;
  /** Für Tests injizierbar; sonst der echte SSE-Hook. */
  eventsHook?: (url: string, onChanged: () => void) => LiveConnection;
}

/** Ab dieser Breite gilt die Desktop-Form (Leiste links, Panel rechts). */
const WIDE_QUERY = "(min-width: 48em)";

const isPhone = () => !window.matchMedia(WIDE_QUERY).matches;

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
  factory,
  eventsHook = useOperationEvents,
}: SituationWorkspaceProps) {
  const router = useRouter();
  const { connected } = eventsHook(`/operations/${operationId}/events`, () =>
    router.refresh(),
  );
  const [openPanel, setOpenPanel] = useState<MapPanel | null>(null);
  const mapRef = useRef<SituationMapHandle>(null);
  const [mainView, setMainView] = useState<MainView | "default">("default");
  // Einmalig beim Mount die Startansicht nach Breite festlegen (kein Listener):
  // eine spätere Breitenänderung (Tablet drehen) soll die gewählte Hauptansicht
  // nicht mehr verändern.
  useEffect(() => {
    setMainView(window.matchMedia(WIDE_QUERY).matches ? "map" : "etb");
  }, []);
  const latestEntryNumber = Math.max(
    0,
    ...journalEntries.map((entry) => entry.number),
  );
  // Höchste Eintragsnummer, die im ETB zu sehen war; beim Laden gilt alles
  // Vorhandene als gesehen. Lebt nur in dieser Seite.
  const [seenUpTo, setSeenUpTo] = useState(latestEntryNumber);
  const newEtbEntries =
    mainView === "map"
      ? countUnseenEntries(journalEntries, seenUpTo, currentUsername)
      : 0;
  const {
    armedQuickId,
    armedCustom,
    editingImageId,
    drawShape,
    redrawAreaId,
    armQuick,
    armCustom,
    armImageEdit,
    toggleDraw,
    redraw,
    reset: resetMode,
  } = useMapMode();
  const [advancedOpened, advanced] = useDisclosure(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
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
  const selected = symbols.find((s) => s.id === selectedId) ?? null;
  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null;

  const closeDetail = () => {
    setSelectedId(null);
    setDetailError(null);
  };

  // Fehler-Politik der Action-Ergebnisse: Panel-Bearbeitungen (Kartenzeichen-
  // Detail, Bereich, ETB) reichen ihren `{error}` über runDetail/runArea bzw.
  // JournalPanel sichtbar durch. Platzieren und Zeichnen haben kein Panel,
  // können aber sehr wohl scheitern (eine überlange Bezeichnung aus dem
  // Erweitert-Formular, eine entartete Geometrie), daher zeigen sie ihren
  // `{error}` über den `mapError`-Kanal; „Standard-Ausschnitt festlegen" zeigt
  // seinen in der Rückfrage (MapControls). Nur die strukturell stets gültigen
  // Interaktionen bleiben bewusst fire-and-forget: onMove (Drag auf gültige
  // Koordinaten) und onGenerateDeviceLink (nur eine Objekt-id).
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

  const kmlViews = useMemo<KmlOverlayView[]>(
    () =>
      kmlOverlays.map((o) => ({
        id: o.id,
        name: o.name,
        sourceType: o.sourceType,
        visible: o.visible,
      })),
    [kmlOverlays],
  );
  const renderedKml = useMemo<RenderedKmlOverlay[]>(
    () =>
      kmlOverlays.map((o) => ({
        id: o.id,
        content: o.content,
        visible: o.visible,
      })),
    [kmlOverlays],
  );
  const imageItems = useMemo<ImageOverlayItem[]>(
    () =>
      imageOverlays.map((o) => ({
        id: o.id,
        name: o.name,
        visible: o.visible,
      })),
    [imageOverlays],
  );
  const renderedImages = useMemo<RenderedImageOverlay[]>(
    () =>
      imageOverlays.map((o) => ({
        id: o.id,
        imageUrl: o.imageUrl,
        placement: o.placement,
        aspect: o.aspect,
        visible: o.visible,
      })),
    [imageOverlays],
  );
  const editingImage =
    imageOverlays.find((o) => o.id === editingImageId) ?? null;

  const togglePanel = (panel: MapPanel) =>
    setOpenPanel((open) => (open === panel ? null : panel));
  // Am Handy liegt das Blatt über der unteren Kartenhälfte; wer dort auf der
  // Karte weiterarbeitet (platzieren, zeichnen, angesprungenes Ziel ansehen),
  // braucht die Fläche. Am Desktop steht das Panel neben der Karte und bleibt.
  const closeSheetOnPhone = () => {
    if (isPhone()) setOpenPanel(null);
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
  const runMapAction = async (op: () => Promise<ActionResult>) => {
    setMapError(null);
    try {
      const { error } = await op();
      if (error) showMapError(error);
    } catch {
      showMapError("Aktion fehlgeschlagen. Bitte erneut versuchen.");
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
    await runMapAction(() =>
      redrawId
        ? onUpdateAreaGeometry(redrawId, geometry)
        : onCreateArea(geometry),
    );
  };
  const runArea = async (op: () => Promise<ActionResult>) => {
    setAreaBusy(true);
    try {
      const { error } = await op();
      if (error) {
        setAreaError(error);
        return;
      }
      setSelectedAreaId(null);
      setAreaError(null);
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
    closeSheetOnPhone();
  };

  // Platzierungs-/Deckkraft-/Ersetzen-Änderungen speichern, ohne den
  // Bearbeiten-Modus zu verlassen (nur „Fertig"/„Löschen" beenden ihn).
  const persistImage = async (op: () => Promise<ImageActionResult>) => {
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
  // Ein Wechsel der Hauptansicht beendet jeden Karten-Modus, sonst platziert
  // ein späterer Tap auf die wieder gezeigte Karte unerwartet ein Zeichen.
  const switchMainView = (view: MainView) => {
    if (view === mainView) return;
    setMainView(view);
    setSeenUpTo(latestEntryNumber);
    endMode();
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
  const deleteImage = async () => {
    if (!editingImageId) return;
    setImageBusy(true);
    try {
      const result = await onDeleteImage(editingImageId);
      if (result.error) setImageError(result.error);
      else endMode();
    } finally {
      setImageBusy(false);
    }
  };

  return (
    <LageansichtShell
      operationName={operationName}
      status={status}
      viewLinks={viewLinks}
      onCreateViewLink={onCreateViewLink}
      onDeleteViewLink={onDeleteViewLink}
      navigation={
        <MainViewBar
          activeView={mainView}
          onSelect={switchMainView}
          newEtbEntries={newEtbEntries}
        />
      }
      connected={connected}
    >
      <Stack gap={0} h="100%" data-main-view={mainView}>
        <Box
          className="map-view"
          data-view="map"
          data-panel-open={openPanel ? "" : undefined}
          // Inline, damit es jede Klasse schlägt (auch die Startansicht-Regel).
          style={{ display: mainView === "etb" ? "none" : undefined }}
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
              kmlOverlays={renderedKml}
              imageOverlays={renderedImages}
              editingImageId={editingImageId}
              onEditImagePlacement={saveImagePlacement}
              factory={factory}
            />
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
              openPanel={openPanel}
              onTogglePanel={togglePanel}
              onSetDefault={saveDefaultView}
              onReturnToDefault={returnToDefaultView}
              canReturnToDefault={operationDefaultView !== null}
            />
          </Box>

          {openPanel && (
            <Box
              component="section"
              aria-labelledby="map-panel-title"
              className="map-panel"
            >
              <Group justify="space-between" wrap="nowrap" px="sm" py={6}>
                <Text id="map-panel-title" fw={600}>
                  {MAP_PANEL_LABEL[openPanel]}
                </Text>
                <CloseButton
                  aria-label="Schließen"
                  onClick={() => setOpenPanel(null)}
                />
              </Group>
              <Box className="map-panel__content" p="sm">
                {openPanel === "symbols" && (
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
                          <Group
                            key={row.id}
                            gap="xs"
                            wrap="nowrap"
                            className="panel-row"
                          >
                            <UnstyledButton
                              p={6}
                              onClick={() => jumpFromPanel(row.lat, row.lng)}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                borderRadius: "var(--mantine-radius-sm)",
                              }}
                            >
                              <Group gap="xs" wrap="nowrap">
                                <Image src={row.iconUrl} alt="" w={22} h={22} />
                                <Text
                                  size="sm"
                                  style={{ flex: 1, minWidth: 0 }}
                                  truncate
                                >
                                  {row.name}
                                </Text>
                                {row.stale ? (
                                  <Badge size="xs" color="orange">
                                    veraltet
                                  </Badge>
                                ) : row.device ? (
                                  <Badge size="xs" color="green">
                                    live
                                  </Badge>
                                ) : null}
                              </Group>
                            </UnstyledButton>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label={`${row.name} bearbeiten`}
                              onClick={() => setSelectedId(row.id)}
                            >
                              <IconPencil size={18} />
                            </ActionIcon>
                          </Group>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                )}
                {openPanel === "areas" && (
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
                          <Group
                            key={area.id}
                            gap="xs"
                            wrap="nowrap"
                            className="panel-row"
                          >
                            <UnstyledButton
                              p={6}
                              onClick={() => {
                                const center = areaCenter(area.geometry);
                                jumpFromPanel(center.lat, center.lng);
                              }}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                borderRadius: "var(--mantine-radius-sm)",
                              }}
                            >
                              <Group gap="xs" wrap="nowrap">
                                <Box
                                  w={14}
                                  h={14}
                                  style={{
                                    background: area.color,
                                    borderRadius: 3,
                                    flex: "none",
                                  }}
                                />
                                <Text
                                  size="sm"
                                  style={{ flex: 1, minWidth: 0 }}
                                  truncate
                                >
                                  {area.label || "Bereich"}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {SHAPE_LABEL[area.geometry.shape]}
                                </Text>
                              </Group>
                            </UnstyledButton>
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              aria-label={`${area.label || "Bereich"} bearbeiten`}
                              onClick={() => setSelectedAreaId(area.id)}
                            >
                              <IconPencil size={18} />
                            </ActionIcon>
                          </Group>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                )}
                {openPanel === "layers" && (
                  <Stack>
                    <KmlPanel
                      overlays={kmlViews}
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
                        overlays={imageItems}
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
                              onDelete={deleteImage}
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
            overflow: "auto",
            display: mainView === "map" ? "none" : undefined,
          }}
          py="sm"
        >
          <JournalPanel
            entries={journalEntries}
            onAdd={onAddJournalEntry}
            onCorrect={onCorrectJournalEntry}
            onAnnul={onAnnulJournalEntry}
          />
        </Box>

        <Modal
          opened={selectedArea !== null}
          onClose={() => {
            setSelectedAreaId(null);
            setAreaError(null);
          }}
          title="Bereich"
        >
          {selectedArea && (
            <AreaEditor
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
              onDelete={() => runArea(() => onDeleteArea(selectedArea.id))}
            />
          )}
        </Modal>

        <Modal
          opened={advancedOpened}
          onClose={advanced.close}
          title="Kartenzeichen zusammensetzen"
        >
          <AdvancedSymbolForm submitLabel="Platzieren" onSubmit={armAdvanced} />
        </Modal>

        <Modal
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
                onClick={() => runDetail(() => onDelete(selected.id))}
              >
                Löschen
              </Button>
              <DeviceLinkPanel
                token={selected.deviceLinkToken ?? null}
                positionSource={selected.positionSource ?? "manual"}
                reportedAt={selected.reportedAt ?? null}
                onGenerate={() => onGenerateDeviceLink(selected.id)}
              />
            </Stack>
          )}
        </Modal>
      </Stack>
    </LageansichtShell>
  );
}
