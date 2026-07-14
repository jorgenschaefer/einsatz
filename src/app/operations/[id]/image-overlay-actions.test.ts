import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Action-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));

import {
  deleteImageOverlayAction,
  replaceImageOverlayFileAction,
} from "@/app/operations/[id]/image-overlay-actions";
import { hashPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import * as repo from "@/server/image-overlays/image-overlays";
import {
  createImageOverlay,
  getImageOverlay,
} from "@/server/image-overlays/image-overlays";
import * as storage from "@/server/image-overlays/image-storage";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";

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

let dir: string;
const originalUploadsDir = process.env.UPLOADS_DIR;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
  dir = await mkdtemp(join(tmpdir(), "einsatz-replace-"));
  process.env.UPLOADS_DIR = dir;
});

afterEach(async () => {
  if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = originalUploadsDir;
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("replaceImageOverlayFileAction", () => {
  it("keeps the placement, updates file+dimensions, and deletes the old file", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });
    const { overlay, oldPath } = await anOverlayWithStoredFile(op.id);

    const result = await replaceImageOverlayFileAction(
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
    const files = await readdir(join(dir, op.id));
    expect(files).toHaveLength(1);
    expect(join(op.id, files[0])).toBe(updated?.filePath);
  });

  it("leaves the overlay untouched when the file cannot be processed", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });
    const { overlay, oldPath } = await anOverlayWithStoredFile(op.id);

    const broken = new File([new Uint8Array([1, 2, 3])], "kaputt.png", {
      type: "image/png",
    });
    const result = await replaceImageOverlayFileAction(
      op.id,
      overlay.id,
      broken,
    );
    expect(result.error).toBeTruthy();

    const unchanged = await getImageOverlay(state.db as Db, overlay.id);
    expect(unchanged).toMatchObject({ filePath: oldPath, name: "Alt" });
    const files = await readdir(join(dir, op.id));
    expect(files).toEqual([oldPath.split(/[/\\]/)[1]]);
  });

  it("does not orphan the new file when the database update fails", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });
    const { overlay, oldPath } = await anOverlayWithStoredFile(op.id);
    vi.spyOn(repo, "replaceImageOverlayFile").mockRejectedValueOnce(
      new Error("db down"),
    );

    const result = await replaceImageOverlayFileAction(
      op.id,
      overlay.id,
      await pngFile(600, 300),
    );
    expect(result.error).toBeTruthy();

    // Nur die alte Datei bleibt übrig – die neu geschriebene wurde aufgeräumt.
    const files = await readdir(join(dir, op.id));
    expect(files).toEqual([oldPath.split(/[/\\]/)[1]]);
  });
});

describe("deleteImageOverlayAction", () => {
  it("deletes the overlay and returns {} on success", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });
    const { overlay } = await anOverlayWithStoredFile(op.id);

    const result = await deleteImageOverlayAction(op.id, overlay.id);

    expect(result).toEqual({});
    expect(await getImageOverlay(state.db as Db, overlay.id)).toBeNull();
  });

  it("returns a friendly {error} when the file cleanup fails, like its siblings", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });
    const { overlay } = await anOverlayWithStoredFile(op.id);
    vi.spyOn(storage, "deleteOverlayFiles").mockRejectedValueOnce(
      new Error("volume unavailable"),
    );

    // The row is already gone; the cleanup failure must surface as a form error,
    // not throw an unhandled server error.
    await expect(deleteImageOverlayAction(op.id, overlay.id)).resolves.toEqual({
      error: "Das Bild-Overlay konnte nicht gelöscht werden.",
    });
    expect(await getImageOverlay(state.db as Db, overlay.id)).toBeNull();
  });
});
