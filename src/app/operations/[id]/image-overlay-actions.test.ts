import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));

import { deleteImageOverlayAction } from "@/app/operations/[id]/image-overlay-actions";
import * as repo from "@/server/image-overlays/image-overlays";
import {
  createImageOverlay,
  getImageOverlay,
} from "@/server/image-overlays/image-overlays";
import * as storage from "@/server/image-overlays/image-storage";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { redirectError } from "@/test/redirect-error";
import { signIn } from "@/test/sign-in";

const A_PLACEMENT = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 500,
  rotationDeg: 30,
  opacity: 0.8,
};

async function login(): Promise<void> {
  state.token = await signIn(state.db as Db);
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

  it("lets a redirect thrown while deleting through instead of reporting an error", async () => {
    await login();
    const op = await insertOperation(state.db as Db, {
      name: "Lage",
      description: null,
    });
    const { overlay } = await anOverlayWithStoredFile(op.id);
    const redirect = redirectError();
    vi.spyOn(repo, "deleteImageOverlay").mockRejectedValueOnce(redirect);

    await expect(deleteImageOverlayAction(op.id, overlay.id)).rejects.toBe(
      redirect,
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
