import { access, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { pdfToPng } from "pdf-to-png-converter";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/server/validation";
import { minimalPdf } from "@/test/minimal-pdf";
import { uploadsDirPerTest } from "@/test/uploads-dir";

// Der echte PDF→PNG-Renderer, damit die Kantenlängen real sind; nur ein Test
// ersetzt ihn, um einen unerwarteten Fehler des Renderers zu erzeugen.
vi.mock("pdf-to-png-converter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pdf-to-png-converter")>();
  return { pdfToPng: vi.fn(actual.pdfToPng) };
});

import {
  deleteOperationUploads,
  deleteOverlayFiles,
  overlayCacheToken,
  overlayContentType,
  pdfRenderScale,
  prepareOverlayImage,
  readOverlayFile,
  renderPdfFirstPageToPng,
  storeOverlayImage,
} from "./image-storage";

/** Erzeugt ein echtes PNG der gewünschten Maße (einfarbig). */
function png(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();
}

/**
 * Ein schwarzes 8-Bit-Graustufen-PNG, von Hand gebaut: Die Nullzeilen
 * komprimieren auf wenige hundert KB, auch bei 100 Megapixeln.
 */
function grayPng(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8); // Bittiefe
  header.writeUInt8(0, 9); // Graustufen
  const rows = Buffer.alloc((width + 1) * height); // je Zeile Filterbyte 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** WebP hat einen RIFF-Container mit "WEBP"-Kennung ab Byte 8. */
