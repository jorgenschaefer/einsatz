import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";
import {
  insertOperation,
  setDefaultView,
} from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import { snapshotDbAndUploads } from "@/test/db-snapshot";
import { minimalPdf } from "@/test/minimal-pdf";
import {
  addImageOverlay,
  replaceImageOverlayImage,
} from "./image-overlay-uploads";
import * as repo from "./image-overlays";
import {
  createImageOverlay,
  getImageOverlay,
  type ImageOverlay,
  listImageOverlays,
} from "./image-overlays";
import { storeOverlayImage } from "./image-storage";

const A_VIEW = { lat: 53.55, lng: 9.99, widthM: 4000, heightM: 3000 };

const A_PLACEMENT = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 500,
  rotationDeg: 30,
  opacity: 0.8,
};

const NAME_TOO_LONG = "Der Dateiname darf höchstens 200 Zeichen lang sein.";

let db: Db;
let dir: string;
let operationId: string;
const originalUploadsDir = process.env.UPLOADS_DIR;

beforeEach(async () => {
  db = await freshDb();
  operationId = (await anOperation("Lage")).id;
  // Eigenes Elternverzeichnis, damit „nichts daneben angelegt" prüfbar ist.
  const parent = await mkdtemp(join(tmpdir(), "einsatz-image-uploads-"));
  dir = join(parent, "uploads");
  await mkdir(dir);
  process.env.UPLOADS_DIR = dir;
});

