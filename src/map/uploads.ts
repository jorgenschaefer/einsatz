import type { ActionResult } from "@/app/action-result";
import {
  IMAGE_EMBED_FAILED,
  KML_LOAD_FAILED,
} from "@/app/operations/[id]/upload-messages";
import type { ViewExtent } from "./view";

// Uploads laufen über Route Handler statt Server Actions: Diese prüfen die
// Sitzung, bevor sie den Body lesen, und lesen höchstens 21 MB.

/** Bindet eine (im Browser aus KMZ entpackte) KML-Datei als KML-Ebene ein. */
export function uploadKmlFile(
  operationId: string,
  name: string,
  content: string,
): Promise<ActionResult> {
  const form = new FormData();
  form.append("name", name);
  form.append("content", new Blob([content]), "karte.kml");
  return upload(
    `/operations/${operationId}/kml`,
    "POST",
    form,
    KML_LOAD_FAILED,
  );
}

/** Bindet eine PDF-/PNG-Datei als Bild-Overlay im Kartenausschnitt `view` ein. */
export function uploadImageOverlay(
  operationId: string,
  file: File,
  view: ViewExtent,
): Promise<ActionResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("view", JSON.stringify(view));
  return upload(
    `/operations/${operationId}/overlays`,
    "POST",
    form,
    IMAGE_EMBED_FAILED,
  );
}

/** Ersetzt die Datei eines Bild-Overlays. */
export function uploadReplacementImage(
  operationId: string,
  overlayId: string,
  file: File,
): Promise<ActionResult> {
  const form = new FormData();
  form.append("file", file);
  return upload(
    `/operations/${operationId}/overlays/${overlayId}`,
    "PUT",
    form,
    IMAGE_EMBED_FAILED,
  );
}

/**
 * Sendet das Formular und liest `{}` oder `{ error }` aus der Antwort. Ohne
 * Sitzung geht es zur Anmeldung, wie bei der Umleitung einer Server Action;
 * das Ergebnis bleibt dann aus.
 */
async function upload(
  url: string,
  method: "POST" | "PUT",
  form: FormData,
  fallback: string,
): Promise<ActionResult> {
  const response = await fetch(url, { method, body: form });
  if (response.status === 401) {
    location.assign("/login");
    return new Promise(() => {});
  }
  if (response.ok) return {};
  const body = await readJson(response);
  return { error: typeof body?.error === "string" ? body.error : fallback };
}

async function readJson(
  response: Response,
): Promise<{ error?: unknown } | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
