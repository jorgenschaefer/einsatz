import { randomUUID } from "node:crypto";
import type { ImagePlacement } from "@/map/image-overlay";
import type { Queryable } from "@/server/db/db";
import { isUuid } from "@/server/db/uuid";
import {
  assertLatLng,
  assertOpacity,
  assertScale,
  ValidationError,
} from "@/server/validation";

export const IMAGE_OVERLAY_NOT_FOUND = "Bild-Overlay nicht gefunden.";

export interface ImageOverlay {
  id: string;
  operationId: string;
  filePath: string;
  name: string;
  widthPx: number;
  heightPx: number;
  placement: ImagePlacement;
  visible: boolean;
}

interface ImageRow {
  id: string;
  operation_id: string;
  file_path: string;
  name: string;
  width_px: number;
  height_px: number;
  center_lat: number;
  center_lng: number;
  scale_m: number;
  rotation_deg: number;
  opacity: number;
  visible: boolean;
}

const toOverlay = (row: ImageRow): ImageOverlay => ({
  id: row.id,
  operationId: row.operation_id,
  filePath: row.file_path,
  name: row.name,
  widthPx: row.width_px,
  heightPx: row.height_px,
  placement: {
    centerLat: row.center_lat,
    centerLng: row.center_lng,
    scaleM: row.scale_m,
    rotationDeg: row.rotation_deg,
    opacity: row.opacity,
  },
  visible: row.visible,
});

const COLUMNS =
  "id, operation_id, file_path, name, width_px, height_px, center_lat, center_lng, scale_m, rotation_deg, opacity, visible";

/**
 * Prüft eine Overlay-Platzierung wie ihre Geschwister (createArea/createMapSymbol):
 * gültige Koordinaten, Deckkraft 0–1, positive Skalierung, endliche Drehung.
 * `rotationDeg` wird nicht normalisiert – endliche Werte außerhalb 0–360 sind erlaubt.
 */
function assertPlacement(placement: ImagePlacement): void {
  assertLatLng(placement.centerLat, placement.centerLng);
  assertOpacity(placement.opacity);
  assertScale(placement.scaleM);
  if (!Number.isFinite(placement.rotationDeg)) {
    throw new ValidationError("Die Drehung muss eine endliche Zahl sein.");
  }
}

export async function createImageOverlay(
  db: Queryable,
  input: {
    operationId: string;
    filePath: string;
    name: string;
    widthPx: number;
    heightPx: number;
    placement: ImagePlacement;
  },
): Promise<ImageOverlay> {
  const p = input.placement;
  assertPlacement(p);
  const { rows } = await db.query<ImageRow>(
    `INSERT INTO image_overlays
       (id, operation_id, file_path, name, width_px, height_px, center_lat, center_lng, scale_m, rotation_deg, opacity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${COLUMNS}`,
    [
      randomUUID(),
      input.operationId,
      input.filePath,
      input.name,
      input.widthPx,
      input.heightPx,
      p.centerLat,
      p.centerLng,
      p.scaleM,
      p.rotationDeg,
      p.opacity,
    ],
  );
  return toOverlay(rows[0]);
}

export async function listImageOverlays(
  db: Queryable,
  operationId: string,
): Promise<ImageOverlay[]> {
  const { rows } = await db.query<ImageRow>(
    `SELECT ${COLUMNS} FROM image_overlays WHERE operation_id = $1 ORDER BY created_at ASC`,
    [operationId],
  );
  return rows.map(toOverlay);
}

export async function getImageOverlay(
  db: Queryable,
  id: string,
): Promise<ImageOverlay | null> {
  if (!isUuid(id)) return null;
  const { rows } = await db.query<ImageRow>(
    `SELECT ${COLUMNS} FROM image_overlays WHERE id = $1`,
    [id],
  );
  return rows[0] ? toOverlay(rows[0]) : null;
}

export async function updateImagePlacement(
  db: Queryable,
  operationId: string,
  id: string,
  placement: ImagePlacement,
): Promise<void> {
  assertPlacement(placement);
  const { rows } = await db.query(
    "UPDATE image_overlays SET center_lat = $3, center_lng = $4, scale_m = $5, rotation_deg = $6, opacity = $7 WHERE operation_id = $1 AND id = $2 RETURNING id",
    [
      operationId,
      id,
      placement.centerLat,
      placement.centerLng,
      placement.scaleM,
      placement.rotationDeg,
      placement.opacity,
    ],
  );
  assertFound(rows);
}

/**
 * Ersetzt die Bildquelle eines Overlays (neue Datei/Version) und lässt die
 * Platzierung, Deckkraft und Sichtbarkeit unberührt.
 */
export async function replaceImageOverlayFile(
  db: Queryable,
  operationId: string,
  id: string,
  file: { filePath: string; name: string; widthPx: number; heightPx: number },
): Promise<void> {
  const { rows } = await db.query(
    "UPDATE image_overlays SET file_path = $3, name = $4, width_px = $5, height_px = $6 WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id, file.filePath, file.name, file.widthPx, file.heightPx],
  );
  assertFound(rows);
}

export async function setImageOverlayVisibility(
  db: Queryable,
  operationId: string,
  id: string,
  visible: boolean,
): Promise<void> {
  const { rows } = await db.query(
    "UPDATE image_overlays SET visible = $3 WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id, visible],
  );
  assertFound(rows);
}

/** Löscht ein Bild-Overlay und liefert seine Datei, die der Aufrufer aufräumt. */
export async function deleteImageOverlay(
  db: Queryable,
  operationId: string,
  id: string,
): Promise<{ filePath: string }> {
  const { rows } = await db.query<{ file_path: string }>(
    "DELETE FROM image_overlays WHERE operation_id = $1 AND id = $2 RETURNING file_path",
    [operationId, id],
  );
  assertFound(rows);
  return { filePath: rows[0].file_path };
}

/** Kein Bild-Overlay dieser ID im genannten Einsatz – nie dort gewesen oder schon gelöscht. */
function assertFound(rows: unknown[]): void {
  if (rows.length === 0) throw new ValidationError(IMAGE_OVERLAY_NOT_FOUND);
}
