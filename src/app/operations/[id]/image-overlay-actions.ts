"use server";

import {
  defaultImagePlacement,
  type ImagePlacement,
} from "@/map/image-overlay";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import {
  createImageOverlay,
  deleteImageOverlay,
  getImageOverlay,
  replaceImageOverlayFile,
  setImageOverlayVisibility,
  updateImagePlacement,
} from "@/server/image-overlays/image-overlays";
import {
  deleteOverlayFiles,
  prepareOverlayImage,
  storeOverlayImage,
} from "@/server/image-overlays/image-storage";
import {
  classifyUpload,
  enforceUploadSize,
} from "@/server/image-overlays/image-upload";
import { getOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import {
  type ActionResult,
  operationAction,
  revalidateOperation,
  toFormError,
} from "./operation-action";

// Bild-Overlay-Actions haben ein eigenes Catch-all (PDF→PNG-Renderer,
// Datei-IO) plus Datei-Aufräumen, passen daher nicht in den `operationAction`-
// Helfer; sie nutzen aber dessen `revalidateOperation`/`toFormError`.
function toError(err: unknown): ActionResult {
  // Unerwartete Fehler (z. B. aus dem PDF→PNG-Renderer) serverseitig sichtbar
  // machen – der Nutzer bekommt nur die generische Meldung.
  if (!(err instanceof ValidationError)) {
    console.error("Bild-Overlay-Verarbeitung fehlgeschlagen:", err);
  }
  return toFormError(err, "Das Bild konnte nicht eingebunden werden.");
}

export async function addImageOverlayAction(
  operationId: string,
  file: File,
): Promise<ActionResult> {
  await requireUser();
  if (!(file instanceof File)) return { error: "Keine Datei ausgewählt." };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    enforceUploadSize(buffer.byteLength);
    const kind = classifyUpload(file.type, file.name);
    const { webp, width, height } = await prepareOverlayImage(kind, buffer);
    const db = getDb();
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
        placement: defaultImagePlacement(operation.defaultView ?? null),
      });
    } catch (err) {
      await deleteOverlayFiles([filePath]); // keine verwaisten Dateien im Volume
      throw err;
    }
    revalidateOperation(operationId);
    return {};
  } catch (err) {
    return toError(err);
  }
}

export async function replaceImageOverlayFileAction(
  operationId: string,
  id: string,
  file: File,
): Promise<ActionResult> {
  await requireUser();
  if (!(file instanceof File)) return { error: "Keine Datei ausgewählt." };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    enforceUploadSize(buffer.byteLength);
    const kind = classifyUpload(file.type, file.name);
    const { webp, width, height } = await prepareOverlayImage(kind, buffer);
    const db = getDb();
    const existing = await getImageOverlay(db, id);
    if (!existing)
      throw new ValidationError("Das Overlay existiert nicht mehr.");
    const filePath = await storeOverlayImage(operationId, webp);
    try {
      await replaceImageOverlayFile(db, id, {
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
    revalidateOperation(operationId);
    return {};
  } catch (err) {
    return toError(err);
  }
}

export async function updateImageOverlayPlacementAction(
  operationId: string,
  id: string,
  placement: ImagePlacement,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await updateImagePlacement(db, id, placement);
    return operationId;
  });
}

export async function setImageOverlayVisibilityAction(
  operationId: string,
  id: string,
  visible: boolean,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await setImageOverlayVisibility(db, id, visible);
    return operationId;
  });
}

export async function deleteImageOverlayAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    const overlay = await getImageOverlay(db, id);
    await deleteImageOverlay(db, id);
    if (overlay) await deleteOverlayFiles([overlay.filePath]);
    return operationId;
  });
}
