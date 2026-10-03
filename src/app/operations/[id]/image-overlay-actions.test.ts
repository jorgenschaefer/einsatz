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
vi.mock("next/navigation", async (original) => ({
  ...(await original<object>()),
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));

import * as repo from "@/server/image-overlays/image-overlays";
import {
  createImageOverlay,
  getImageOverlay,
} from "@/server/image-overlays/image-overlays";
import * as storage from "@/server/image-overlays/image-storage";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { insertOperation } from "@/server/operations/operations";
import {
  type ActAs,
  expectBadCallsRejected,
  expectEveryActionRequiresLogin,
  expectForeignObjectsRejected,
} from "@/test/action-checks";
import { type Bad, idCalls, rejects } from "@/test/bad-calls/bad-call";
import { PLACEMENT } from "@/test/bad-calls/fixture";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import * as actions from "./image-overlay-actions";

const {
  deleteImageOverlayAction,
  setImageOverlayVisibilityAction,
  updateImageOverlayPlacementAction,
} = actions;

const NOT_FOUND = "Bild-Overlay nicht gefunden.";
const INVALID_PLACEMENT = "Ungültige Platzierung.";
const INVALID_VISIBILITY = "Die Sichtbarkeit muss wahr oder falsch sein.";

const A_PLACEMENT = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 500,
  rotationDeg: 30,
  opacity: 0.8,
};

const actAs: ActAs = async (caller) => {
  state.token =
    caller === "anonymous" ? undefined : await signIn(state.db as Db, caller);
};
const db = () => state.db as Db;

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

expectEveryActionRequiresLogin(actions, { actAs });

expectBadCallsRejected(
  actions,
  {
    updateImageOverlayPlacementAction: [
      ...idCalls("imageId", (op, id) =>
        updateImageOverlayPlacementAction(op, id, PLACEMENT),
      ),
      rejects("a placement of null", INVALID_PLACEMENT, (f) =>
        updateImageOverlayPlacementAction(
          f.operationId,
          f.imageId,
          null as Bad,
        ),
      ),
      rejects("a placement as text", INVALID_PLACEMENT, (f) =>
        updateImageOverlayPlacementAction(f.operationId, f.imageId, "x" as Bad),
      ),
      rejects(
        "a scale as text",
        "Die Skalierung muss größer als 0 sein.",
        (f) =>
          updateImageOverlayPlacementAction(f.operationId, f.imageId, {
            ...PLACEMENT,
            scaleM: "10" as Bad,
          }),
      ),
      rejects("a centre lat as text", "Ungültige Koordinaten.", (f) =>
        updateImageOverlayPlacementAction(f.operationId, f.imageId, {
          ...PLACEMENT,
          centerLat: "50" as Bad,
        }),
      ),
      rejects(
        "a rotation of null",
        "Die Drehung muss eine endliche Zahl sein.",
        (f) =>
          updateImageOverlayPlacementAction(f.operationId, f.imageId, {
            ...PLACEMENT,
            rotationDeg: null as Bad,
          }),
      ),
    ],
    setImageOverlayVisibilityAction: [
      ...idCalls("imageId", (op, id) =>
        setImageOverlayVisibilityAction(op, id, false),
      ),
      rejects("visible of null", INVALID_VISIBILITY, (f) =>
        setImageOverlayVisibilityAction(f.operationId, f.imageId, null as Bad),
      ),
      rejects('visible as "yes"', INVALID_VISIBILITY, (f) =>
        setImageOverlayVisibilityAction(f.operationId, f.imageId, "yes" as Bad),
      ),
    ],
    deleteImageOverlayAction: idCalls("imageId", deleteImageOverlayAction),
  },
  { db, actAs },
);

expectForeignObjectsRejected(
  actions,
  {
    updateImageOverlayPlacementAction: {
      error: NOT_FOUND,
      call: (a, b) =>
        updateImageOverlayPlacementAction(b, a.imageId, PLACEMENT),
    },
    setImageOverlayVisibilityAction: {
      error: NOT_FOUND,
      call: (a, b) => setImageOverlayVisibilityAction(b, a.imageId, false),
    },
    deleteImageOverlayAction: {
      error: NOT_FOUND,
      call: (a, b) => deleteImageOverlayAction(b, a.imageId),
    },
  },
  { db, actAs },
);

