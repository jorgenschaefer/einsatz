"use client";

import "./situation-workspace.css";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Image,
  Modal,
  Stack,
  Tabs,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconChevronLeft,
  IconChevronRight,
  IconHome,
  IconPencil,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ActionResult } from "@/app/operations/[id]/action-result";
import {
  type JournalEntryView,
  JournalPanel,
} from "@/app/operations/[id]/JournalPanel";
import type { GeoHit } from "@/server/geocoder/geocoder";
import type { KmlSourceType } from "@/server/kml/kml-overlays";
import type { PositionSource } from "@/server/mapsymbols/map-symbols";
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
} from "./SituationMap";
import { renderSymbolDataUrl } from "./tactical-symbol";
import { useMapFocus } from "./useMapFocus";
import { useMapMode } from "./useMapMode";
import { useMapSearch } from "./useMapSearch";
import { type LiveConnection, useOperationEvents } from "./useOperationEvents";
import { useStalenessClock } from "./useStalenessClock";
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

type TabId = "etb" | "symbols" | "areas" | "layers";

const PANEL_STYLE = { flex: 1, minHeight: 0, overflow: "auto" as const };

export function SituationWorkspace({
  operationId,
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
  const [tab, setTab] = useState<TabId>("etb");
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
  const [sidebarOpen, sidebar] = useDisclosure(true);
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
  // `{error}` über den `mapError`-Kanal. Nur die strukturell stets gültigen
  // Interaktionen bleiben bewusst fire-and-forget: onMove (Drag auf gültige
  // Koordinaten), onSetDefault (aktueller Ausschnitt) und onGenerateDeviceLink
  // (nur eine Objekt-id).
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

  const armAdvanced = (composition: SymbolComposition) => {
    armCustom(composition);
    advanced.close();
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
    setMapError(null);
    const { error } = await onPlace(composition, lat, lng);
    if (error) setMapError(error);
  };

  const handleDrawComplete = async (geometry: AreaGeometry) => {
    // Ein etwaiger {error} wird hier bewusst nicht angezeigt: die gezeichnete
    // Geometrie ist immer wohlgeformt, es gibt kein Panel für diesen Fluss, und
    // der Modus muss in jedem Fall enden.
    if (redrawAreaId) {
      await onUpdateAreaGeometry(redrawAreaId, geometry);
    } else {
      await onCreateArea(geometry);
    }
    resetMode();
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
  const startRedraw = () => {
    if (!selectedArea) return;
    redraw(selectedArea.geometry.shape, selectedArea.id);
    setSelectedAreaId(null);
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
  };
  const stopEditImage = () => {
    setImageError(null);
    resetMode();
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
      else stopEditImage();
    } finally {
      setImageBusy(false);
    }
  };

  return (
    <Stack gap={0} h="100%">
      {!connected && (
        <Alert color="orange" radius={0} py="xs" role="status">
          Verbindung getrennt – wird automatisch wiederhergestellt.
        </Alert>
      )}
      {mapError && (
        <Alert
          color="red"
          radius={0}
          py="xs"
          role="alert"
          withCloseButton
          onClose={() => setMapError(null)}
        >
          {mapError}
        </Alert>
      )}

      <Group
        gap={0}
        wrap="nowrap"
        align="stretch"
        style={{ flex: 1, minHeight: 0 }}
      >
        <Box
          style={{
            flex: 1,
            minWidth: 0,
            position: "relative",
            isolation: "isolate",
          }}
        >
          <SituationMap
            operationId={operationId}
            operationDefaultView={operationDefaultView}
            tileUrl={tileUrl}
            attribution={attribution}
            onSetDefault={onSetDefault}
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
          <Box
            pos="absolute"
            top={12}
            left={12}
            style={{ zIndex: 1100, width: 340, maxWidth: "calc(100% - 24px)" }}
          >
            <SearchBar
              query={searchQuery}
              onQueryChange={setSearchQuery}
              objectResults={objectResults}
              addressResults={addressResults}
              attribution={geocoderAttribution}
              onJump={jumpTo}
            />
          </Box>
          <ActionIcon
            variant="default"
            size="lg"
            pos="absolute"
            top="50%"
            right={12}
            aria-label={
              sidebarOpen
                ? "Seitenleiste einklappen"
                : "Seitenleiste ausklappen"
            }
            aria-expanded={sidebarOpen}
            onClick={sidebar.toggle}
            style={{ zIndex: 1100, transform: "translateY(-50%)" }}
          >
            {sidebarOpen ? (
              <IconChevronRight size={18} />
            ) : (
              <IconChevronLeft size={18} />
            )}
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="lg"
            pos="absolute"
            bottom={16}
            right={16}
            aria-label="Zum Standard-Ausschnitt zurück"
            disabled={!operationDefaultView}
            onClick={returnToDefaultView}
            style={{ zIndex: 1100, boxShadow: "var(--mantine-shadow-md)" }}
          >
            <IconHome size={18} />
          </ActionIcon>
        </Box>

        {sidebarOpen && (
          <Box
            w={360}
            style={{
              borderLeft: "1px solid var(--mantine-color-default-border)",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <Tabs
              value={tab}
              onChange={(value) => setTab((value as TabId) ?? "etb")}
              keepMounted={false}
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
              }}
            >
              <Tabs.List
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                }}
              >
                <Tabs.Tab value="etb">Einsatztagebuch</Tabs.Tab>
                <Tabs.Tab value="symbols">Kartenzeichen</Tabs.Tab>
                <Tabs.Tab value="areas">Bereiche</Tabs.Tab>
                <Tabs.Tab value="layers">Ebenen</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="etb" p="sm" style={PANEL_STYLE}>
                <JournalPanel
                  entries={journalEntries}
                  onAdd={onAddJournalEntry}
                  onCorrect={onCorrectJournalEntry}
                  onAnnul={onAnnulJournalEntry}
                />
              </Tabs.Panel>

              <Tabs.Panel value="symbols" p="sm" style={PANEL_STYLE}>
                <Stack gap="sm">
                  <Group gap="xs" align="flex-start">
                    <QuickSelectToolbar
                      items={toolbarItems}
                      armedId={armedQuickId}
                      onArm={armQuick}
                    />
                    <Button size="xs" variant="light" onClick={advanced.open}>
                      Erweitert …
                    </Button>
                  </Group>
                  {symbolRows.length === 0 ? (
                    <Text c="dimmed" size="sm">
                      Noch keine Kartenzeichen. Zeichen wählen und auf die Karte
                      tippen.
                    </Text>
                  ) : (
                    <Stack gap={4}>
                      {symbolRows.map((row) => (
                        <Group
                          key={row.id}
                          gap="xs"
                          wrap="nowrap"
                          className="sidebar-row"
                        >
                          <UnstyledButton
                            p={6}
                            onClick={() => jumpTo(row.lat, row.lng)}
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
              </Tabs.Panel>

              <Tabs.Panel value="areas" p="sm" style={PANEL_STYLE}>
                <Stack gap="sm">
                  <Group gap="xs">
                    {AREA_SHAPES.map(({ shape, label }) => (
                      <Button
                        key={shape}
                        size="xs"
                        variant={drawShape === shape ? "filled" : "default"}
                        aria-pressed={drawShape === shape}
                        onClick={() => toggleDraw(shape)}
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
                          className="sidebar-row"
                        >
                          <UnstyledButton
                            p={6}
                            onClick={() => {
                              const center = areaCenter(area.geometry);
                              jumpTo(center.lat, center.lng);
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
              </Tabs.Panel>

              <Tabs.Panel value="layers" p="sm" style={PANEL_STYLE}>
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
                            onDone={stopEditImage}
                            busy={imageBusy}
                            error={imageError}
                          />
                        )
                      }
                    />
                  </Stack>
                </Stack>
              </Tabs.Panel>
            </Tabs>
          </Box>
        )}
      </Group>

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
            busy={areaBusy}
            error={areaError}
            onSave={(style) =>
              runArea(() => onUpdateAreaStyle(selectedArea.id, style))
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
  );
}
