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

import {
  addImageOverlayAction,
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
  listImageOverlays,
} from "@/server/image-overlays/image-overlays";
import * as storage from "@/server/image-overlays/image-storage";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";

const EMBED_FAILED = "Das Bild konnte nicht eingebunden werden.";

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
  state.revalidatePath.mockReset();
  state.publishOperationChanged.mockReset();
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
    const dbDown = new Error("db down");
    vi.spyOn(repo, "replaceImageOverlayFile").mockRejectedValueOnce(dbDown);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await replaceImageOverlayFileAction(
      op.id,
      overlay.id,
      await pngFile(600, 300),
    );
    expect(result.error).toBeTruthy();

    // Nur die alte Datei bleibt übrig – die neu geschriebene wurde aufgeräumt.
    const files = await readdir(join(dir, op.id));
    expect(files).toEqual([oldPath.split(/[/\\]/)[1]]);
    expect(result).toEqual({ error: EMBED_FAILED });
    expect(errorLog).toHaveBeenCalledWith(expect.anything(), dbDown);
  });

  it("asks for a file and changes nothing when none was sent", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });
    const { overlay, oldPath } = await anOverlayWithStoredFile(op.id);

    const result = await replaceImageOverlayFileAction(
      op.id,
      overlay.id,
      "keine-datei" as unknown as File,
    );

    expect(result).toEqual({ error: "Keine Datei ausgewählt." });
    const unchanged = await getImageOverlay(state.db as Db, overlay.id);
    expect(unchanged).toMatchObject({ filePath: oldPath, name: "Alt" });
  });
});

describe("addImageOverlayAction", () => {
  it("embeds the image as a new overlay of the Einsatz", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });

    const result = await addImageOverlayAction(op.id, await pngFile(600, 300));

    expect(result).toEqual({});
    expect(await listImageOverlays(state.db as Db, op.id)).toMatchObject([
      { name: "neu.png", widthPx: 600, heightPx: 300 },
    ]);
    expect(state.publishOperationChanged).toHaveBeenCalledWith(op.id);
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

    const result = await addImageOverlayAction(op.id, await pngFile(600, 300));

    expect(result).toEqual({ error: EMBED_FAILED });
    expect(errorLog).toHaveBeenCalledWith(expect.anything(), dbDown);
    expect(await readdir(join(dir, op.id))).toEqual([]);
    expect(state.revalidatePath).not.toHaveBeenCalled();
  });

  it("asks for a file and creates nothing when none was sent", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });

    const result = await addImageOverlayAction(
      op.id,
      "keine-datei" as unknown as File,
    );

    expect(result).toEqual({ error: "Keine Datei ausgewählt." });
    expect(await listImageOverlays(state.db as Db, op.id)).toEqual([]);
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

  it("still revalidates and reports success when only the file cleanup fails", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });
    const { overlay } = await anOverlayWithStoredFile(op.id);
    const volumeUnavailable = new Error("volume unavailable");
    vi.spyOn(storage, "deleteOverlayFiles").mockRejectedValueOnce(
      volumeUnavailable,
    );
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    // Die Zeile ist weg – die Löschung ist vollzogen. Ein reiner Aufräum-Fehler
    // (verwaiste Datei) darf weder einen irreführenden Nutzerfehler zeigen noch
    // die Live-Aktualisierung verhindern, sonst rendert das gelöschte Overlay weiter.
    await expect(deleteImageOverlayAction(op.id, overlay.id)).resolves.toEqual(
      {},
    );
    expect(await getImageOverlay(state.db as Db, overlay.id)).toBeNull();
    expect(state.revalidatePath).toHaveBeenCalledWith(`/operations/${op.id}`);
    expect(state.publishOperationChanged).toHaveBeenCalledWith(op.id);
    // Die verwaiste Datei bleibt über das Log im Volume auffindbar.
    expect(errorLog).toHaveBeenCalledWith(
      `Overlay-Datei konnte nicht aufgeräumt werden (${overlay.filePath}):`,
      volumeUnavailable,
    );
  });

  it("returns a friendly {error} when the deletion itself fails", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });
    const { overlay } = await anOverlayWithStoredFile(op.id);
    const dbDown = new Error("db down");
    vi.spyOn(repo, "deleteImageOverlay").mockRejectedValueOnce(dbDown);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(deleteImageOverlayAction(op.id, overlay.id)).resolves.toEqual({
      error: "Das Bild-Overlay konnte nicht gelöscht werden.",
    });
    expect(state.revalidatePath).not.toHaveBeenCalled();
    // Prämisse: die Löschung ist wirklich gescheitert, die Zeile lebt noch.
    expect(await getImageOverlay(state.db as Db, overlay.id)).not.toBeNull();
    expect(errorLog).toHaveBeenCalledWith(
      "Einsatz-Action fehlgeschlagen:",
      dbDown,
    );
  });
});
