import { DeviceClosed } from "@/map/DeviceClosed";
import { DeviceView } from "@/map/DeviceView";
import { mapTileConfig } from "@/map/tiles";
import { listAreas } from "@/server/areas/areas";
import { getDb } from "@/server/db/pg";
import { GEOCODER_ATTRIBUTION } from "@/server/geocoder/photon";
import { listImageOverlays } from "@/server/image-overlays/image-overlays";
import { overlayCacheToken } from "@/server/image-overlays/image-storage";
import { listKmlOverlays } from "@/server/kml/kml-overlays";
import {
  listMapSymbols,
  resolveDeviceAccess,
} from "@/server/mapsymbols/map-symbols";
import { getOperation } from "@/server/operations/operations";

export default async function DevicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  const access = await resolveDeviceAccess(db, token);
  if (!access) return <DeviceClosed />;
  const operation = await getOperation(db, access.operationId);
  if (!operation) return <DeviceClosed />;

  const symbols = (await listMapSymbols(db, operation.id)).map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    composition: s.composition,
    positionSource: s.positionSource,
    reportedAt: s.reportedAt,
  }));
  const areas = (await listAreas(db, operation.id)).map((a) => ({
    id: a.id,
    geometry: a.geometry,
    color: a.color,
    opacity: a.opacity,
    label: a.label,
  }));
  const kmlOverlays = (await listKmlOverlays(db, operation.id)).map((o) => ({
    id: o.id,
    content: o.content,
    visible: o.visible,
  }));
  const imageOverlays = (await listImageOverlays(db, operation.id)).map(
    (o) => ({
      id: o.id,
      imageUrl: `/device/${token}/overlays/${o.id}?v=${overlayCacheToken(o.filePath)}`,
      placement: o.placement,
      aspect: o.widthPx / o.heightPx,
      visible: o.visible,
    }),
  );
  const { tileUrl, attribution } = mapTileConfig();

  return (
    <DeviceView
      token={token}
      operationId={operation.id}
      operationDefaultView={operation.defaultView}
      tileUrl={tileUrl}
      attribution={attribution}
      symbols={symbols}
      areas={areas}
      kmlOverlays={kmlOverlays}
      imageOverlays={imageOverlays}
      geocoderAttribution={GEOCODER_ATTRIBUTION}
    />
  );
}
