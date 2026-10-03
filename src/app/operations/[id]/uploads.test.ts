import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_KML_BYTES } from "@/kml/kmz";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Routen-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/events/operation-events", () => ({
  publishOperationChanged: () => {},
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));

import { POST as addKml } from "@/app/operations/[id]/kml/route";
import { PUT as replaceImage } from "@/app/operations/[id]/overlays/[overlayId]/route";
import { POST as addImage } from "@/app/operations/[id]/overlays/route";
import {
  createImageOverlay,
  getImageOverlay,
  listImageOverlays,
} from "@/server/image-overlays/image-overlays";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { listKmlOverlays } from "@/server/kml/kml-overlays";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { kmlFileForm } from "@/test/kml-upload";
import { generatedBody } from "@/test/scripted-fetch";
import { signIn } from "@/test/sign-in";
import {
  multipartRequest,
  routeParams,
  streamedRequest,
} from "@/test/upload-request";

const MB = 1024 * 1024;
const CHUNK = 64 * 1024;
const A_VIEW = { lat: 53.55, lng: 9.99, widthM: 4000, heightM: 3000 };
const A_PLACEMENT = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 500,
  rotationDeg: 0,
  opacity: 1,
};

const db = () => state.db as Db;

let dir: string;
const originalUploadsDir = process.env.UPLOADS_DIR;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
  dir = await mkdtemp(join(tmpdir(), "einsatz-uploads-"));
  process.env.UPLOADS_DIR = dir;
});

afterEach(async () => {
  if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = originalUploadsDir;
  await rm(dir, { recursive: true, force: true });
});

const anOperation = () =>
  insertOperation(db(), { name: "Lage", description: null });

async function anOverlay(operationId: string) {
  return createImageOverlay(db(), {
    operationId,
    filePath: await storeOverlayImage(operationId, Buffer.from("alt")),
    name: "Alt",
    widthPx: 1000,
    heightPx: 1000,
    placement: A_PLACEMENT,
  });
}

async function aPng(): Promise<File> {
  const png = await sharp({
    create: { width: 60, height: 30, channels: 3, background: "#123456" },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(png)], "plan.png", { type: "image/png" });
}

const imageForm = (file: File, view?: unknown) => {
  const form = new FormData();
  form.append("file", file);
  if (view !== undefined) form.append("view", JSON.stringify(view));
  return form;
};

type Upload = {
  name: string;
  send: (
    request: Request,
    ids: { operationId: string; overlayId: string },
  ) => Promise<Response>;
};

const uploads: Upload[] = [
  {
    name: "POST /operations/[id]/kml",
    send: (request, { operationId }) =>
      addKml(request, routeParams({ id: operationId })),
  },
  {
    name: "POST /operations/[id]/overlays",
    send: (request, { operationId }) =>
      addImage(request, routeParams({ id: operationId })),
  },
  {
    name: "PUT /operations/[id]/overlays/[overlayId]",
    send: (request, { operationId, overlayId }) =>
      replaceImage(request, routeParams({ id: operationId, overlayId })),
  },
];

describe.each(uploads)("$name without a session", ({ send }) => {
  it("answers 401 without reading the body", async () => {
    const op = await anOperation();
    const overlay = await anOverlay(op.id);
    const body = generatedBody({ totalBytes: 5 * MB });

    const response = await send(streamedRequest("POST", body.stream), {
      operationId: op.id,
      overlayId: overlay.id,
    });

    expect(response.status).toBe(401);
    expect(body.pulled()).toBe(0);
  });

  it("answers 401 for a session token that does not exist", async () => {
    state.token = "no-such-session";
    const op = await anOperation();
    const overlay = await anOverlay(op.id);
    const body = generatedBody({ totalBytes: 5 * MB });

    const response = await send(streamedRequest("POST", body.stream), {
      operationId: op.id,
      overlayId: overlay.id,
    });

    expect(response.status).toBe(401);
    expect(body.pulled()).toBe(0);
  });
});

