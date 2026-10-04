import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { snapshotDbAndUploads } from "@/test/db-snapshot";
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

  it("shows the embed failure message and logs the error when the database insert fails", async () => {
    const dbDown = new Error("db down");
    vi.spyOn(repo, "createImageOverlay").mockRejectedValueOnce(dbDown);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await postImageOverlay(await pngFile(600, 300), A_VIEW);

    expect(result).toEqual({ error: EMBED_FAILED });
    expect(errorLog).toHaveBeenCalledWith(expect.anything(), dbDown);
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

  it("asks for a file and creates nothing when none was sent", async () => {
    const result = await postImageOverlay("keine-datei", A_VIEW);

    expect(result).toEqual({ error: "Keine Datei ausgewählt." });
    expect(await listImageOverlays(db(), operationId)).toEqual([]);
  });
});
