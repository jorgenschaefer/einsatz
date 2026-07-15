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
//
// Zugehörigkeit (flaches Trust-Modell): Diese Kind-Objekt-Actions mutieren über
// die vom Client gelieferte Objekt-`id`, ohne zu prüfen, dass das Objekt zu
// `operationId` gehört (`operationId` dient hier nur Revalidate/Live-Event). Das
// ist bewusst unkritisch, solange jeder angemeldete Nutzer jeden Einsatz
// bearbeiten darf; es ist zugleich der Ansatzpunkt für eine künftige
// Per-Einsatz-Autorisierung: dann hier vor der Mutation die Zugehörigkeit prüfen.
function toError(err: unknown, fallback: string): ActionResult {
  // Unerwartete Fehler (z. B. aus dem PDF→PNG-Renderer oder dem Datei-IO)
  // serverseitig sichtbar machen – der Nutzer bekommt nur `fallback`.
  if (!(err instanceof ValidationError)) {
    console.error("Bild-Overlay-Verarbeitung fehlgeschlagen:", err);
  }
  return toFormError(err, fallback);
}

const EMBED_FAILED = "Das Bild konnte nicht eingebunden werden.";
const DELETE_FAILED = "Das Bild-Overlay konnte nicht gelöscht werden.";

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
    return toError(err, EMBED_FAILED);
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
    return toError(err, EMBED_FAILED);
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
        console.error("Overlay-Datei konnte nicht aufgeräumt werden:", err);
      }
    }
    return {};
  } catch (err) {
    return toError(err, DELETE_FAILED);
  }
}