afterEach(async () => {
  if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = originalUploadsDir;
  await rm(dirname(dir), { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("addImageOverlay", () => {
  const add = (file: File, view: unknown, id = operationId) =>
    addImageOverlay(db, { operationId: id, file, view });

  it("places the image in the uploader's view, not the Einsatz's default view", async () => {
    await setDefaultView(db, operationId, { lat: 48, lng: 11, zoom: 9 });

    await add(await pngFile(600, 300), A_VIEW);

    const [overlay] = await listImageOverlays(db, operationId);
    expect(overlay.placement).toMatchObject({
      centerLat: 53.55,
      centerLng: 9.99,
      scaleM: 2000,
    });
  });

  it("stores a PDF upload under the file's name, with its prepared size", async () => {
    const pdf = new File([new Uint8Array(minimalPdf(600, 300))], "plan.pdf", {
      type: "application/pdf",
    });

    await add(pdf, A_VIEW);

    const [overlay] = await listImageOverlays(db, operationId);
    expect(overlay).toMatchObject({
      name: "plan.pdf",
      widthPx: 1800,
      heightPx: 900,
    });
    expect(await filesUnderUploads()).toEqual([overlay.filePath]);
  });

  it.each([
    ["no view", undefined],
    ["a view of null", null],
    ["a width of zero", { ...A_VIEW, widthM: 0 }],
    ["a negative height", { ...A_VIEW, heightM: -1 }],
    ["an infinite width", { ...A_VIEW, widthM: Number.POSITIVE_INFINITY }],
    ["a latitude that is not a number", { ...A_VIEW, lat: Number.NaN }],
    ["a latitude beyond the pole", { ...A_VIEW, lat: 90.1 }],
    ["a longitude beyond the date line", { ...A_VIEW, lng: -180.1 }],
    ["a width given as text", { ...A_VIEW, widthM: "4000" }],
  ])("rejects %s and stores nothing", async (_, view) => {
    const before = await snapshotDbAndUploads(db, dir);

    await expect(add(await pngFile(600, 300), view)).rejects.toThrow(
      new ValidationError("Der Kartenausschnitt ist ungültig."),
    );

    expect(await snapshotDbAndUploads(db, dir)).toEqual(before);
  });

  it("accepts a view centred on the date line", async () => {
    await add(await pngFile(600, 300), { ...A_VIEW, lng: 180 });

    expect(await listImageOverlays(db, operationId)).toHaveLength(1);
  });

  it("refuses a file name of 201 characters and stores nothing", async () => {
    const before = await snapshotDbAndUploads(db, dir);

    await expect(
      add(await pngFile(600, 300, `${"x".repeat(197)}.png`), A_VIEW),
    ).rejects.toThrow(new ValidationError(NAME_TOO_LONG));

    expect(await snapshotDbAndUploads(db, dir)).toEqual(before);
  });

  it("stores no file and no row for an image that cannot be prepared", async () => {
    const before = await snapshotDbAndUploads(db, dir);

    await expect(add(aBrokenPng(), A_VIEW)).rejects.toThrow(
      new ValidationError("Das Bild konnte nicht verarbeitet werden."),
    );

    expect(await snapshotDbAndUploads(db, dir)).toEqual(before);
  });

  it("refuses an Einsatz-ID that is not a UUID and stores nothing", async () => {
    const before = await snapshotDbAndUploads(db, dir);

    await expect(add(await pngFile(600, 300), A_VIEW, "op-1")).rejects.toThrow(
      new ValidationError("Ungültige ID."),
    );

    expect(await snapshotDbAndUploads(db, dir)).toEqual(before);
  });

  it("stores nothing for an Einsatz that no longer exists", async () => {
    const before = await snapshotDbAndUploads(db, dir);

    await expect(
      add(await pngFile(600, 300), A_VIEW, randomUUID()),
    ).rejects.toThrow(new ValidationError("Der Einsatz existiert nicht mehr."));

    expect(await snapshotDbAndUploads(db, dir)).toEqual(before);
  });

  it("leaves no file behind when the database insert fails", async () => {
    const dbDown = new Error("db down");
    vi.spyOn(repo, "createImageOverlay").mockRejectedValueOnce(dbDown);

    await expect(add(await pngFile(600, 300), A_VIEW)).rejects.toBe(dbDown);

    expect(await filesUnderUploads()).toEqual([]);
  });
});

describe("replaceImageOverlayImage", () => {
  let overlay: ImageOverlay;

  beforeEach(async () => {
    overlay = await createImageOverlay(db, {
      operationId,
      filePath: await storeOverlayImage(operationId, Buffer.from("alt")),
      name: "Alt",
      widthPx: 1000,
      heightPx: 1000,
      placement: A_PLACEMENT,
    });
  });

  const replace = (file: File, id = operationId) =>
    replaceImageOverlayImage(db, {
      operationId: id,
      overlayId: overlay.id,
      file,
    });

  it("keeps the placement, updates file+dimensions, and deletes the old file", async () => {
    await replace(await pngFile(600, 300));

    const updated = await getImageOverlay(db, overlay.id);
    expect(updated).toMatchObject({
      placement: A_PLACEMENT,
      name: "neu.png",
      widthPx: 600,
      heightPx: 300,
    });
    expect(updated?.filePath).not.toBe(overlay.filePath);
    expect(await filesUnderUploads()).toEqual([updated?.filePath]);
  });

  it("leaves the overlay untouched when the file cannot be processed", async () => {
    await expect(replace(aBrokenPng())).rejects.toThrow(ValidationError);

    expect(await getImageOverlay(db, overlay.id)).toEqual(overlay);
    expect(await filesUnderUploads()).toEqual([overlay.filePath]);
  });

  it("does not orphan the new file when the database update fails", async () => {
    const dbDown = new Error("db down");
    vi.spyOn(repo, "replaceImageOverlayFile").mockRejectedValueOnce(dbDown);

    await expect(replace(await pngFile(600, 300))).rejects.toBe(dbDown);

    expect(await filesUnderUploads()).toEqual([overlay.filePath]);
  });

  it("refuses a file name of 201 characters and changes nothing", async () => {
    const before = await snapshotDbAndUploads(db, dir);

    await expect(
      replace(await pngFile(600, 300, `${"x".repeat(197)}.png`)),
    ).rejects.toThrow(new ValidationError(NAME_TOO_LONG));

    expect(await snapshotDbAndUploads(db, dir)).toEqual(before);
  });

  it("refuses a Bild-Overlay of another Einsatz before preparing the file and changes nothing", async () => {
    const other = await anOperation("B");
    const before = await snapshotDbAndUploads(db, dir);

    await expect(replace(aBrokenPng(), other.id)).rejects.toThrow(
      new ValidationError("Bild-Overlay nicht gefunden."),
    );

    expect(await snapshotDbAndUploads(db, dir)).toEqual(before);
  });

  it("creates nothing outside the uploads directory for an Einsatz-ID like ../escape", async () => {
    const before = await readdir(dirname(dir));

    await expect(replace(await pngFile(600, 300), "../escape")).rejects.toThrow(
      new ValidationError("Ungültige ID."),
    );

    expect(await readdir(dirname(dir))).toEqual(before);
    const files = await filesUnderUploads();
    expect(files.every((file) => file.startsWith(`${operationId}${sep}`))).toBe(
      true,
    );
  });
});

function anOperation(name: string) {
  return insertOperation(db, { name, description: null });
}

function pngFile(
  width: number,
  height: number,
  name = "neu.png",
): Promise<File> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .png()
    .toBuffer()
    .then(
      (buf) => new File([new Uint8Array(buf)], name, { type: "image/png" }),
    );
}

function aBrokenPng(): File {
  return new File([new Uint8Array([1, 2, 3])], "kaputt.png", {
    type: "image/png",
  });
}

/** Alle Dateien unter dem Upload-Verzeichnis, relativ dazu. */
async function filesUnderUploads(): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)));
}
