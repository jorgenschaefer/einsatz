"use server";

import type { ActionResult } from "@/app/action-result";
import type { ImagePlacement } from "@/map/image-overlay";
import {
  deleteImageOverlay,
  getImageOverlay,
  setImageOverlayVisibility,
  updateImagePlacement,
} from "@/server/image-overlays/image-overlays";
import { deleteOverlayFiles } from "@/server/image-overlays/image-storage";
import { operationAction } from "./operation-action";

const DELETE_FAILED = "Das Bild-Overlay konnte nicht gelöscht werden.";

// Zur Objekt-Zugehörigkeit (flaches Trust-Modell) siehe `operationAction`.
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
