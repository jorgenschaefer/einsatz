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
import { snapshotDbAndUploads } from "@/test/db-snapshot";
import { minimalPdf } from "@/test/minimal-pdf";
import {
  expectRouteRequiresLogin,
  expectUploadRules,
  type SendAs,
} from "@/test/route-checks";
import { signIn } from "@/test/sign-in";
import { multipartRequest, routeParams } from "@/test/upload-request";
import * as route from "./route";
import { POST } from "./route";

const EMBED_FAILED = "Das Bild konnte nicht eingebunden werden.";

const A_VIEW = { lat: 53.55, lng: 9.99, widthM: 4000, heightM: 3000 };

const db = () => state.db as Db;

/** Sendet `file` und `view` wie der Browser; ohne `view` fehlt das Feld. */
async function postImageOverlay(
  file: File | string,
  view?: unknown,
): Promise<ActionResult> {
  const response = await send(
    await multipartRequest("POST", imageForm(file, view)),
  );
  return response.json();
}

const send = (request: Request, id = operationId) =>
  POST(request, routeParams({ id }));

function imageForm(file: File | string, view?: unknown): FormData {
  const form = new FormData();
  form.append("file", file);
  if (view !== undefined) form.append("view", JSON.stringify(view));
  return form;
}

const sendAs: SendAs = async (caller) => {
  if (caller === "anonymous") state.token = undefined;
  else if (caller === "an unknown session") state.token = "no-such-session";
  else state.token = await signIn(db());
};

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

/** Alle Dateien unter dem Upload-Verzeichnis, relativ dazu. */
async function filesUnderUploads(): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)));
}

let dir: string;
let operationId: string;
const originalUploadsDir = process.env.UPLOADS_DIR;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = await signIn(db());
  operationId = (
    await insertOperation(db(), { name: "Lage", description: null })
  ).id;
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

expectRouteRequiresLogin(
  route,
  {
    POST: {
      send: async () =>
        send(
          await multipartRequest(
            "POST",
            imageForm(await pngFile(600, 300), A_VIEW),
          ),
          "op-1",
        ),
      answer: { status: 401 },
    },
  },
  { sendAs },
);

expectUploadRules(
  route,
  {
    POST: {
      send,
      tooLarge: "Die Datei ist größer als 20 MB.",
      stored: () => snapshotDbAndUploads(db(), dir),
    },
  },
  { sendAs },
);