describe.each(uploads)("$name from another site", ({ send }) => {
  beforeEach(async () => {
    state.token = await signIn(db());
  });

  it.each([
    ["another host", { origin: "https://evil.example", host: "einsatz.test" }],
    [
      "a sibling host behind the reverse proxy",
      {
        origin: "https://lager.drk.test",
        host: "app:3000",
        "x-forwarded-host": "einsatz.drk.test",
      },
    ],
    ["an opaque origin", { origin: "null", host: "einsatz.test" }],
    ["a malformed origin", { origin: "einsatz.test", host: "einsatz.test" }],
  ])(
    "answers 403 for %s without reading the body or storing anything",
    async (_, headers) => {
      const op = await anOperation();
      const overlay = await anOverlay(op.id);
      const body = generatedBody({ totalBytes: 5 * MB });

      const response = await send(
        streamedRequest("POST", body.stream, headers),
        { operationId: op.id, overlayId: overlay.id },
      );

      expect(response.status).toBe(403);
      expect(body.pulled()).toBe(0);
      expect(await listKmlOverlays(db(), op.id)).toEqual([]);
      expect(await getImageOverlay(db(), overlay.id)).toMatchObject({
        name: "Alt",
      });
    },
  );
});

describe("signed in, from the app's own origin", () => {
  beforeEach(async () => {
    state.token = await signIn(db());
  });

  it.each([
    ["its Host", { origin: "https://einsatz.test", host: "einsatz.test" }],
    [
      "the host the reverse proxy forwards",
      {
        origin: "https://einsatz.drk.test",
        host: "app:3000",
        "x-forwarded-host": "einsatz.drk.test, proxy.internal",
      },
    ],
  ])("adds a KML file with an Origin matching %s", async (_, headers) => {
    const op = await anOperation();

    const response = await addKml(
      await multipartRequest(
        "POST",
        kmlFileForm("Abschnitte", "<kml/>"),
        headers,
      ),
      routeParams({ id: op.id }),
    );

    expect(response.status).toBe(200);
    expect(await listKmlOverlays(db(), op.id)).toHaveLength(1);
  });
});

describe("signed in, 20 MB uploads", () => {
  beforeEach(async () => {
    state.token = await signIn(db());
  });

  it("adds a KML file of just under 20 MB", async () => {
    const op = await anOperation();
    const head = "<kml><Document>";
    const tail = "</Document></kml>";
    const kml = `${head}${" ".repeat(MAX_KML_BYTES - head.length - tail.length)}${tail}`;

    const response = await addKml(
      await multipartRequest("POST", kmlFileForm("Abschnitte", kml)),
      routeParams({ id: op.id }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    const [stored] = await listKmlOverlays(db(), op.id);
    expect(stored).toMatchObject({ name: "Abschnitte", sourceType: "file" });
    expect(stored.content).toHaveLength(MAX_KML_BYTES);
  });

  it("adds an image overlay", async () => {
    const op = await anOperation();

    const response = await addImage(
      await multipartRequest("POST", imageForm(await aPng(), A_VIEW)),
      routeParams({ id: op.id }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(await listImageOverlays(db(), op.id)).toMatchObject([
      { name: "plan.png", widthPx: 60, heightPx: 30 },
    ]);
  });

  it("replaces an image overlay's file", async () => {
    const op = await anOperation();
    const overlay = await anOverlay(op.id);

    const response = await replaceImage(
      await multipartRequest("PUT", imageForm(await aPng())),
      routeParams({ id: op.id, overlayId: overlay.id }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(await getImageOverlay(db(), overlay.id)).toMatchObject({
      name: "plan.png",
      widthPx: 60,
      heightPx: 30,
    });
  });
});

describe("signed in, a body over the limit without Content-Length", () => {
  beforeEach(async () => {
    state.token = await signIn(db());
  });

  const tooLarge = [
    { ...uploads[0], message: "Die KML-Datei ist größer als 20 MB." },
    { ...uploads[1], message: "Die Datei ist größer als 20 MB." },
    { ...uploads[2], message: "Die Datei ist größer als 20 MB." },
  ];

  it.each(tooLarge)(
    "$name answers 413, stops reading after 21 MB and stores nothing",
    async ({ send, message }) => {
      const op = await anOperation();
      const overlay = await anOverlay(op.id);
      const filesBefore = await readdir(join(dir, op.id));
      const body = generatedBody({ totalBytes: 22 * MB, chunkBytes: CHUNK });

      const response = await send(streamedRequest("POST", body.stream), {
        operationId: op.id,
        overlayId: overlay.id,
      });

      expect(response.status).toBe(413);
      expect(await response.json()).toEqual({ error: message });
      expect(body.pulled()).toBeGreaterThan(21 * MB);
      expect(body.pulled()).toBeLessThanOrEqual(21 * MB + CHUNK);
      expect(body.cancelled()).toBe(true);
      expect(await listKmlOverlays(db(), op.id)).toEqual([]);
      expect(await listImageOverlays(db(), op.id)).toMatchObject([
        { id: overlay.id, name: "Alt" },
      ]);
      expect(await readdir(join(dir, op.id))).toEqual(filesBefore);
    },
  );
});
