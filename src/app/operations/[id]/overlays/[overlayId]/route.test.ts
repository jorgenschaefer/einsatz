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

import { subscribeOperation } from "@/server/events/operation-events";
import * as repo from "@/server/image-overlays/image-overlays";
import {
  createImageOverlay,
  getImageOverlay,
  type ImageOverlay,
  listImageOverlays,
  setImageOverlayVisibility,
} from "@/server/image-overlays/image-overlays";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { snapshotDbAndUploads } from "@/test/db-snapshot";
import {
  expectNonUuidObjectIdRefused,
  expectRouteRequiresLogin,
  expectUploadRules,
  type SendAs,
} from "@/test/route-checks";
import { signIn } from "@/test/sign-in";
import { multipartRequest, routeParams } from "@/test/upload-request";
import * as route from "./route";
import { GET, PUT } from "./route";

const EMBED_FAILED = "Das Bild konnte nicht eingebunden werden.";
const NOT_A_UUID = "marker-icon.png";

const A_PLACEMENT = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 500,
  rotationDeg: 30,
  opacity: 0.8,
};

const db = () => state.db as Db;

let dir: string;
let operationId: string;
let overlay: ImageOverlay;
const originalUploadsDir = process.env.UPLOADS_DIR;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = await signIn(db());
  state.revalidatedPaths = [];
  // Eigenes Elternverzeichnis, damit „nichts daneben angelegt" prüfbar ist.
  const parent = await mkdtemp(join(tmpdir(), "einsatz-replace-"));
  dir = join(parent, "uploads");
  await mkdir(dir);
  process.env.UPLOADS_DIR = dir;
  operationId = (await anOperation("Lage")).id;
  overlay = await createImageOverlay(db(), {
    operationId,
    filePath: await storeOverlayImage(operationId, Buffer.from("alt")),
    name: "Alt",
    widthPx: 1000,
    heightPx: 1000,
    placement: A_PLACEMENT,
  });
});

afterEach(async () => {
  if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = originalUploadsDir;
  await rm(dirname(dir), { recursive: true, force: true });
  vi.restoreAllMocks();
});

const sendAs: SendAs = async (caller) => {
  if (caller === "anonymous") state.token = undefined;
  else if (caller === "an unknown session") state.token = "no-such-session";
  else state.token = await signIn(db());
};

type Ids = { id?: string; overlayId?: string };

/** Die Adresse des Overlays; `ids` ersetzt Einsatz- oder Overlay-ID. */
const params = (ids: Ids) =>
  routeParams({ id: operationId, overlayId: overlay.id, ...ids });

const get = (ids: Ids = {}) =>
  GET(new Request("http://localhost/"), params(ids));

const put = (request: Request, ids: Ids = {}) => PUT(request, params(ids));

const putPng = async (ids: Ids = {}) =>
  put(await multipartRequest("PUT", fileForm(await pngFile(600, 300))), ids);

/** IDs, die es nicht gibt: Die Anmeldung wird vor ihnen geprüft. */
const NO_SUCH_IDS = { id: "op-1", overlayId: "ov-1" };

expectRouteRequiresLogin(
  route,
  {
    GET: { send: () => get(NO_SUCH_IDS), answer: { redirectTo: "/login" } },
    PUT: { send: () => putPng(NO_SUCH_IDS), answer: { status: 401 } },
  },
  { sendAs },
);

expectNonUuidObjectIdRefused(route, {
  GET: {
    send: () => get({ overlayId: NOT_A_UUID }),
    answer: { status: 404 },
    stored: () => snapshotDbAndUploads(db(), dir),
  },
  PUT: {
    send: () => putPng({ overlayId: NOT_A_UUID }),
    answer: { status: 400, error: "Ungültige ID." },
    stored: () => snapshotDbAndUploads(db(), dir),
  },
});

expectUploadRules(
  route,
  {
    PUT: {
      send: (request) => put(request),
      tooLarge: "Die Datei ist größer als 20 MB.",
      stored: () => snapshotDbAndUploads(db(), dir),
    },
  },
  { sendAs },
);

describe("GET /operations/[id]/overlays/[overlayId]", () => {
  it("serves a hidden Bild-Overlay to the Lageansicht", async () => {
    await setImageOverlayVisibility(db(), operationId, overlay.id, false);

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("alt");
  });
});

