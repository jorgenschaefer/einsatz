import type {
  ReadOnlySituationMapData,
  TokenBasePath,
} from "@/map/ReadOnlySituationMap";
import { mapTileConfig } from "@/map/tiles";
import { listAreas } from "@/server/areas/areas";
import type { Db } from "@/server/db/db";
import { GEOCODER_ATTRIBUTION } from "@/server/geocoder/photon";
import { listImageOverlays } from "@/server/image-overlays/image-overlays";
import { overlayCacheToken } from "@/server/image-overlays/image-storage";
import { listKmlOverlays } from "@/server/kml/kml-overlays";
import { listMapSymbols } from "@/server/mapsymbols/map-symbols";
import { getOperation } from "@/server/operations/operations";

/**
 * Lädt die Lage eines Einsatzes für eine login-freie Kartenansicht (Geräte- und
 * Ansichtslink); Bild-Overlays werden über die token-gebundene Route
 * `${basePath}/${token}` ausgeliefert. Null, wenn es den Einsatz nicht (mehr) gibt.
 */
export async function loadReadOnlySituationMap(
  db: Db,
  operationId: string,
  basePath: TokenBasePath,
  token: string,
): Promise<ReadOnlySituationMapData | null> {
  const operation = await getOperation(db, operationId);
  if (!operation) return null;

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
      imageUrl: `${basePath}/${token}/overlays/${o.id}?v=${overlayCacheToken(o.filePath)}`,
      placement: o.placement,
      aspect: o.widthPx / o.heightPx,
      visible: o.visible,
    }),
  );
  const { tileUrl, attribution } = mapTileConfig();

  return {
    token,
    operationId: operation.id,
    operationDefaultView: operation.defaultView,
    tileUrl,
    attribution,
    symbols,
    areas,
    kmlOverlays,
    imageOverlays,
    geocoderAttribution: GEOCODER_ATTRIBUTION,
  };
}