describe("updateImageOverlayPlacementAction", () => {
  it("stores the new placement and tells open clients", async () => {
    await actAs("user");
    const { op, overlay } = await anOverlayWithStoredFile();

    const result = await updateImageOverlayPlacementAction(
      op.id,
      overlay.id,
      PLACEMENT,
    );

    expect(result).toEqual({});
    expect(await getImageOverlay(db(), overlay.id)).toEqual({
      ...overlay,
      placement: PLACEMENT,
    });
    expect(state.publishOperationChanged).toHaveBeenCalledWith(op.id);
  });
});

describe("setImageOverlayVisibilityAction", () => {
  it("hides the Bild-Overlay and tells open clients", async () => {
    await actAs("user");
    const { op, overlay } = await anOverlayWithStoredFile();

    const result = await setImageOverlayVisibilityAction(
      op.id,
      overlay.id,
      false,
    );

    expect(result).toEqual({});
    expect(await getImageOverlay(db(), overlay.id)).toEqual({
      ...overlay,
      visible: false,
    });
    expect(state.publishOperationChanged).toHaveBeenCalledWith(op.id);
  });

  it("shows a hidden Bild-Overlay again and tells open clients", async () => {
    await actAs("user");
    const { op, overlay } = await anOverlayWithStoredFile();
    await setImageOverlayVisibilityAction(op.id, overlay.id, false);
    state.publishOperationChanged.mockClear();

    const result = await setImageOverlayVisibilityAction(
      op.id,
      overlay.id,
      true,
    );

    expect(result).toEqual({});
    expect(await getImageOverlay(db(), overlay.id)).toEqual(overlay);
    expect(state.publishOperationChanged).toHaveBeenCalledWith(op.id);
  });
});

describe("deleteImageOverlayAction", () => {
  beforeEach(() => actAs("user"));

  it("deletes the overlay and returns {} on success", async () => {
    const { op, overlay } = await anOverlayWithStoredFile();

    const result = await deleteImageOverlayAction(op.id, overlay.id);

    expect(result).toEqual({});
    expect(await getImageOverlay(db(), overlay.id)).toBeNull();
  });

  it("still revalidates and reports success when only the file cleanup fails", async () => {
    const { op, overlay } = await anOverlayWithStoredFile();
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
    expect(await getImageOverlay(db(), overlay.id)).toBeNull();
    expect(state.revalidatePath).toHaveBeenCalledWith(`/operations/${op.id}`);
    expect(state.publishOperationChanged).toHaveBeenCalledWith(op.id);
    // Die verwaiste Datei bleibt über das Log im Volume auffindbar.
    expect(errorLog).toHaveBeenCalledWith(
      `Overlay-Datei konnte nicht aufgeräumt werden (${overlay.filePath}):`,
      volumeUnavailable,
    );
  });

  it("returns a friendly {error} when the deletion itself fails", async () => {
    const { op, overlay } = await anOverlayWithStoredFile();
    const dbDown = new Error("db down");
    vi.spyOn(repo, "deleteImageOverlay").mockRejectedValueOnce(dbDown);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(deleteImageOverlayAction(op.id, overlay.id)).resolves.toEqual({
      error: "Das Bild-Overlay konnte nicht gelöscht werden.",
    });
    expect(state.revalidatePath).not.toHaveBeenCalled();
    // Prämisse: die Löschung ist wirklich gescheitert, die Zeile lebt noch.
    expect(await getImageOverlay(db(), overlay.id)).not.toBeNull();
    expect(errorLog).toHaveBeenCalledWith(
      "Einsatz-Action fehlgeschlagen:",
      dbDown,
    );
  });
});

async function anOverlayWithStoredFile() {
  const op = await insertOperation(db(), { name: "Lage", description: null });
  const overlay = await createImageOverlay(db(), {
    operationId: op.id,
    filePath: await storeOverlayImage(op.id, Buffer.from("alt")),
    name: "Alt",
    widthPx: 1000,
    heightPx: 1000,
    placement: A_PLACEMENT,
  });
  return { op, overlay };
}