describe("POST /operations/[id]/overlays", () => {
  it("embeds the image as a new overlay of the Einsatz", async () => {
    const result = await postImageOverlay(await pngFile(600, 300), A_VIEW);

    expect(result).toEqual({});
    expect(await listImageOverlays(db(), operationId)).toMatchObject([
      { name: "neu.png", widthPx: 600, heightPx: 300 },
    ]);
    expect(state.publishOperationChanged).toHaveBeenCalledWith(operationId);
  });

  it("centers a landscape image on the uploader's view at half its width", async () => {
    await setDefaultView(db(), operationId, { lat: 48, lng: 11, zoom: 9 });

    await postImageOverlay(await pngFile(600, 300), {
      lat: 53.55,
      lng: 9.99,
      widthM: 4000,
      heightM: 3000,
    });

    const [overlay] = await listImageOverlays(db(), operationId);
    expect(overlay.placement).toMatchObject({
      centerLat: 53.55,
      centerLng: 9.99,
      scaleM: 2000,
    });
  });

  it("sizes a portrait image to half the height of the uploader's view", async () => {
    await postImageOverlay(await pngFile(300, 600), {
      lat: 53.55,
      lng: 9.99,
      widthM: 4000,
      heightM: 1000,
    });

    const [overlay] = await listImageOverlays(db(), operationId);
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
    const result = await postImageOverlay(await pngFile(600, 300), view);

    expect(result).toEqual({ error: "Der Kartenausschnitt ist ungültig." });
    expect(await listImageOverlays(db(), operationId)).toEqual([]);
    expect(await readdir(dir)).toEqual([]);
  });

  it("rejects a view that is not JSON and creates nothing", async () => {
    const form = new FormData();
    form.append("file", await pngFile(600, 300));
    form.append("view", "{lat: 53.55");

    const response = await send(await multipartRequest("POST", form));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Der Kartenausschnitt ist ungültig.",
    });
    expect(await listImageOverlays(db(), operationId)).toEqual([]);
  });

  it("accepts a view centred on the date line", async () => {
    const result = await postImageOverlay(await pngFile(600, 300), {
      ...A_VIEW,
      lng: 180,
    });

    expect(result).toEqual({});
  });

  it("shows the embed failure message, logs the error and leaves no file behind when the database insert fails", async () => {
    const dbDown = new Error("db down");
    vi.spyOn(repo, "createImageOverlay").mockRejectedValueOnce(dbDown);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await postImageOverlay(await pngFile(600, 300), A_VIEW);

    expect(result).toEqual({ error: EMBED_FAILED });
    expect(errorLog).toHaveBeenCalledWith(expect.anything(), dbDown);
    expect(await readdir(join(dir, operationId))).toEqual([]);
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers 400 for an Einsatz-ID that is not a UUID, before processing the file", async () => {
    const form = new FormData();
    form.append("file", await pngFile(600, 300));
    form.append("view", JSON.stringify(A_VIEW));

    const response = await send(await multipartRequest("POST", form), "op-1");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Ungültige ID." });
    expect(await readdir(dir)).toEqual([]);
  });

  it("refuses a file name of 201 characters and creates nothing", async () => {
    const file = await pngFile(600, 300, `${"x".repeat(197)}.png`);

    const result = await postImageOverlay(file, A_VIEW);

    expect(result).toEqual({
      error: "Der Dateiname darf höchstens 200 Zeichen lang sein.",
    });
    expect(await listImageOverlays(db(), operationId)).toEqual([]);
    expect(await readdir(dir)).toEqual([]);
  });

  it("asks for a file and creates nothing when none was sent", async () => {
    const result = await postImageOverlay("keine-datei", A_VIEW);

    expect(result).toEqual({ error: "Keine Datei ausgewählt." });
    expect(await listImageOverlays(db(), operationId)).toEqual([]);
  });
});

describe("POST /operations/[id]/overlays with a PDF", () => {
  it("converts a first page too large to render at scale 1, keeping its aspect ratio", async () => {
    const result = await postImageOverlay(pdfFile(200_000, 100_000), A_VIEW);

    expect(result).toEqual({});
    const [overlay] = await listImageOverlays(db(), operationId);
    expect(overlay.widthPx / overlay.heightPx).toBeCloseTo(2, 2);
  });

  it("converts an elongated first page", async () => {
    const result = await postImageOverlay(pdfFile(400_000, 300), A_VIEW);

    expect(result).toEqual({});
    expect(await listImageOverlays(db(), operationId)).toHaveLength(1);
  });

  it("refuses a first page more than 4000 times longer than wide and stores nothing", async () => {
    const result = await postImageOverlay(pdfFile(40_000_000, 1), A_VIEW);

    expect(result).toEqual({
      error: "Die PDF-Datei konnte nicht umgewandelt werden.",
    });
    expect(await listImageOverlays(db(), operationId)).toEqual([]);
    expect(await filesUnderUploads()).toEqual([]);
  });
});

describe("POST /operations/[id]/overlays with a very large PNG", () => {
  it("refuses a PNG over 100 megapixels and stores nothing", async () => {
    const result = await postImageOverlay(grayPngFile(10_001, 10_000), A_VIEW);

    expect(result).toEqual({
      error: "Das Bild konnte nicht verarbeitet werden.",
    });
    expect(await listImageOverlays(db(), operationId)).toEqual([]);
    expect(await filesUnderUploads()).toEqual([]);
  });

  it("accepts a PNG of exactly 100 megapixels", async () => {
    const result = await postImageOverlay(grayPngFile(10_000, 10_000), A_VIEW);

    expect(result).toEqual({});
    expect(await listImageOverlays(db(), operationId)).toMatchObject([
      { widthPx: 3000, heightPx: 3000 },
    ]);
  });
});
