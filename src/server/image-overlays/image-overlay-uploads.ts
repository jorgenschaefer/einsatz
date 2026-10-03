import { defaultImagePlacement } from "@/map/image-overlay";
import type { ViewExtent } from "@/map/view";
import type { Queryable } from "@/server/db/db";
import { getOperation } from "@/server/operations/operations";
import { isValidLatLng, ValidationError } from "@/server/validation";
import {
  createImageOverlay,
  getImageOverlay,
  replaceImageOverlayFile,
} from "./image-overlays";
import {
  deleteOverlayFiles,
  prepareOverlayImage,
  storeOverlayImage,
} from "./image-storage";
import { classifyUpload, enforceUploadSize } from "./image-upload";

/**
 * Bindet eine PDF-/PNG-Datei als Bild-Overlay ein, mittig im Kartenausschnitt
 * `view` des Hochladenden.
 */
export async function addImageOverlay(
  db: Queryable,
  input: { operationId: string; file: File; view: unknown },
): Promise<void> {
  const { operationId, file, view } = input;
  assertViewExtent(view);
  const { webp, width, height } = await prepareUpload(file);
  const operation = await getOperation(db, operationId);
  if (!operation) {
    // Vor dem Schreiben ins Volume abbrechen – keine verwaiste Datei/Zeile.
    throw new ValidationError("Der Einsatz existiert nicht mehr.");
  }
  const filePath = await storeOverlayImage(operationId, webp);
  try {
    await createImageOverlay(db, {
      operationId,
      filePath,
      name: file.name,
      widthPx: width,
      heightPx: height,
      placement: defaultImagePlacement(view, width / height),
    });
  } catch (err) {
    await deleteOverlayFiles([filePath]); // keine verwaisten Dateien im Volume
    throw err;
  }
}

/**
 * Ersetzt die Datei eines Bild-Overlays; die Platzierung bleibt. Die Datei
 * landet im Einsatz des Overlays, dessen ID zurückkommt.
 */
export async function replaceImageOverlayImage(
  db: Queryable,
  input: { overlayId: string; file: File },
): Promise<string> {
  const { overlayId, file } = input;
  const { webp, width, height } = await prepareUpload(file);
  const existing = await getImageOverlay(db, overlayId);
  if (!existing) throw new ValidationError("Das Overlay existiert nicht mehr.");
  const filePath = await storeOverlayImage(existing.operationId, webp);
  try {
    await replaceImageOverlayFile(db, overlayId, {
      filePath,
      name: file.name,
      widthPx: width,
      heightPx: height,
    });
  } catch (err) {
    await deleteOverlayFiles([filePath]); // keine verwaiste neue Datei
    throw err;
  }
  await deleteOverlayFiles([existing.filePath]); // alte Version entfernen
  return existing.operationId;
}

function assertViewExtent(view: unknown): asserts view is ViewExtent {
  const extent = view as Partial<ViewExtent> | null;
  const valid =
    typeof view === "object" &&
    extent !== null &&
    isValidLatLng(extent.lat, extent.lng) &&
    isPositiveLength(extent.widthM) &&
    isPositiveLength(extent.heightM);
  if (!valid) throw new ValidationError("Der Kartenausschnitt ist ungültig.");
}

const isPositiveLength = (m: unknown): boolean =>
  typeof m === "number" && Number.isFinite(m) && m > 0;

/** Prüft eine hochgeladene PDF-/PNG-Datei und bereitet sie als WebP auf. */
async function prepareUpload(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  enforceUploadSize(buffer.byteLength);
  return prepareOverlayImage(classifyUpload(file.type, file.name), buffer);
}
