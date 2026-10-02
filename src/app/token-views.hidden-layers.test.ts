import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit Seiten, Routen und Actions unverändert laufen.
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
vi.mock("pdf-to-png-converter", () => ({ pdfToPng: vi.fn() }));

import { GET as getDeviceOverlay } from "@/app/device/[token]/overlays/[overlayId]/route";
import DevicePage from "@/app/device/[token]/page";
import { setImageOverlayVisibilityAction } from "@/app/operations/[id]/image-overlay-actions";
import { setKmlVisibilityAction } from "@/app/operations/[id]/kml-actions";
import { GET as getViewOverlay } from "@/app/view/[token]/overlays/[overlayId]/route";
import ViewPage from "@/app/view/[token]/page";
import type { ReadOnlySituationMapData } from "@/map/ReadOnlySituationMap";
import { hashPassword } from "@/server/auth/password";
import { insertSession } from "@/server/auth/sessions";
import { insertUser } from "@/server/auth/users";
import { subscribeOperation } from "@/server/events/operation-events";
import {
  createImageOverlay,
  setImageOverlayVisibility,
} from "@/server/image-overlays/image-overlays";
import { createKmlOverlay, setKmlVisibility } from "@/server/kml/kml-overlays";
import {
  createMapSymbol,
  generateDeviceLink,
} from "@/server/mapsymbols/map-symbols";
import { insertOperation } from "@/server/operations/operations";
import { createViewLink } from "@/server/viewlinks/view-links";
import { freshDb } from "@/test/db";

const HIDDEN_KML_CONTENT =
  "<kml><Placemark><name>Geheim</name></Placemark></kml>";

const A_PLACEMENT = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 500,
  rotationDeg: 0,
  opacity: 1,
};

const originalUploadsDir = process.env.UPLOADS_DIR;
let uploadsDir: string;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
  uploadsDir = await mkdtemp(join(tmpdir(), "einsatz-token-views-"));
  process.env.UPLOADS_DIR = uploadsDir;
});

afterEach(async () => {
  if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = originalUploadsDir;
  await rm(uploadsDir, { recursive: true, force: true });
});

describe("hidden layers in Ansichts- and Geräteansicht", () => {
  it("leaves hidden KML-Ebenen and Bild-Overlays out of the Ansichtsansicht's data", async () => {
    const lage = await aLageWithHiddenLayers();

    const props = await viewProps(lage.viewToken);

    expect(props.kmlOverlays.map((o) => o.id)).toEqual([lage.visibleKml]);
    expect(props.imageOverlays.map((o) => o.id)).toEqual([lage.visibleImage]);
    expect(JSON.stringify(props)).not.toContain("Geheim");
    expect(JSON.stringify(props)).not.toContain(lage.hiddenImage);
  });

  it("leaves hidden KML-Ebenen and Bild-Overlays out of the Geräteansicht's data", async () => {
    const lage = await aLageWithHiddenLayers();

    const props = await deviceProps(lage.deviceToken);

    expect(props.kmlOverlays.map((o) => o.id)).toEqual([lage.visibleKml]);
    expect(props.imageOverlays.map((o) => o.id)).toEqual([lage.visibleImage]);
    expect(JSON.stringify(props)).not.toContain("Geheim");
    expect(JSON.stringify(props)).not.toContain(lage.hiddenImage);
  });

  it("answers 404 for a hidden Bild-Overlay's image under /view and /device", async () => {
    const lage = await aLageWithHiddenLayers();

    const view = await getViewOverlay(new Request("http://localhost/"), {
      params: Promise.resolve({
        token: lage.viewToken,
        overlayId: lage.hiddenImage,
      }),
    });
    const device = await getDeviceOverlay(new Request("http://localhost/"), {
      params: Promise.resolve({
        token: lage.deviceToken,
        overlayId: lage.hiddenImage,
      }),
    });

    expect(view.status).toBe(404);
    expect(device.status).toBe(404);
  });

  it("serves a visible Bild-Overlay's image under /view and /device", async () => {
    const lage = await aLageWithHiddenLayers();

    const view = await getViewOverlay(new Request("http://localhost/"), {
      params: Promise.resolve({
        token: lage.viewToken,
        overlayId: lage.visibleImage,
      }),
    });
    const device = await getDeviceOverlay(new Request("http://localhost/"), {
      params: Promise.resolve({
        token: lage.deviceToken,
        overlayId: lage.visibleImage,
      }),
    });

    expect(view.status).toBe(200);
    expect(device.status).toBe(200);
  });

  it("tells open token views when a KML-Ebene is shown again, and then includes it", async () => {
    const lage = await aLageWithHiddenLayers();
    await login();
    const listener = vi.fn();
    const unsubscribe = subscribeOperation(lage.operationId, listener);

    try {
      await setKmlVisibilityAction(lage.operationId, lage.hiddenKml, true);
    } finally {
      unsubscribe();
    }

    expect(listener).toHaveBeenCalledTimes(1);
    const props = await viewProps(lage.viewToken);
    expect(props.kmlOverlays.map((o) => o.id)).toContain(lage.hiddenKml);
  });

  it("tells open token views when a Bild-Overlay is shown again, and then serves it", async () => {
    const lage = await aLageWithHiddenLayers();
    await login();
    const listener = vi.fn();
    const unsubscribe = subscribeOperation(lage.operationId, listener);

    try {
      await setImageOverlayVisibilityAction(
        lage.operationId,
        lage.hiddenImage,
        true,
      );
    } finally {
      unsubscribe();
    }

    expect(listener).toHaveBeenCalledTimes(1);
    const props = await deviceProps(lage.deviceToken);
    expect(props.imageOverlays.map((o) => o.id)).toContain(lage.hiddenImage);
    const device = await getDeviceOverlay(new Request("http://localhost/"), {
      params: Promise.resolve({
        token: lage.deviceToken,
        overlayId: lage.hiddenImage,
      }),
    });
    expect(device.status).toBe(200);
  });
});

