"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db/pg";
import { publishOperationChanged } from "@/server/events/operation-events";
import { enforceKmlSizeLimit, fetchKmlFromUrl } from "@/server/kml/kml-fetch";
import {
  createKmlOverlay,
  deleteKmlOverlay,
  reloadKmlOverlay,
  setKmlVisibility,
} from "@/server/kml/kml-overlays";
import { ValidationError } from "@/server/validation";

interface Result {
  error?: string;
}

const revalidate = (operationId: string) => {
  revalidatePath(`/operations/${operationId}`);
  publishOperationChanged(operationId);
};

/** Übersetzt einen Fehler in eine nutzerlesbare Meldung fürs Panel. */
function toError(err: unknown): Result {
  if (err instanceof ValidationError) return { error: err.message };
  return { error: "KML konnte nicht geladen werden." };
}

export async function addKmlFileAction(
  operationId: string,
  name: string,
  content: string,
): Promise<Result> {
  await requireUser();
  try {
    enforceKmlSizeLimit(content);
    await createKmlOverlay(getDb(), {
      operationId,
      sourceType: "file",
      sourceUrl: null,
      name: name.trim() || "KML-Datei",
      content,
    });
    revalidate(operationId);
    return {};
  } catch (err) {
    return toError(err);
  }
}

export async function addKmlUrlAction(
  operationId: string,
  name: string,
  url: string,
): Promise<Result> {
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
    revalidate(operationId);
    return {};
  } catch (err) {
    return toError(err);
  }
}

export async function toggleKmlVisibilityAction(
  operationId: string,
  id: string,
  visible: boolean,
): Promise<Result> {
  await requireUser();
  await setKmlVisibility(getDb(), id, visible);
  revalidate(operationId);
  return {};
}

export async function reloadKmlAction(
  operationId: string,
  id: string,
): Promise<Result> {
  await requireUser();
  try {
    await reloadKmlOverlay(getDb(), id, fetchKmlFromUrl);
    revalidate(operationId);
    return {};
  } catch (err) {
    return toError(err);
  }
}

export async function removeKmlAction(
  operationId: string,
  id: string,
): Promise<Result> {
  await requireUser();
  await deleteKmlOverlay(getDb(), id);
  revalidate(operationId);
  return {};
}
