import { notFound } from "next/navigation";
import type { RenderedArea } from "@/map/SituationMap";
import {
  SituationWorkspace,
  type WorkspaceImageOverlay,
  type WorkspaceKmlOverlay,
  type WorkspaceSymbol,
} from "@/map/SituationWorkspace";
import { mapTileConfig } from "@/map/tiles";
import { listAreas } from "@/server/areas/areas";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { GEOCODER_ATTRIBUTION } from "@/server/geocoder/photon";
import { listImageOverlays } from "@/server/image-overlays/image-overlays";
import { overlayCacheToken } from "@/server/image-overlays/image-storage";
import { type JournalEntry, listEntries } from "@/server/journal/journal";
import { listKmlOverlays } from "@/server/kml/kml-overlays";
import { listMapSymbols } from "@/server/mapsymbols/map-symbols";
import { getOperation } from "@/server/operations/operations";
import { listStations } from "@/server/strength/stations";
import { listStrengthReports } from "@/server/strength/strength-reports";
import { listViewLinks } from "@/server/viewlinks/view-links";
import type { StationView } from "@/strength/StrengthPanel";
import { setDefaultViewAction } from "./actions";
import {
  createAreaAction,
  deleteAreaAction,
  updateAreaGeometryAction,
  updateAreaStyleAction,
} from "./area-actions";
import { geocodeAddressAction } from "./geocode-actions";
import {
  addImageOverlayAction,
  deleteImageOverlayAction,
  replaceImageOverlayFileAction,
  setImageOverlayVisibilityAction,
  updateImageOverlayPlacementAction,
} from "./image-overlay-actions";
import type { JournalEntryView } from "./JournalPanel";
import {
  addJournalEntryAction,
  annulEntryAction,
  correctEntryAction,
} from "./journal-actions";
import {
  addKmlFileAction,
  addKmlUrlAction,
  reloadKmlAction,
  removeKmlAction,
  setKmlVisibilityAction,
} from "./kml-actions";
import {
  deleteMapSymbolAction,
  generateDeviceLinkAction,
  moveMapSymbolAction,
  placeMapSymbolAction,
  updateMapSymbolCompositionAction,
} from "./map-symbol-actions";
import {
  createStationAction,
  recordStrengthReportAction,
  renameStationAction,
} from "./strength-actions";
import {
  createViewLinkAction,
  deleteViewLinkAction,
} from "./view-link-actions";

const toView = (entry: JournalEntry): JournalEntryView => ({
  id: entry.id,
  number: entry.number,
  createdAt: entry.createdAt.toISOString(),
  text: entry.text,
  type: entry.type,
  state: entry.state,
  author: entry.author,
  editedAt: entry.editedAt ? entry.editedAt.toISOString() : null,
  revisions: entry.revisions.map((r) => ({
    text: r.text,
    author: r.author,
    createdAt: r.createdAt.toISOString(),
  })),
});

