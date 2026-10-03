import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Routen-Logik unverändert läuft.
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

import { subscribeOperation } from "@/server/events/operation-events";
import * as repo from "@/server/image-overlays/image-overlays";
import {
  createImageOverlay,
  getImageOverlay,
} from "@/server/image-overlays/image-overlays";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import { multipartRequest, routeParams } from "@/test/upload-request";
import { PUT } from "./route";

const EMBED_FAILED = "Das Bild konnte nicht eingebunden werden.";

const A_PLACEMENT = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 500,
  rotationDeg: 30,
  opacity: 0.8,
};

/** Sendet `file` wie der Browser an die Adresse des Overlays unter `operationId`. */
async function putImageOverlayFile(
  operationId: string,
  overlayId: string,
  file: File | string,
): Promise<ActionResult> {
  const form = new FormData();
  form.append("file", file);
  const response = await PUT(
    await multipartRequest("PUT", form),
    routeParams({ id: operationId, overlayId }),
  );
  return response.json();
}

async function login(): Promise<void> {
  state.token = await signIn(state.db as Db);
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

async function anOperation(name: string) {
  return insertOperation(state.db as Db, { name, description: null });
}

async function anOverlayWithStoredFile(operationId: string) {
  const oldPath = await storeOverlayImage(operationId, Buffer.from("alt"));
  const overlay = await createImageOverlay(state.db as Db, {
    operationId,
    filePath: oldPath,
    name: "Alt",
    widthPx: 1000,
    heightPx: 1000,
    placement: A_PLACEMENT,
  });
  return { overlay, oldPath };
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
  const parent = await mkdtemp(join(tmpdir(), "einsatz-replace-"));
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

describe("PUT /operations/[id]/overlays/[overlayId]", () => {
  it("keeps the placement, updates file+dimensions, and deletes the old file", async () => {
    await login();
    const op = await anOperation("Lage");
    const { overlay, oldPath } = await anOverlayWithStoredFile(op.id);

    const result = await putImageOverlayFile(
      op.id,
      overlay.id,
      await pngFile(600, 300),
    );
    expect(result).toEqual({});

    const updated = await getImageOverlay(state.db as Db, overlay.id);
    expect(updated).toMatchObject({
      placement: A_PLACEMENT,
      name: "neu.png",
      widthPx: 600,
      heightPx: 300,
    });
    expect(updated?.filePath).not.toBe(oldPath);

    // Alte Datei ist weg, neue liegt im Volume.
    expect(await filesUnderUploads()).toEqual([updated?.filePath]);
  });

  it("leaves the overlay untouched when the file cannot be processed", async () => {
    await login();
    const op = await anOperation("Lage");
    const { overlay, oldPath } = await anOverlayWithStoredFile(op.id);

    const broken = new File([new Uint8Array([1, 2, 3])], "kaputt.png", {
      type: "image/png",
    });
    const result = await putImageOverlayFile(op.id, overlay.id, broken);
    expect(result.error).toBeTruthy();

    const unchanged = await getImageOverlay(state.db as Db, overlay.id);
    expect(unchanged).toMatchObject({ filePath: oldPath, name: "Alt" });
    expect(await filesUnderUploads()).toEqual([oldPath]);
  });

  it("does not orphan the new file when the database update fails", async () => {
    await login();
    const op = await anOperation("Lage");
    const { overlay, oldPath } = await anOverlayWithStoredFile(op.id);
    const dbDown = new Error("db down");
    vi.spyOn(repo, "replaceImageOverlayFile").mockRejectedValueOnce(dbDown);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await putImageOverlayFile(
      op.id,
      overlay.id,
      await pngFile(600, 300),
    );
    expect(result.error).toBeTruthy();

    // Nur die alte Datei bleibt übrig – die neu geschriebene wurde aufgeräumt.
    expect(await filesUnderUploads()).toEqual([oldPath]);
    expect(result).toEqual({ error: EMBED_FAILED });
    expect(errorLog).toHaveBeenCalledWith(expect.anything(), dbDown);
  });

  it("asks for a file and changes nothing when none was sent", async () => {
    await login();
    const op = await anOperation("Lage");
    const { overlay, oldPath } = await anOverlayWithStoredFile(op.id);

    const result = await putImageOverlayFile(op.id, overlay.id, "keine-datei");

    expect(result).toEqual({ error: "Keine Datei ausgewählt." });
    const unchanged = await getImageOverlay(state.db as Db, overlay.id);
    expect(unchanged).toMatchObject({ filePath: oldPath, name: "Alt" });
  });
});

describe("PUT /operations/[id]/overlays/[overlayId] under another Einsatz", () => {
  it("refreshes no Einsatz", async () => {
    await login();
    const a = await anOperation("A");
    const b = await anOperation("B");
    const { overlay } = await anOverlayWithStoredFile(a.id);
    const notified: string[] = [];
    const unsubscribeA = subscribeOperation(a.id, () => notified.push("A"));
    const unsubscribeB = subscribeOperation(b.id, () => notified.push("B"));

    try {
      await putImageOverlayFile(b.id, overlay.id, await pngFile(600, 300));
    } finally {
      unsubscribeA();
      unsubscribeB();
    }

    expect(notified).toEqual([]);
    expect(state.revalidatedPaths).toEqual([]);
  });

  it("rejects the call before processing the file", async () => {
    await login();
    const a = await anOperation("A");
    const b = await anOperation("B");
    const { overlay } = await anOverlayWithStoredFile(a.id);
    const broken = new File([new Uint8Array([1, 2, 3])], "kaputt.png", {
      type: "image/png",
    });

    const result = await putImageOverlayFile(b.id, overlay.id, broken);

    expect(result).toEqual({ error: "Bild-Overlay nicht gefunden." });
  });

  it("creates nothing outside the uploads directory for an Einsatz-ID like ../escape", async () => {
    await login();
    const a = await anOperation("A");
    const { overlay } = await anOverlayWithStoredFile(a.id);
    const before = await readdir(dirname(dir));

    await putImageOverlayFile("../escape", overlay.id, await pngFile(600, 300));

    expect(await readdir(dirname(dir))).toEqual(before);
    const files = await filesUnderUploads();
    expect(files.every((file) => file.startsWith(`${a.id}${sep}`))).toBe(true);
  });
});