async function viewProps(token: string): Promise<ReadOnlySituationMapData> {
  const page = (await ViewPage({
    params: Promise.resolve({ token }),
  })) as ReactElement<ReadOnlySituationMapData>;
  return page.props;
}

async function deviceProps(token: string): Promise<ReadOnlySituationMapData> {
  const page = (await DevicePage({
    params: Promise.resolve({ token }),
  })) as ReactElement<ReadOnlySituationMapData>;
  return page.props;
}

async function aLageWithHiddenLayers() {
  const db = state.db as Db;
  const op = await insertOperation(db, { name: "Lage", description: null });
  const kml = (name: string, content: string) =>
    createKmlOverlay(db, {
      operationId: op.id,
      sourceType: "file",
      sourceUrl: null,
      name,
      content,
    });
  const visibleKml = await kml("Offen", "<kml><name>Offen</name></kml>");
  const hiddenKml = await kml("Verdeckt", HIDDEN_KML_CONTENT);
  await setKmlVisibility(db, hiddenKml.id, false);
  const visibleImage = await anImageOverlay(op.id, "offen.webp");
  const hiddenImage = await anImageOverlay(op.id, "verdeckt.webp");
  await setImageOverlayVisibility(db, hiddenImage.id, false);
  const viewLink = await createViewLink(db, {
    operationId: op.id,
    label: "Leitstelle",
  });
  const symbol = await createMapSymbol(db, {
    operationId: op.id,
    composition: {
      grundzeichen: "kraftfahrzeug-landgebunden",
      fachaufgabe: "rettungswesen",
      organisation: "hilfsorganisation",
    },
    lat: 53.55,
    lng: 9.99,
  });
  return {
    operationId: op.id,
    viewToken: viewLink.token,
    deviceToken: await generateDeviceLink(db, symbol.id),
    visibleKml: visibleKml.id,
    hiddenKml: hiddenKml.id,
    visibleImage: visibleImage.id,
    hiddenImage: hiddenImage.id,
  };
}

async function anImageOverlay(operationId: string, fileName: string) {
  const filePath = `${operationId}/${fileName}`;
  await mkdir(join(uploadsDir, operationId), { recursive: true });
  await writeFile(join(uploadsDir, filePath), Buffer.from("webp-bytes"));
  return createImageOverlay(state.db as Db, {
    operationId,
    filePath,
    name: fileName,
    widthPx: 200,
    heightPx: 100,
    placement: A_PLACEMENT,
  });
}

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
