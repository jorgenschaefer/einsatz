"use server";

import type { ActionResult } from "@/app/action-result";
import { loadKmlFromUrl } from "@/server/kml/kml-import";
import {
  createKmlOverlay,
  deleteKmlOverlay,
  reloadKmlOverlay,
  setKmlVisibility,
} from "@/server/kml/kml-overlays";
import { assertText, ValidationError } from "@/server/validation";
import { operationAction } from "./operation-action";
import { KML_LOAD_FAILED } from "./upload-messages";

const MAX_KML_URL_LENGTH = 2000;

export async function addKmlUrlAction(
  operationId: string,
  name: string,
  url: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    assertText(url, "Die KML-URL", MAX_KML_URL_LENGTH);
    const source = url.trim();
    if (!source) throw new ValidationError("Bitte eine KML-URL angeben.");
    const content = await loadKmlFromUrl(source);
    await createKmlOverlay(db, {
      operationId,
      sourceType: "url",
      sourceUrl: source,
      name,
      content,
    });
    return operationId;
  }, KML_LOAD_FAILED);
}

export async function setKmlVisibilityAction(
  operationId: string,
  id: string,
  visible: boolean,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await setKmlVisibility(db, operationId, id, visible);
    return operationId;
  });
}

export async function reloadKmlAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await reloadKmlOverlay(db, operationId, id, loadKmlFromUrl);
    return operationId;
  }, KML_LOAD_FAILED);
}

export async function removeKmlAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  return operationAction(async (db) => {
    await deleteKmlOverlay(db, operationId, id);
    return operationId;
  });
}
