import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Routen-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
  revalidatePath: vi.fn(),
  publishOperationChanged: vi.fn(),
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => state.revalidatePath(p),
}));
vi.mock("@/server/events/operation-events", () => ({
  publishOperationChanged: (id: string) => state.publishOperationChanged(id),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));

import * as repo from "@/server/image-overlays/image-overlays";
import { listImageOverlays } from "@/server/image-overlays/image-overlays";
import {
  insertOperation,
  setDefaultView,
} from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { minimalPdf } from "@/test/minimal-pdf";
import { signIn } from "@/test/sign-in";
import { multipartRequest, routeParams } from "@/test/upload-request";
import { POST } from "./route";

const EMBED_FAILED = "Das Bild konnte nicht eingebunden werden.";

const A_VIEW = { lat: 53.55, lng: 9.99, widthM: 4000, heightM: 3000 };

/** Sendet `file` und `view` wie der Browser; ohne `view` fehlt das Feld. */
async function postImageOverlay(
  operationId: string,
  file: File | string,
  view?: unknown,
): Promise<ActionResult> {
  const form = new FormData();
  form.append("file", file);
  if (view !== undefined) form.append("view", JSON.stringify(view));
  const response = await POST(
    await multipartRequest("POST", form),
    routeParams({ id: operationId }),
  );
  return response.json();
}

async function login(): Promise<void> {
  state.token = await signIn(state.db as Db);
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

function pdfFile(widthPt: number, heightPt: number): File {
  return new File([new Uint8Array(minimalPdf(widthPt, heightPt))], "plan.pdf", {
    type: "application/pdf",
  });
}

/**
 * Ein schwarzes 8-Bit-Graustufen-PNG, von Hand gebaut: Die Nullzeilen
 * komprimieren auf wenige hundert KB, auch bei 100 Megapixeln.
 */
function grayPngFile(width: number, height: number): File {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8); // Bittiefe
  header.writeUInt8(0, 9); // Graustufen
  const rows = Buffer.alloc((width + 1) * height); // je Zeile Filterbyte 0
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return new File([new Uint8Array(png)], "gross.png", { type: "image/png" });
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

async function anOperation(name: string) {
  return insertOperation(state.db as Db, { name, description: null });
}

/** Alle Dateien unter dem Upload-Verzeichnis, relativ dazu. */
async function filesUnderUploads(): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)));
}

let dir: string;
const originalUploadsDir = process.env.UPLOADS_DIR;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
  state.revalidatePath.mockReset();
  state.publishOperationChanged.mockReset();
  const parent = await mkdtemp(join(tmpdir(), "einsatz-add-image-"));
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