describe("PUT /operations/[id]/overlays/[overlayId]", () => {
  it("keeps the placement, updates file+dimensions, and deletes the old file", async () => {
    const result = await putImageOverlayFile(await pngFile(600, 300));
    expect(result).toEqual({});

    const updated = await getImageOverlay(db(), overlay.id);
    expect(updated).toMatchObject({
      placement: A_PLACEMENT,
      name: "neu.png",
      widthPx: 600,
      heightPx: 300,
    });
    expect(updated?.filePath).not.toBe(overlay.filePath);

    // Alte Datei ist weg, neue liegt im Volume.
    expect(await filesUnderUploads()).toEqual([updated?.filePath]);
  });

  it("leaves the overlay untouched when the file cannot be processed", async () => {
    const result = await putImageOverlayFile(aBrokenPng());
    expect(result.error).toBeTruthy();

    expect(await getImageOverlay(db(), overlay.id)).toEqual(overlay);
    expect(await filesUnderUploads()).toEqual([overlay.filePath]);
  });

  it("does not orphan the new file when the database update fails", async () => {
    const dbDown = new Error("db down");
    vi.spyOn(repo, "replaceImageOverlayFile").mockRejectedValueOnce(dbDown);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await putImageOverlayFile(await pngFile(600, 300));

    // Nur die alte Datei bleibt übrig – die neu geschriebene wurde aufgeräumt.
    expect(await filesUnderUploads()).toEqual([overlay.filePath]);
    expect(result).toEqual({ error: EMBED_FAILED });
    expect(errorLog).toHaveBeenCalledWith(expect.anything(), dbDown);
  });

  it("refuses a file name of 201 characters and changes nothing", async () => {
    const file = await pngFile(600, 300, `${"x".repeat(197)}.png`);

    const result = await putImageOverlayFile(file);

    expect(result).toEqual({
      error: "Der Dateiname darf höchstens 200 Zeichen lang sein.",
    });
    expect(await getImageOverlay(db(), overlay.id)).toEqual(overlay);
    expect(await filesUnderUploads()).toEqual([overlay.filePath]);
  });

  it("asks for a file and changes nothing when none was sent", async () => {
    const result = await putImageOverlayFile("keine-datei");

    expect(result).toEqual({ error: "Keine Datei ausgewählt." });
    expect(await getImageOverlay(db(), overlay.id)).toEqual(overlay);
  });

  it("answers 400 for an Einsatz-ID that is not a UUID and changes nothing", async () => {
    const before = await snapshotDbAndUploads(db(), dir);

    const response = await putPng({ id: "op-1" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Ungültige ID." });
    expect(await snapshotDbAndUploads(db(), dir)).toEqual(before);
  });

  it("creates nothing outside the uploads directory for an Einsatz-ID like ../escape", async () => {
    const before = await readdir(dirname(dir));

    await putPng({ id: "../escape" });

    expect(await readdir(dirname(dir))).toEqual(before);
    const files = await filesUnderUploads();
    expect(files.every((file) => file.startsWith(`${operationId}${sep}`))).toBe(
      true,
    );
  });
});

describe("PUT /operations/[id]/overlays/[overlayId] under another Einsatz", () => {
  it("refuses a file for a Bild-Overlay of another Einsatz before processing it and changes nothing", async () => {
    const other = await anOperation("B");
    const before = await snapshotDbAndUploads(db(), dir);

    const response = await put(
      await multipartRequest("PUT", fileForm(aBrokenPng())),
      { id: other.id },
    );

    expect(await response.json()).toEqual({
      error: "Bild-Overlay nicht gefunden.",
    });
    expect(await snapshotDbAndUploads(db(), dir)).toEqual(before);
  });

  it("refreshes no Einsatz", async () => {
    const other = await anOperation("B");
    const notified: string[] = [];
    const unsubscribeA = subscribeOperation(operationId, () =>
      notified.push("A"),
    );
    const unsubscribeB = subscribeOperation(other.id, () => notified.push("B"));

    try {
      await putPng({ id: other.id });
    } finally {
      unsubscribeA();
      unsubscribeB();
    }

    expect(notified).toEqual([]);
    expect(state.revalidatedPaths).toEqual([]);
    expect(await listImageOverlays(db(), operationId)).toEqual([overlay]);
  });
});

/** Sendet `file` wie der Browser an die Adresse des Overlays. */
async function putImageOverlayFile(file: File | string): Promise<ActionResult> {
  const response = await put(await multipartRequest("PUT", fileForm(file)));
  return response.json();
}

function fileForm(file: File | string): FormData {
  const form = new FormData();
  form.append("file", file);
  return form;
}

function anOperation(name: string) {
  return insertOperation(db(), { name, description: null });
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
