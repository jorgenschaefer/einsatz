import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Action-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
  revalidatedPaths: [] as string[],
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => state.revalidatedPaths.push(path),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));

import {
  addImageOverlayAction,
  replaceImageOverlayFileAction,
} from "@/app/operations/[id]/image-overlay-actions";
import { hashPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import { subscribeOperation } from "@/server/events/operation-events";
import {
  createImageOverlay,
  listImageOverlays,
} from "@/server/image-overlays/image-overlays";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { minimalPdf } from "@/test/minimal-pdf";

const A_PLACEMENT = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 500,
  rotationDeg: 30,
  opacity: 0.8,
};

async function login(): Promise<void> {
  const db = state.db as Db;
  const user = await insertUser(db, {
    username: `u-${randomUUID().slice(0, 8)}`,
    passwordHash: await hashPassword("a-very-good-password"),
    role: "user",
  });
  const token = randomUUID();
  await insertSession(db, {
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  state.token = token;
}

function pngFile(width: number, height: number): Promise<File> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .png()
    .toBuffer()
    .then(
      (buf) =>
        new File([new Uint8Array(buf)], "neu.png", { type: "image/png" }),
    );
}

const A_VIEW = { lat: 53.55, lng: 9.99, widthM: 4000, heightM: 3000 };

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

async function anOverlayWithStoredFile(operationId: string) {
  const filePath = await storeOverlayImage(operationId, Buffer.from("alt"));
  return createImageOverlay(state.db as Db, {
    operationId,
    filePath,
    name: "Alt",
    widthPx: 1000,
    heightPx: 1000,
    placement: A_PLACEMENT,
  });
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
  state.revalidatedPaths = [];
  // Eigenes Elternverzeichnis, damit „nichts daneben angelegt" prüfbar ist.
  const parent = await mkdtemp(join(tmpdir(), "einsatz-files-"));
  dir = join(parent, "uploads");
  await mkdir(dir);
  process.env.UPLOADS_DIR = dir;
});

afterEach(async () => {
  if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = originalUploadsDir;
  await rm(dirname(dir), { recursive: true, force: true });
});

describe("replaceImageOverlayFileAction, where the new file lands", () => {
  it("stores the new file under the overlay's Einsatz, not the Einsatz the call names", async () => {
    await login();
    const a = await anOperation("A");
    const b = await anOperation("B");
    const overlay = await anOverlayWithStoredFile(a.id);

    const result = await replaceImageOverlayFileAction(
      b.id,
      overlay.id,
      await pngFile(600, 300),
    );

    expect(result).toEqual({});
    expect(await readdir(dir)).toEqual([a.id]);
    const files = await filesUnderUploads();
    expect(files).toHaveLength(1);
    expect(files[0].startsWith(`${a.id}${sep}`)).toBe(true);
  });

  it("refreshes the overlay's Einsatz, not the Einsatz the call names", async () => {
    await login();
    const a = await anOperation("A");
    const b = await anOperation("B");
    const overlay = await anOverlayWithStoredFile(a.id);
    const notified: string[] = [];
    const unsubscribeA = subscribeOperation(a.id, () => notified.push("A"));
    const unsubscribeB = subscribeOperation(b.id, () => notified.push("B"));

    try {
      await replaceImageOverlayFileAction(
        b.id,
        overlay.id,
        await pngFile(600, 300),
      );
    } finally {
      unsubscribeA();
      unsubscribeB();
    }

    expect(notified).toEqual(["A"]);
    expect(state.revalidatedPaths).toEqual([`/operations/${a.id}`]);
  });

  it("creates nothing outside the uploads directory for an Einsatz-ID like ../escape", async () => {
    await login();
    const a = await anOperation("A");
    const overlay = await anOverlayWithStoredFile(a.id);
    const before = await readdir(dirname(dir));

    await replaceImageOverlayFileAction(
      "../escape",
      overlay.id,
      await pngFile(600, 300),
    );

    expect(await readdir(dirname(dir))).toEqual(before);
    const files = await filesUnderUploads();
    expect(files.every((file) => file.startsWith(`${a.id}${sep}`))).toBe(true);
  });
});

describe("addImageOverlayAction with a PDF", () => {
  it("converts a first page too large to render at scale 1, keeping its aspect ratio", async () => {
    await login();
    const op = await anOperation("Lage");

    const result = await addImageOverlayAction(
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

    const result = await addImageOverlayAction(
      op.id,
      pdfFile(400_000, 300),
      A_VIEW,
    );

    expect(result).toEqual({});
    expect(await listImageOverlays(state.db as Db, op.id)).toHaveLength(1);
  });

  it("refuses a first page more than 4000 times longer than wide and stores nothing", async () => {
    await login();
    const op = await anOperation("Lage");

    const result = await addImageOverlayAction(
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

describe("addImageOverlayAction with a very large PNG", () => {
  it("refuses a PNG over 100 megapixels and stores nothing", async () => {
    await login();
    const op = await anOperation("Lage");

    const result = await addImageOverlayAction(
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

    const result = await addImageOverlayAction(
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
