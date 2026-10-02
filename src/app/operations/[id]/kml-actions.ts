"use server";

import type { ActionResult } from "@/app/action-result";
import {
  assertKmlDocument,
  enforceKmlSizeLimit,
  fetchKmlFromUrl,
  resolveKmlNetworkLinks,
} from "@/server/kml/kml-fetch";
import {
  createKmlOverlay,
  deleteKmlOverlay,
  reloadKmlOverlay,
  setKmlVisibility,
} from "@/server/kml/kml-overlays";
import { ValidationError } from "@/server/validation";
import { operationAction } from "./operation-action";

const LOAD_FAILED = "KML konnte nicht geladen werden.";

// Zur Objekt-Zugehörigkeit (flaches Trust-Modell) siehe `operationAction`.
export async function addKmlFileAction(
  operationId: string,
  name: string,
  content: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    enforceKmlSizeLimit(content);
    assertKmlDocument(content, "Die Datei ist keine KML- oder KMZ-Datei.");
    // KMZ-Dateien aus Google „Meine Karten“ enthalten oft nur einen
    // NetworkLink; dessen Ziel serverseitig auflösen, damit Geometrie erscheint.
    const resolved = await resolveKmlNetworkLinks(content);
    enforceKmlSizeLimit(resolved);
    await createKmlOverlay(db, {
      operationId,
      sourceType: "file",
      sourceUrl: null,
      name: name.trim() || "KML-Datei",
      content: resolved,
    });
    return operationId;
  }, LOAD_FAILED);
}

export async function addKmlUrlAction(
  operationId: string,
  name: string,
  url: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    const source = url.trim();
    if (!source) throw new ValidationError("Bitte eine KML-URL angeben.");
    const content = await fetchKmlFromUrl(source);
    await createKmlOverlay(db, {
      operationId,
      sourceType: "url",
      sourceUrl: source,
      name: name.trim() || source,
      content,
    });
    return operationId;
  }, LOAD_FAILED);
}

export async function setKmlVisibilityAction(
  operationId: string,
  id: string,
  visible: boolean,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await setKmlVisibility(db, id, visible);
    return operationId;
  });
}

export async function reloadKmlAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await reloadKmlOverlay(db, id, fetchKmlFromUrl);
    return operationId;
  }, LOAD_FAILED);
}

export async function removeKmlAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await deleteKmlOverlay(db, id);
    return operationId;
  });
}