describe("POST /operations/[id]/overlays", () => {
  it("embeds the image as a new overlay of the Einsatz", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });

    const result = await postImageOverlay(
      op.id,
      await pngFile(600, 300),
      A_VIEW,
    );

    expect(result).toEqual({});
    expect(await listImageOverlays(state.db as Db, op.id)).toMatchObject([
      { name: "neu.png", widthPx: 600, heightPx: 300 },
    ]);
    expect(state.publishOperationChanged).toHaveBeenCalledWith(op.id);
  });

  it("centers a landscape image on the uploader's view at half its width", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });
    await setDefaultView(state.db as Db, op.id, { lat: 48, lng: 11, zoom: 9 });

    await postImageOverlay(op.id, await pngFile(600, 300), {
      lat: 53.55,
      lng: 9.99,
      widthM: 4000,
      heightM: 3000,
    });

    const [overlay] = await listImageOverlays(state.db as Db, op.id);
    expect(overlay.placement).toMatchObject({
      centerLat: 53.55,
      centerLng: 9.99,
      scaleM: 2000,
    });
  });

  it("sizes a portrait image to half the height of the uploader's view", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });

    await postImageOverlay(op.id, await pngFile(300, 600), {
      lat: 53.55,
      lng: 9.99,
      widthM: 4000,
      heightM: 1000,
    });

    const [overlay] = await listImageOverlays(state.db as Db, op.id);
    expect(overlay.placement.scaleM).toBe(250);
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
  ])("rejects %s and creates nothing", async (_, view) => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });

    const result = await postImageOverlay(op.id, await pngFile(600, 300), view);

    expect(result).toEqual({ error: "Der Kartenausschnitt ist ungültig." });
    expect(await listImageOverlays(state.db as Db, op.id)).toEqual([]);
    expect(await readdir(dir)).toEqual([]);
  });

  it("rejects a view that is not JSON and creates nothing", async () => {
    await login();
    const op = await anOperation("Lage");
    const form = new FormData();
    form.append("file", await pngFile(600, 300));
    form.append("view", "{lat: 53.55");

    const response = await POST(
      await multipartRequest("POST", form),
      routeParams({ id: op.id }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Der Kartenausschnitt ist ungültig.",
    });
    expect(await listImageOverlays(state.db as Db, op.id)).toEqual([]);
  });

  it("accepts a view centred on the date line", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });

    const result = await postImageOverlay(op.id, await pngFile(600, 300), {
      ...A_VIEW,
      lng: 180,
    });

    expect(result).toEqual({});
  });

  it("shows the embed failure message, logs the error and leaves no file behind when the database insert fails", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });
    const dbDown = new Error("db down");
    vi.spyOn(repo, "createImageOverlay").mockRejectedValueOnce(dbDown);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await postImageOverlay(
      op.id,
      await pngFile(600, 300),
      A_VIEW,
    );

    expect(result).toEqual({ error: EMBED_FAILED });
    expect(errorLog).toHaveBeenCalledWith(expect.anything(), dbDown);
    expect(await readdir(join(dir, op.id))).toEqual([]);
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers 400 for an Einsatz-ID that is not a UUID, before processing the file", async () => {
    await login();
    const form = new FormData();
    form.append("file", await pngFile(600, 300));
    form.append("view", JSON.stringify(A_VIEW));

    const response = await POST(
      await multipartRequest("POST", form),
      routeParams({ id: "op-1" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Ungültige ID." });
    expect(await readdir(dir)).toEqual([]);
  });

  it("refuses a file name of 201 characters and creates nothing", async () => {
    await login();
    const op = await anOperation("Lage");
    const file = await pngFile(600, 300, `${"x".repeat(197)}.png`);

    const result = await postImageOverlay(op.id, file, A_VIEW);

    expect(result).toEqual({
      error: "Der Dateiname darf höchstens 200 Zeichen lang sein.",
    });
    expect(await listImageOverlays(state.db as Db, op.id)).toEqual([]);
    expect(await readdir(dir)).toEqual([]);
  });

  it("asks for a file and creates nothing when none was sent", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });

    const result = await postImageOverlay(op.id, "keine-datei", A_VIEW);

    expect(result).toEqual({ error: "Keine Datei ausgewählt." });
    expect(await listImageOverlays(state.db as Db, op.id)).toEqual([]);
  });
});

describe("POST /operations/[id]/overlays with a PDF", () => {
  it("converts a first page too large to render at scale 1, keeping its aspect ratio", async () => {
    await login();
    const op = await anOperation("Lage");

    const result = await postImageOverlay(
      op.id,
      pdfFile(200_000, 100_000),
      A_VIEW,
    );

    expect(result).toEqual({});
    const [overlay] = await listImageOverlays(state.db as Db, op.id);
    expect(overlay.widthPx / overlay.heightPx).toBeCloseTo(2, 2);
  });

  it("converts an elongated first page", async () => {
    await login();
    const op = await anOperation("Lage");

    const result = await postImageOverlay(op.id, pdfFile(400_000, 300), A_VIEW);

    expect(result).toEqual({});
    expect(await listImageOverlays(state.db as Db, op.id)).toHaveLength(1);
  });

  it("refuses a first page more than 4000 times longer than wide and stores nothing", async () => {
    await login();
    const op = await anOperation("Lage");

    const result = await postImageOverlay(
      op.id,
      pdfFile(40_000_000, 1),
      A_VIEW,
    );

    expect(result).toEqual({
      error: "Die PDF-Datei konnte nicht umgewandelt werden.",
    });
    expect(await listImageOverlays(state.db as Db, op.id)).toEqual([]);
    expect(await filesUnderUploads()).toEqual([]);
  });
});

describe("POST /operations/[id]/overlays with a very large PNG", () => {
  it("refuses a PNG over 100 megapixels and stores nothing", async () => {
    await login();
    const op = await anOperation("Lage");

    const result = await postImageOverlay(
      op.id,
      grayPngFile(10_001, 10_000),
      A_VIEW,
    );

    expect(result).toEqual({
      error: "Das Bild konnte nicht verarbeitet werden.",
    });
    expect(await listImageOverlays(state.db as Db, op.id)).toEqual([]);
    expect(await filesUnderUploads()).toEqual([]);
  });

  it("accepts a PNG of exactly 100 megapixels", async () => {
    await login();
    const op = await anOperation("Lage");

    const result = await postImageOverlay(
      op.id,
      grayPngFile(10_000, 10_000),
      A_VIEW,
    );

    expect(result).toEqual({});
    expect(await listImageOverlays(state.db as Db, op.id)).toMatchObject([
      { widthPx: 3000, heightPx: 3000 },
    ]);
  });
});
