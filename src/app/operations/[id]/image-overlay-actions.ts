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

const EMBED_FAILED = "Das Bild konnte nicht eingebunden werden.";
const DELETE_FAILED = "Das Bild-Overlay konnte nicht gelöscht werden.";

// Zur Objekt-Zugehörigkeit (flaches Trust-Modell) siehe `operationAction`.
export async function addImageOverlayAction(
  operationId: string,
  file: File,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    if (!(file instanceof File))
      throw new ValidationError("Keine Datei ausgewählt.");
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
        placement: defaultImagePlacement(operation.defaultView ?? null),
      });
    } catch (err) {
      await deleteOverlayFiles([filePath]); // keine verwaisten Dateien im Volume
      throw err;
    }
    return operationId;
  }, EMBED_FAILED);
}

export async function replaceImageOverlayFileAction(
  operationId: string,
  id: string,
  file: File,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    if (!(file instanceof File))
      throw new ValidationError("Keine Datei ausgewählt.");
    const { webp, width, height } = await prepareUpload(file);
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
    return operationId;
  }, EMBED_FAILED);
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
  // Nicht über `operationAction`: das Datei-Aufräumen (Datei-IO) kann scheitern,
  // nachdem die Zeile schon gelöscht ist. Sobald die Zeile weg ist, ist die
  // Löschung vollzogen – ab da wird immer revalidiert (sonst rendert das
  // gelöschte Overlay bei allen Clients weiter), und ein reiner Aufräum-Fehler
  // (verwaiste Datei im Volume) ist Server-Hygiene, kein Nutzerfehler.
  await requireUser();
  try {
    const db = getDb();
    const overlay = await getImageOverlay(db, id);
    await deleteImageOverlay(db, id);
    revalidateOperation(operationId);
    if (overlay) {
      try {
        await deleteOverlayFiles([overlay.filePath]);
      } catch (err) {
        // Pfad mitloggen, damit die verwaiste Datei im Volume auffindbar bleibt.
        console.error(
          `Overlay-Datei konnte nicht aufgeräumt werden (${overlay.filePath}):`,
          err,
        );
      }
    }
    return {};
  } catch (err) {
    return toError(err, DELETE_FAILED);
  }
}

function toError(err: unknown, fallback: string): ActionResult {
  // Unerwartete Fehler (z. B. aus dem Datei-IO) serverseitig sichtbar machen –
  // der Nutzer bekommt nur `fallback`.
  if (!(err instanceof ValidationError)) {
    console.error("Bild-Overlay-Verarbeitung fehlgeschlagen:", err);
  }
  return toFormError(err, fallback);
}

/** Prüft eine hochgeladene PDF-/PNG-Datei und bereitet sie als WebP auf. */
async function prepareUpload(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  enforceUploadSize(buffer.byteLength);
  return prepareOverlayImage(classifyUpload(file.type, file.name), buffer);
}