export default async function LageansichtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const db = getDb();
  const operation = await getOperation(db, id);
  if (!operation) notFound();

  const entries = (await listEntries(db, operation.id)).map(toView);
  const symbols: WorkspaceSymbol[] = (
    await listMapSymbols(db, operation.id)
  ).map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    composition: s.composition,
    positionSource: s.positionSource,
    reportedAt: s.reportedAt,
    deviceLinkToken: s.deviceLinkToken,
  }));
  const areas: RenderedArea[] = (await listAreas(db, operation.id)).map(
    (a) => ({
      id: a.id,
      geometry: a.geometry,
      color: a.color,
      opacity: a.opacity,
      label: a.label,
    }),
  );
  const kmlOverlays: WorkspaceKmlOverlay[] = (
    await listKmlOverlays(db, operation.id)
  ).map((o) => ({
    id: o.id,
    name: o.name,
    sourceType: o.sourceType,
    visible: o.visible,
    content: o.content,
  }));
  const imageOverlays: WorkspaceImageOverlay[] = (
    await listImageOverlays(db, operation.id)
  ).map((o) => ({
    id: o.id,
    name: o.name,
    imageUrl: `/operations/${operation.id}/overlays/${o.id}?v=${overlayCacheToken(o.filePath)}`,
    placement: o.placement,
    aspect: o.widthPx / o.heightPx,
    visible: o.visible,
  }));
  const viewLinks = (await listViewLinks(db, operation.id)).map((l) => ({
    id: l.id,
    label: l.label,
    token: l.token,
  }));
  const reports = await listStrengthReports(db, operation.id);
  const stations: StationView[] = (await listStations(db, operation.id)).map(
    (s) => ({
      id: s.id,
      name: s.name,
      reports: reports
        .filter((r) => r.stationId === s.id)
        .map((r) => ({
          leaders: r.leaders,
          subLeaders: r.subLeaders,
          helpers: r.helpers,
          additionalPersonnel: r.additionalPersonnel,
          note: r.note,
          reportedAt: r.reportedAt.toISOString(),
          state: r.state,
          number: r.number,
        })),
    }),
  );
  const { tileUrl, attribution } = mapTileConfig();

  return (
    <SituationWorkspace
      operationId={operation.id}
      operationName={operation.name}
      status={operation.status}
      currentUsername={user.username}
      viewLinks={viewLinks}
      onCreateViewLink={createViewLinkAction.bind(null, operation.id)}
      onDeleteViewLink={deleteViewLinkAction.bind(null, operation.id)}
      operationDefaultView={operation.defaultView}
      tileUrl={tileUrl}
      attribution={attribution}
      symbols={symbols}
      journalEntries={entries}
      onAddJournalEntry={addJournalEntryAction.bind(null, operation.id)}
      onCorrectJournalEntry={correctEntryAction}
      onAnnulJournalEntry={annulEntryAction}
      onSetDefault={setDefaultViewAction.bind(null, operation.id)}
      onPlace={placeMapSymbolAction.bind(null, operation.id)}
      onMove={moveMapSymbolAction.bind(null, operation.id)}
      onUpdate={updateMapSymbolCompositionAction.bind(null, operation.id)}
      onDelete={deleteMapSymbolAction.bind(null, operation.id)}
      onGenerateDeviceLink={generateDeviceLinkAction.bind(null, operation.id)}
      onGeocode={geocodeAddressAction}
      geocoderAttribution={GEOCODER_ATTRIBUTION}
      areas={areas}
      onCreateArea={createAreaAction.bind(null, operation.id)}
      onUpdateAreaStyle={updateAreaStyleAction.bind(null, operation.id)}
      onUpdateAreaGeometry={updateAreaGeometryAction.bind(null, operation.id)}
      onDeleteArea={deleteAreaAction.bind(null, operation.id)}
      kmlOverlays={kmlOverlays}
      onAddKmlFile={addKmlFileAction.bind(null, operation.id)}
      onAddKmlUrl={addKmlUrlAction.bind(null, operation.id)}
      onSetKmlVisibility={setKmlVisibilityAction.bind(null, operation.id)}
      onReloadKml={reloadKmlAction.bind(null, operation.id)}
      onRemoveKml={removeKmlAction.bind(null, operation.id)}
      imageOverlays={imageOverlays}
      onAddImage={addImageOverlayAction.bind(null, operation.id)}
      onUpdateImagePlacement={updateImageOverlayPlacementAction.bind(
        null,
        operation.id,
      )}
      onReplaceImage={replaceImageOverlayFileAction.bind(null, operation.id)}
      onSetImageVisibility={setImageOverlayVisibilityAction.bind(
        null,
        operation.id,
      )}
      onDeleteImage={deleteImageOverlayAction.bind(null, operation.id)}
      stations={stations}
      onCreateStation={createStationAction.bind(null, operation.id)}
      onRenameStation={renameStationAction}
      onRecordStrengthReport={recordStrengthReportAction}
    />
  );
}
