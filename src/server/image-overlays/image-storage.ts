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

/** Größere Bilder werden abgelehnt statt dekodiert (Speicher). */
const MAX_INPUT_PIXELS = 100_000_000;

/**
 * Bereitet die Bildquelle eines Bild-Overlays fürs Feld auf: PDF wird
 * serverseitig gerendert (Seite 1), dann wird die Quelle auf höchstens
 * {@link MAX_EDGE_PX} verkleinert (nie hochskaliert) und als WebP kodiert.
 * Liefert das WebP samt seiner Maße.
 */
export async function prepareOverlayImage(
  kind: UploadKind,
  buffer: Buffer,
): Promise<{ webp: Buffer; width: number; height: number }> {
  const raster =
    kind === "pdf" ? await renderPdfFirstPageToPng(buffer) : buffer;
  try {
    const { data, info } = await sharp(raster, {
      limitInputPixels: MAX_INPUT_PIXELS,
    })
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

const PDF_NOT_CONVERTED = "Die PDF-Datei konnte nicht umgewandelt werden.";

/**
 * Rendert die erste PDF-Seite so, dass ihre längere Kante höchstens
 * {@link PDF_MAX_EDGE_PX} misst, bis zu einer Kante von etwa 10¹⁰ pt (dem
 * kleinsten {@link PROBE_SCALES}). Abgelehnt wird eine Seite, die dabei unter
 * 1 px schmal würde, und eine, von der eine Kante unter 1 pt misst.
 */
export async function renderPdfFirstPageToPng(pdf: Buffer): Promise<Buffer> {
  const viewportScale = await chooseRenderScale(
    pdf,
    await measurePdfFirstPage(pdf),
  );
  const [page] = await pdfToPng(pdf, { pagesToProcess: [1], viewportScale });
  if (!page?.content) throw new ValidationError(PDF_NOT_CONVERTED);
  return page.content;
}

/** Obergrenze der längeren Kante beim Rendern einer PDF-Seite. */
const PDF_MAX_EDGE_PX = 4000;

/** Hoch genug, dass typische Lagepläne (A4/A3) die Zielkante erreichen. */
const PDF_MAX_SCALE = 3;

/**
 * Messmaßstäbe, vom größten zum kleinsten: Eine riesige Seite überschreitet
 * bei 1 die Pixelgrenze des Renderers, eine schmale fällt bei zu kleinem
 * Maßstab auf 0 px. Der erste Maßstab, bei dem beides nicht passiert, misst.
 */
const PROBE_SCALES = [1, 0.1, 0.01, 0.001, 1e-4, 1e-5, 1e-6];

type MeasuredPage = { width: number; height: number; scale: number };

async function measurePdfFirstPage(pdf: Buffer): Promise<MeasuredPage> {
  for (const scale of PROBE_SCALES) {
    const size = await pageSizeAt(pdf, scale);
    if (size) return { ...size, scale };
  }
  throw new ValidationError(PDF_NOT_CONVERTED);
}

/**
 * Der Maßstab aus der gemessenen Größe trifft {@link PDF_MAX_EDGE_PX} genau,
 * kann wegen des Abrundens aber 1 px darüber liegen; dann gilt der sichere
 * {@link pdfRenderScale}. Ohne den genauen Versuch fiele eine Seite von genau
 * 4000:1 auf unter 1 px Breite. Passt keiner, wird die Seite abgelehnt.
 */
async function chooseRenderScale(
  pdf: Buffer,
  page: MeasuredPage,
): Promise<number> {
  const exactScale = Math.min(
    PDF_MAX_SCALE,
    (PDF_MAX_EDGE_PX * page.scale) / Math.max(page.width, page.height),
  );
  if (await rendersWithinMaxEdge(pdf, exactScale)) return exactScale;
  const safeScale = pdfRenderScale(page);
  if (await rendersWithinMaxEdge(pdf, safeScale)) return safeScale;
  throw new ValidationError(PDF_NOT_CONVERTED);
}

async function rendersWithinMaxEdge(
  pdf: Buffer,
  scale: number,
): Promise<boolean> {
  const size = await pageSizeAt(pdf, scale);
  return size !== null && Math.max(size.width, size.height) <= PDF_MAX_EDGE_PX;
}

/**
 * Render-Maßstab für eine gemessene Seite. Gemessen wird abgerundet, die
 * wahre Kante ist also kürzer als `(gemessen + 1) / scale`; mit dieser oberen
 * Schranke gerechnet bleibt die gerenderte Kante sicher bei höchstens
 * {@link PDF_MAX_EDGE_PX}.
 */
export function pdfRenderScale(page: MeasuredPage): number {
  const longEdgeUpperBoundPt =
    (Math.max(page.width, page.height) + 1) / page.scale;
  return Math.min(PDF_MAX_SCALE, PDF_MAX_EDGE_PX / longEdgeUpperBoundPt);
}

/**
 * Pixelgröße der ersten Seite bei `scale`, ohne zu rendern – abgerundet wie
 * beim Rendern. `null`, wenn der Renderer die Seite bei diesem Maßstab ablehnt
 * (zu viele Pixel oder eine Kante bei 0 px).
 */
async function pageSizeAt(
  pdf: Buffer,
  scale: number,
): Promise<{ width: number; height: number } | null> {
  try {
    const [page] = await pdfToPng(pdf, {
      pagesToProcess: [1],
      returnMetadataOnly: true,
      viewportScale: scale,
    });
    return page ? { width: page.width, height: page.height } : null;
  } catch {
    return null;
  }
}

/** Schreibt das WebP ins Volume und gibt die relative DB-Referenz zurück. */
export async function storeOverlayImage(
  operationId: string,
  webp: Buffer,
): Promise<string> {
  // Eine Nicht-UUID wie "../x" legte Verzeichnisse außerhalb der Uploads an.
  if (!isUuid(operationId))
    throw new Error(
      `Overlay image not stored, Einsatz id is not a UUID: ${JSON.stringify(operationId)}`,
    );
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
