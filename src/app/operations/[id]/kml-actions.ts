"use server";

import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import {
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
import {
  type ActionResult,
  revalidateOperation,
  toFormError,
} from "./operation-action";

// KML-Actions haben ein eigenes Catch-all (Netzwerk-/Parse-Fehler → freundliche
// Meldung), passen daher nicht in den `operationAction`-Helfer; sie nutzen aber
// dessen `revalidateOperation`/`toFormError` und teilen `requireUser`.
export async function addKmlFileAction(
  operationId: string,
  name: string,
  content: string,
): Promise<ActionResult> {
  await requireUser();
  try {
    enforceKmlSizeLimit(content);
    // KMZ-Dateien aus Google „Meine Karten“ enthalten oft nur einen
    // NetworkLink; dessen Ziel serverseitig auflösen, damit Geometrie erscheint.
    const resolved = await resolveKmlNetworkLinks(content);
    enforceKmlSizeLimit(resolved);
    await createKmlOverlay(getDb(), {
      operationId,
      sourceType: "file",
      sourceUrl: null,
      name: name.trim() || "KML-Datei",
      content: resolved,
    });
    revalidateOperation(operationId);
    return {};
  } catch (err) {
    return toFormError(err, "KML konnte nicht geladen werden.");
  }
}

export async function addKmlUrlAction(
  operationId: string,
  name: string,
  url: string,
): Promise<ActionResult> {
  await requireUser();
  const source = url.trim();
  if (!source) return { error: "Bitte eine KML-URL angeben." };
  try {
    const content = await fetchKmlFromUrl(source);
    await createKmlOverlay(getDb(), {
      operationId,
      sourceType: "url",
      sourceUrl: source,
      name: name.trim() || source,
      content,
    });
    revalidateOperation(operationId);
    return {};
  } catch (err) {
    return toFormError(err, "KML konnte nicht geladen werden.");
  }
}

export async function toggleKmlVisibilityAction(
  operationId: string,
  id: string,
  visible: boolean,
): Promise<ActionResult> {
  await requireUser();
  await setKmlVisibility(getDb(), id, visible);
  revalidateOperation(operationId);
  return {};
}

export async function reloadKmlAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  await requireUser();
  try {
    await reloadKmlOverlay(getDb(), id, fetchKmlFromUrl);
    revalidateOperation(operationId);
    return {};
  } catch (err) {
    return toFormError(err, "KML konnte nicht geladen werden.");
  }
}

export async function removeKmlAction(
  operationId: string,
  id: string,
): Promise<ActionResult> {
  await requireUser();
  await deleteKmlOverlay(getDb(), id);
  revalidateOperation(operationId);
  return {};
}