function isWebp(buffer: Buffer): boolean {
  return (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

describe("prepareOverlayImage", () => {
  it("optimizes a PNG to WebP and keeps dimensions within the cap", async () => {
    const result = await prepareOverlayImage("png", await png(800, 600));
    expect(isWebp(result.webp)).toBe(true);
    expect(result).toMatchObject({ width: 800, height: 600 });
  });

  it("downscales the longest edge to 3000 px, keeping the aspect ratio", async () => {
    const result = await prepareOverlayImage("png", await png(5000, 10));
    expect(result).toMatchObject({ width: 3000, height: 6 });
  });

  it("does not upscale an image that is already smaller", async () => {
    const result = await prepareOverlayImage("png", await png(400, 300));
    expect(result).toMatchObject({ width: 400, height: 300 });
  });

  it("prepares a PDF from its first page", async () => {
    const result = await prepareOverlayImage("pdf", minimalPdf(600, 300));
    expect(isWebp(result.webp)).toBe(true);
    expect(result).toMatchObject({ width: 1800, height: 900 });
  });

  it("rejects an unreadable image", async () => {
    await expect(
      prepareOverlayImage("png", Buffer.alloc(24)),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses a PNG over 100 megapixels", async () => {
    await expect(
      prepareOverlayImage("png", grayPng(10_001, 10_000)),
    ).rejects.toThrow(
      new ValidationError("Das Bild konnte nicht verarbeitet werden."),
    );
  });

  it("accepts a PNG of exactly 100 megapixels", async () => {
    const result = await prepareOverlayImage("png", grayPng(10_000, 10_000));
    expect(result).toMatchObject({ width: 3000, height: 3000 });
  });
});

describe("renderPdfFirstPageToPng", () => {
  afterEach(() => {
    vi.mocked(pdfToPng).mockReset();
  });

  it.each([
    ["A4", 595.28, 841.89],
    ["a non-round page", 2000.9, 1000.3],
    ["a huge non-round page", 200_000.7, 100_000.3],
    ["an elongated page", 400_000, 300],
    ["a page of exactly 4000:1", 4000, 1],
    ["a larger page of exactly 4000:1", 8000, 2],
  ])(
    "renders %s with its longer edge at 4000 px or less",
    async (_, widthPt, heightPt) => {
      const png = await renderPdfFirstPageToPng(minimalPdf(widthPt, heightPt));

      const { width = 0, height = 0 } = await sharp(png).metadata();
      expect(Math.max(width, height)).toBeLessThanOrEqual(4000);
      expect(Math.min(width, height)).toBeGreaterThanOrEqual(1);
    },
  );

  it("keeps the aspect ratio of a page too large to render at scale 1", async () => {
    const png = await renderPdfFirstPageToPng(minimalPdf(200_000, 100_000));

    const { width = 0, height = 1 } = await sharp(png).metadata();
    expect(width / height).toBeCloseTo(2, 2);
  });

  it("renders at no more than scale 3, even just below 4000/3 pt", async () => {
    const png = await renderPdfFirstPageToPng(minimalPdf(1333, 500));

    expect(await sharp(png).metadata()).toMatchObject({
      width: 3999,
      height: 1500,
    });
  });

  it.each([
    ["a page under 1 pt", 0.5, 0.5],
    ["a page just over 4000:1", 4001, 1],
    ["a page far over 4000:1", 40_000_000, 1],
  ])("refuses %s as not convertible", async (_, widthPt, heightPt) => {
    await expect(
      renderPdfFirstPageToPng(minimalPdf(widthPt, heightPt)),
    ).rejects.toThrow(
      new ValidationError("Die PDF-Datei konnte nicht umgewandelt werden."),
    );
  });

  it("lets an unexpected renderer failure through, so it gets logged", async () => {
    const canvasBroken = new Error("canvas broken");
    vi.mocked(pdfToPng).mockImplementation(async (_, options) => {
      if (options?.returnMetadataOnly)
        return [{ width: 600, height: 800 }] as Awaited<
          ReturnType<typeof pdfToPng>
        >;
      throw canvasBroken;
    });

    await expect(renderPdfFirstPageToPng(Buffer.from("pdf"))).rejects.toBe(
      canvasBroken,
    );
  });
});

describe("pdfRenderScale", () => {
  // Wie pdf-to-png-converter: gemessen wird die abgerundete Größe bei `scale`.
  const measured = (widthPt: number, heightPt: number, scale: number) => ({
    width: Math.floor(widthPt * scale),
    height: Math.floor(heightPt * scale),
    scale,
  });
  const renderedLongEdge = (widthPt: number, heightPt: number, scale: number) =>
    Math.floor(
      Math.max(widthPt, heightPt) *
        pdfRenderScale(measured(widthPt, heightPt, scale)),
    );

  it("renders a small page at scale 3", () => {
    expect(pdfRenderScale(measured(595.28, 841.89, 1))).toBe(3);
  });

  it.each([
    ["A0", 2383.94, 3370.39, 1],
    ["a non-round page", 2000.9, 1000.3, 1],
    ["a page exactly 4000/3 pt long", 4000 / 3, 500, 1],
    ["a huge page measured at 0.01", 200_000.7, 100_000.3, 0.01],
    ["an elongated page measured at 0.1", 400_000, 300, 0.1],
  ])(
    "keeps the longer edge of %s at 4000 px or just below",
    (_, widthPt, heightPt, scale) => {
      const edge = renderedLongEdge(widthPt, heightPt, scale);
      expect(edge).toBeLessThanOrEqual(4000);
      expect(edge).toBeGreaterThanOrEqual(3990);
    },
  );
});

describe("overlayContentType", () => {
  it("serves new WebP overlays as image/webp", () => {
    expect(overlayContentType("op-1/abc.webp")).toBe("image/webp");
  });

  it("still serves legacy PNG overlays as image/png", () => {
    expect(overlayContentType("op-1/legacy.png")).toBe("image/png");
  });
});

describe("overlayCacheToken", () => {
  it("changes when the file is replaced, so the client image URL refetches", () => {
    // Gleiche Overlay-id, aber neue Datei nach dem Ersetzen → neues Token.
    expect(overlayCacheToken("op-1/alt.webp")).not.toBe(
      overlayCacheToken("op-1/neu.webp"),
    );
  });

  it("is stable for the same stored file", () => {
    expect(overlayCacheToken("op-1/same.webp")).toBe(
      overlayCacheToken("op-1/same.webp"),
    );
  });
});

describe("overlay file storage", () => {
  const uploadsDir = uploadsDirPerTest();

  it("stores an image under a per-Einsatz .webp path and reads the bytes back", async () => {
    const bytes = Buffer.from("webp-bytes");
    const relPath = await storeOverlayImage(OPERATION_ID, bytes);
    expect(relPath).toMatch(
      new RegExp(`^${OPERATION_ID}[/\\\\][0-9a-f-]+\\.webp$`),
    );
    expect(await readOverlayFile(relPath)).toEqual(bytes);
  });

  it("deletes overlay files and tolerates already-removed ones", async () => {
    const relPath = await storeOverlayImage(OPERATION_ID, Buffer.from("x"));
    await deleteOverlayFiles([relPath]);
    await expect(readOverlayFile(relPath)).rejects.toThrow();
    await expect(deleteOverlayFiles([relPath])).resolves.toBeUndefined();
  });

  it("removes an Einsatz's upload directory along with its files", async () => {
    const relPath = await storeOverlayImage(OPERATION_ID, Buffer.from("x"));
    await deleteOperationUploads(OPERATION_ID);
    await expect(readOverlayFile(relPath)).rejects.toThrow();
    await expect(access(join(uploadsDir(), OPERATION_ID))).rejects.toThrow();
  });

  it("tolerates an Einsatz that never had an upload directory", async () => {
    await expect(deleteOperationUploads(OPERATION_ID)).resolves.toBeUndefined();
  });

  it("leaves another Einsatz's uploads untouched", async () => {
    const otherRelPath = await storeOverlayImage(
      OTHER_OPERATION_ID,
      Buffer.from("y"),
    );
    await storeOverlayImage(OPERATION_ID, Buffer.from("x"));
    await deleteOperationUploads(OPERATION_ID);
    expect(await readOverlayFile(otherRelPath)).toEqual(Buffer.from("y"));
  });

  it("keeps the Einsatz's upload directory when its only overlay file is deleted", async () => {
    const relPath = await storeOverlayImage(OPERATION_ID, Buffer.from("x"));
    await deleteOverlayFiles([relPath]);
    await expect(
      access(join(uploadsDir(), OPERATION_ID)),
    ).resolves.toBeUndefined();
  });

  it.each(["..", "../x", ""])(
    "refuses to store an image for the non-UUID id %j, creating nothing",
    async (operationId) => {
      const parent = dirname(uploadsDir());
      const before = await readdir(parent);
      await expect(
        storeOverlayImage(operationId, Buffer.from("x")),
      ).rejects.toThrow(`not a UUID: ${JSON.stringify(operationId)}`);
      expect(await readdir(parent)).toEqual(before);
      expect(await readdir(uploadsDir())).toEqual([]);
    },
  );

  it.each(["..", ""])(
    "refuses to delete uploads for the non-UUID id %j, leaving the uploads intact",
    async (operationId) => {
      const relPath = await storeOverlayImage(OPERATION_ID, Buffer.from("x"));
      await expect(deleteOperationUploads(operationId)).rejects.toThrow(
        `not a UUID: ${JSON.stringify(operationId)}`,
      );
      expect(await readOverlayFile(relPath)).toEqual(Buffer.from("x"));
    },
  );
});

const OPERATION_ID = "0b6f6a52-6c1e-4d55-9a57-1d2f4c3b8e01";
const OTHER_OPERATION_ID = "5d0c9e47-2a8b-4f13-b6d4-7e9a1c2f3b04";
