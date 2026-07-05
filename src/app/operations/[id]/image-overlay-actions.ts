"use server";

import { revalidatePath } from "next/cache";
import {
  defaultImagePlacement,
  type ImagePlacement,
} from "@/map/image-overlay";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { publishOperationChanged } from "@/server/events/operation-events";
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

interface Result {
  error?: string;
}

const revalidate = (operationId: string) => {
  revalidatePath(`/operations/${operationId}`);
  publishOperationChanged(operationId);
};

function toError(err: unknown): Result {
  if (err instanceof ValidationError) return { error: err.message };
  // Unerwartete Fehler (z. B. aus dem PDF→PNG-Renderer) serverseitig sichtbar
  // machen – der Nutzer bekommt nur die generische Meldung.
  console.error("Bild-Overlay-Verarbeitung fehlgeschlagen:", err);
  return { error: "Das Bild konnte nicht eingebunden werden." };
}

export async function addImageOverlayAction(
  operationId: string,
  file: File,
): Promise<Result> {
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
    revalidate(operationId);
    return {};
  } catch (err) {
    return toError(err);
  }
}

export async function replaceImageOverlayFileAction(
  operationId: string,
  id: string,
  file: File,
): Promise<Result> {
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
    revalidate(operationId);
    return {};
  } catch (err) {
    return toError(err);
  }
}

export async function updateImageOverlayPlacementAction(
  operationId: string,
  id: string,
  placement: ImagePlacement,
): Promise<Result> {
  await requireUser();
  await updateImagePlacement(getDb(), id, placement);
  revalidate(operationId);
  return {};
}

export async function toggleImageOverlayVisibilityAction(
  operationId: string,
  id: string,
  visible: boolean,
): Promise<Result> {
  await requireUser();
  await setImageOverlayVisibility(getDb(), id, visible);
  revalidate(operationId);
  return {};
}

export async function deleteImageOverlayAction(
  operationId: string,
  id: string,
): Promise<Result> {
  await requireUser();
  const db = getDb();
  const overlay = await getImageOverlay(db, id);
  await deleteImageOverlay(db, id);
  if (overlay) await deleteOverlayFiles([overlay.filePath]);
  revalidate(operationId);
  return {};
}
