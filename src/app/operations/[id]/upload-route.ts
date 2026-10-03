import "server-only";
import { MAX_KML_BYTES } from "@/kml/kmz";
import { getCurrentUser } from "@/server/auth/current-user";
import type { Db } from "@/server/db/db";
import { getDb } from "@/server/db/pg";
import { BodyTooLargeError, readBody } from "@/server/http/read-body";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_TOO_LARGE,
} from "@/server/image-overlays/image-upload";
import { ValidationError } from "@/server/validation";
import { changeOperation } from "./operation-action";
import { IMAGE_EMBED_FAILED } from "./upload-messages";

/** Die größte Datei plus Luft für den Multipart-Rahmen und die übrigen Felder. */
const MAX_UPLOAD_REQUEST_BYTES =
  Math.max(MAX_KML_BYTES, MAX_UPLOAD_BYTES) + 1024 * 1024;

/**
 * Gemeinsamer Ablauf der Upload-Routen (KML-Datei, Bild-Overlay hinzufügen und
 * ersetzen): prüft Herkunft und Sitzung, bevor ein Byte gelesen wird, zählt
 * den Upload als Nutzung der Sitzung, liest den Body höchstens bis 1 MB über
 * der Dateigrenze, führt `run` wie eine Einsatz-Action aus und antwortet mit
 * `{}` oder `{ error }`. Ohne Sitzung 401 statt einer Umleitung, weil `fetch`
 * einer Umleitung samt Body folgen würde.
 */
export async function handleUpload(
  request: Request,
  messages: { tooLarge: string; failed: string },
  run: (db: Db, form: FormData) => Promise<string>,
): Promise<Response> {
  if (!isSameOrigin(request.headers)) {
    return new Response(null, { status: 403 });
  }
  if (!(await getCurrentUser({ recordUse: true }))) {
    return new Response(null, { status: 401 });
  }

  let form: FormData;
  try {
    form = await readForm(request);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return Response.json({ error: messages.tooLarge }, { status: 413 });
    }
    // Abgebrochene Übertragung oder kein lesbares Formular.
    return Response.json({ error: messages.failed }, { status: 400 });
  }

  const db = getDb();
  const { error, unexpected } = await changeOperation(
    () => run(db, form),
    messages.failed,
  );
  if (error === undefined) return Response.json({});
  return Response.json({ error }, { status: unexpected ? 500 : 400 });
}

/** Meldungen der beiden Bild-Overlay-Routen (hinzufügen und ersetzen). */
export const IMAGE_UPLOAD_MESSAGES = {
  tooLarge: UPLOAD_TOO_LARGE,
  failed: IMAGE_EMBED_FAILED,
};

/** Die hochgeladene Datei im Feld `file`. */
export function formFile(form: FormData): File {
  const file = form.get("file");
  if (file === null || typeof file === "string") {
    throw new ValidationError("Keine Datei ausgewählt.");
  }
  return file;
}

/** Ein als JSON gesendetes Feld; `undefined`, wenn es fehlt oder kein JSON ist. */
export function formJson(form: FormData, name: string): unknown {
  const value = form.get(name);
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Dieselbe Regel, mit der Next Server Actions vor CSRF schützt: Schickt der
 * Browser ein `Origin`, muss dessen Host der Host der App sein (hinter dem
 * Reverse Proxy `X-Forwarded-Host`). Das Sitzungs-Cookie (`SameSite=Lax`)
 * reist auch von Nachbar-Hosts derselben Domain mit.
 */
function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  if (origin === null) return true; // kein Browser, also kein fremdes Cookie
  const host =
    headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    headers.get("host");
  return URL.parse(origin)?.host === host;
}

async function readForm(request: Request): Promise<FormData> {
  const bytes = await readBody(request, MAX_UPLOAD_REQUEST_BYTES);
  return new Response(bytes, {
    headers: { "content-type": request.headers.get("content-type") ?? "" },
  }).formData();
}
