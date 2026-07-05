import { ValidationError } from "@/server/validation";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

/** Deckelt Uploads bei 20 MB pro Datei. */
export function enforceUploadSize(bytes: number): void {
  if (bytes > MAX_UPLOAD_BYTES) {
    throw new ValidationError("Die Datei ist größer als 20 MB.");
  }
}

export type UploadKind = "png" | "pdf";

/** Lässt nur PDF und PNG zu (per Content-Type oder Dateiendung); alles andere wird abgelehnt. */
export function classifyUpload(
  contentType: string,
  filename: string,
): UploadKind {
  const ct = contentType.toLowerCase();
  const name = filename.toLowerCase();
  if (ct === "image/png" || name.endsWith(".png")) return "png";
  if (ct === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  throw new ValidationError("Nur PDF- oder PNG-Dateien werden unterstützt.");
}
