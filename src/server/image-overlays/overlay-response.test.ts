import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";

vi.mock("pdf-to-png-converter", () => ({ pdfToPng: vi.fn() }));

import {
  createImageOverlay,
  setImageOverlayVisibility,
} from "./image-overlays";
import { storeOverlayImage } from "./image-storage";
import { overlayImageResponse } from "./overlay-response";

const A_PLACEMENT = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 500,
  rotationDeg: 0,
  opacity: 1,
};

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

async function anOverlay() {
  const db = await freshDb();
  const op = await insertOperation(db, { name: "Lage", description: null });
  const filePath = await storeOverlayImage(op.id, Buffer.from("webp-bytes"));
  const overlay = await createImageOverlay(db, {
    operationId: op.id,
    filePath,
    name: "Plan",
    widthPx: 100,
    heightPx: 100,
    placement: A_PLACEMENT,
  });
  return { db, operationId: op.id, overlayId: overlay.id };
}

describe("overlayImageResponse", () => {
  it("serves the overlay's image uncached with its content type", async () => {
    const { db, operationId, overlayId } = await anOverlay();

    const res = await overlayImageResponse(db, overlayId, operationId);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("webp-bytes");
  });

  it("answers 404 for an overlay of another Einsatz", async () => {
    const { db, overlayId } = await anOverlay();
    const res = await overlayImageResponse(
      db,
      overlayId,
      "00000000-0000-0000-0000-000000000000",
    );
    expect(res.status).toBe(404);
  });

  it("answers 404 for an unknown overlay", async () => {
    const { db, operationId } = await anOverlay();
    const res = await overlayImageResponse(
      db,
      "00000000-0000-0000-0000-000000000000",
      operationId,
    );
    expect(res.status).toBe(404);
  });

  it("answers 404 for a hidden overlay when only visible ones may be served", async () => {
    const { db, operationId, overlayId } = await anOverlay();
    await setImageOverlayVisibility(db, operationId, overlayId, false);

    const res = await overlayImageResponse(db, overlayId, operationId, {
      visibleOnly: true,
    });

    expect(res.status).toBe(404);
  });

  it("serves a hidden overlay when visibility is not required", async () => {
    const { db, operationId, overlayId } = await anOverlay();
    await setImageOverlayVisibility(db, operationId, overlayId, false);

    const res = await overlayImageResponse(db, overlayId, operationId);

    expect(res.status).toBe(200);
  });
});
