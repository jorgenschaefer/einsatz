import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "@/server/validation";

// Der PDF→PNG-Renderer ist die dünne IO-Grenze; er wird für die PNG-Pfade
// nicht aufgerufen und hier nur gemockt, um den schweren Import zu vermeiden.
vi.mock("pdf-to-png-converter", () => ({ pdfToPng: vi.fn() }));

import {
  deleteOverlayFiles,
  overlayCacheToken,
  overlayContentType,
  prepareOverlayImage,
  readOverlayFile,
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
    const result = await prepareOverlayImage("png", await png(5000, 2500));
    expect(result).toMatchObject({ width: 3000, height: 1500 });
  });

  it("does not upscale an image that is already smaller", async () => {
    const result = await prepareOverlayImage("png", await png(400, 300));
    expect(result).toMatchObject({ width: 400, height: 300 });
  });

  it("rejects an unreadable image", async () => {
    await expect(
      prepareOverlayImage("png", Buffer.alloc(24)),
    ).rejects.toBeInstanceOf(ValidationError);
  });
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
  let dir: string;
  const originalUploadsDir = process.env.UPLOADS_DIR;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "einsatz-uploads-"));
    process.env.UPLOADS_DIR = dir;
  });

  afterEach(async () => {
    if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = originalUploadsDir;
    await rm(dir, { recursive: true, force: true });
  });

  it("stores an image under a per-Einsatz .webp path and reads the bytes back", async () => {
    const bytes = Buffer.from("webp-bytes");
    const relPath = await storeOverlayImage("op-1", bytes);
    expect(relPath).toMatch(/^op-1[/\\][0-9a-f-]+\.webp$/);
    expect(await readOverlayFile(relPath)).toEqual(bytes);
  });

  it("deletes overlay files and tolerates already-removed ones", async () => {
    const relPath = await storeOverlayImage("op-1", Buffer.from("x"));
    await deleteOverlayFiles([relPath]);
    await expect(readOverlayFile(relPath)).rejects.toThrow();
    await expect(deleteOverlayFiles([relPath])).resolves.toBeUndefined();
  });
});
