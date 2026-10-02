import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pdfToPng } from "pdf-to-png-converter";
import sharp from "sharp";
import { isUuid } from "@/server/db/uuid";
import { ValidationError } from "@/server/validation";
import type { UploadKind } from "./image-upload";

/**
 * Wurzelverzeichnis der Uploads. In Produktion das gemountete Docker-Volume
 * (per UPLOADS_DIR), im Dev ein lokales Verzeichnis. Die DB hält nur die Referenz.
 */
const uploadsDir = (): string =>
  process.env.UPLOADS_DIR ?? join(process.cwd(), "data", "uploads");

/** Längste Kante des gespeicherten Overlays; darüber wird verkleinert (fürs Feld). */
const MAX_EDGE_PX = 3000;

/**
 * Bereitet die Bildquelle eines Bild-Overlays fürs Feld auf: PDF wird
 * serverseitig gerendert (Seite 1), dann wird die Quelle auf höchstens
 * {@link MAX_EDGE_PX} verkleinert (nie hochskaliert) und als WebP kodiert.
 * Liefert das WebP samt seiner Maße. Der PDF→PNG-Renderer ist die dünne,
 * ungetestete Grenze.
 */
export async function prepareOverlayImage(
  kind: UploadKind,
  buffer: Buffer,
): Promise<{ webp: Buffer; width: number; height: number }> {
  const raster =
    kind === "pdf" ? await renderPdfFirstPageToPng(buffer) : buffer;
  try {
    const { data, info } = await sharp(raster)
      .resize({
        width: MAX_EDGE_PX,
        height: MAX_EDGE_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { webp: data, width: info.width, height: info.height };
  } catch {
    throw new ValidationError("Das Bild konnte nicht verarbeitet werden.");
  }
}

async function renderPdfFirstPageToPng(pdf: Buffer): Promise<Buffer> {
  // viewportScale hoch genug, dass typische Lagepläne (A4/A3) die Zielkante
  // erreichen; zu große Seiten verkleinert sharp anschließend ohnehin.
  const [page] = await pdfToPng(pdf, {
    pagesToProcess: [1],
    viewportScale: 3,
  });
  if (!page?.content)
    throw new ValidationError("Die PDF-Datei konnte nicht umgewandelt werden.");
  return page.content;
}

/** Schreibt das WebP ins Volume und gibt die relative DB-Referenz zurück. */
export async function storeOverlayImage(
  operationId: string,
  webp: Buffer,
): Promise<string> {
  const relPath = join(operationId, `${randomUUID()}.webp`);
  const absPath = join(uploadsDir(), relPath);
  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, webp);
  return relPath;
}

export async function readOverlayFile(relPath: string): Promise<Buffer> {
  return readFile(join(uploadsDir(), relPath));
}

/**
 * MIME-Typ eines gespeicherten Overlays anhand der Endung. Neue Overlays sind
 * WebP; ältere `.png`-Dateien (vor der Optimierung angelegt) bleiben ladbar.
 */
export function overlayContentType(relPath: string): string {
  return relPath.toLowerCase().endsWith(".png") ? "image/png" : "image/webp";
}

/**
 * Cache-Token fürs Client-Bild-URL. Der Dateiname (eine frische UUID je Upload)
 * wechselt beim „Datei ersetzen", die Overlay-id aber nicht – ohne dieses Token
 * bliebe die URL gleich und die Karte zeigte das alte Bild bis zum Neuladen.
 */
export function overlayCacheToken(relPath: string): string {
  return relPath.split(/[/\\]/).pop() ?? relPath;
}

/** Entfernt Overlay-Dateien aus dem Volume; das Einsatz-Verzeichnis bleibt. */
export async function deleteOverlayFiles(relPaths: string[]): Promise<void> {
  for (const relPath of relPaths) {
    await rm(join(uploadsDir(), relPath), { force: true });
  }
}

/** Entfernt das Upload-Verzeichnis eines Einsatzes samt Inhalt (beim Löschen des Einsatzes). */
export async function deleteOperationUploads(
  operationId: string,
): Promise<void> {
  // Rekursives rm: eine Nicht-UUID wie ".." oder "" träfe Verzeichnisse oberhalb.
  if (!isUuid(operationId))
    throw new Error(
      `Einsatz uploads not deleted, id is not a UUID: ${JSON.stringify(operationId)}`,
    );
  await rm(join(uploadsDir(), operationId), { recursive: true, force: true });
}
