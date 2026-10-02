"use server";

import type { ActionResult } from "@/app/action-result";
import {
  defaultImagePlacement,
  type ImagePlacement,
} from "@/map/image-overlay";
import type { ViewExtent } from "@/map/view";
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
import { isValidLatLng, ValidationError } from "@/server/validation";
import { operationAction } from "./operation-action";

const EMBED_FAILED = "Das Bild konnte nicht eingebunden werden.";
const DELETE_FAILED = "Das Bild-Overlay konnte nicht gelöscht werden.";

// Zur Objekt-Zugehörigkeit (flaches Trust-Modell) siehe `operationAction`.
export async function addImageOverlayAction(
  operationId: string,
  file: File,
  view: ViewExtent,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    if (!(file instanceof File))
      throw new ValidationError("Keine Datei ausgewählt.");
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

// Ist die Zeile gelöscht, ist die Löschung vollzogen: Ein Fehler beim
// Aufräumen der Datei (verwaiste Datei im Volume) ist Server-Hygiene, kein
// Nutzerfehler. Er darf `run` nicht verlassen, sonst würde nicht revalidiert
// und das gelöschte Overlay bei allen Clients weiter gerendert.
export async function deleteImageOverlayAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    const overlay = await getImageOverlay(db, id);
    await deleteImageOverlay(db, id);
    if (overlay) await cleanUpOverlayFile(overlay.filePath);
    return operationId;
  }, DELETE_FAILED);
}

async function cleanUpOverlayFile(filePath: string): Promise<void> {
  try {
    await deleteOverlayFiles([filePath]);
  } catch (err) {
    // Pfad mitloggen, damit die verwaiste Datei im Volume auffindbar bleibt.
    console.error(
      `Overlay-Datei konnte nicht aufgeräumt werden (${filePath}):`,
      err,
    );
  }
}

function assertViewExtent(view: ViewExtent): void {
  const valid =
    typeof view === "object" &&
    view !== null &&
    isValidLatLng(view.lat, view.lng) &&
    isPositiveLength(view.widthM) &&
    isPositiveLength(view.heightM);
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
