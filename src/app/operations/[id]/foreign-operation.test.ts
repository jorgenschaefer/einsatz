import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Action-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
  fetchedUrls: [] as string[],
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("@/server/kml/kml-import", () => ({
  loadKmlFromUrl: async (url: string) => {
    state.fetchedUrls.push(url);
    return "<kml>neu</kml>";
  },
}));

import { createArea, listAreas } from "@/server/areas/areas";
import {
  createImageOverlay,
  listImageOverlays,
} from "@/server/image-overlays/image-overlays";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { createKmlOverlay, listKmlOverlays } from "@/server/kml/kml-overlays";
import {
  createMapSymbol,
  generateDeviceLink,
  listMapSymbols,
} from "@/server/mapsymbols/map-symbols";
import { insertOperation } from "@/server/operations/operations";
import { createViewLink, listViewLinks } from "@/server/viewlinks/view-links";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import { multipartRequest, routeParams } from "@/test/upload-request";
import {
  deleteAreaAction,
  updateAreaGeometryAction,
  updateAreaStyleAction,
} from "./area-actions";
import {
  deleteImageOverlayAction,
  setImageOverlayVisibilityAction,
  updateImageOverlayPlacementAction,
} from "./image-overlay-actions";
import {
  reloadKmlAction,
  removeKmlAction,
  setKmlVisibilityAction,
} from "./kml-actions";
import {
  deleteMapSymbolAction,
  generateDeviceLinkAction,
  moveMapSymbolAction,
  removeDeviceLinkAction,
  updateMapSymbolCompositionAction,
} from "./map-symbol-actions";
import { PUT as replaceImageOverlayFile } from "./overlays/[overlayId]/route";
import { deleteViewLinkAction } from "./view-link-actions";

interface Objects {
  symbolId: string;
  areaId: string;
  kmlId: string;
  imageId: string;
  viewLinkId: string;
}

let dir: string;
const originalUploadsDir = process.env.UPLOADS_DIR;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = await signIn(state.db as Db);
  state.fetchedUrls = [];
  const parent = await mkdtemp(join(tmpdir(), "einsatz-foreign-"));
  dir = join(parent, "uploads");
  await mkdir(dir);
  process.env.UPLOADS_DIR = dir;
});

afterEach(async () => {
  if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
  else process.env.UPLOADS_DIR = originalUploadsDir;
  await rm(dirname(dir), { recursive: true, force: true });
});

describe.each<{
  name: string;
  error: string;
  call: (otherOperationId: string, objects: Objects) => Promise<ActionResult>;
}>([
  {
    name: "moving a Kartenzeichen",
    error: "Kartenzeichen nicht gefunden.",
    call: (op, o) => moveMapSymbolAction(op, o.symbolId, 50, 8),
  },
  {
    name: "changing a Kartenzeichen's composition",
    error: "Kartenzeichen nicht gefunden.",
    call: (op, o) =>
      updateMapSymbolCompositionAction(op, o.symbolId, { text: "neu" }),
  },
  {
    name: "deleting a Kartenzeichen",
    error: "Kartenzeichen nicht gefunden.",
    call: (op, o) => deleteMapSymbolAction(op, o.symbolId),
  },
  {
    name: "generating a Gerätelink",
    error: "Kartenzeichen nicht gefunden.",
    call: (op, o) => generateDeviceLinkAction(op, o.symbolId),
  },
  {
    name: "removing a Gerätelink",
    error: "Kartenzeichen nicht gefunden.",
    call: (op, o) => removeDeviceLinkAction(op, o.symbolId),
  },
  {
    name: "changing a Bereich's style",
    error: "Bereich nicht gefunden.",
    call: (op, o) =>
      updateAreaStyleAction(op, o.areaId, {
        color: "#000000",
        opacity: 1,
        label: "neu",
      }),
  },
  {
    name: "changing a Bereich's geometry",
    error: "Bereich nicht gefunden.",
    call: (op, o) =>
      updateAreaGeometryAction(op, o.areaId, {
        shape: "circle",
        center: { lat: 50, lng: 8 },
        radius: 10,
      }),
  },
  {
    name: "deleting a Bereich",
    error: "Bereich nicht gefunden.",
    call: (op, o) => deleteAreaAction(op, o.areaId),
  },
  {
    name: "hiding a KML-Ebene",
    error: "KML-Overlay nicht gefunden.",
    call: (op, o) => setKmlVisibilityAction(op, o.kmlId, false),
  },
  {
    name: "reloading a KML-Ebene",
    error: "KML-Overlay nicht gefunden.",
    call: (op, o) => reloadKmlAction(op, o.kmlId),
  },
  {
    name: "removing a KML-Ebene",
    error: "KML-Overlay nicht gefunden.",
    call: (op, o) => removeKmlAction(op, o.kmlId),
  },
  {
    name: "placing a Bild-Overlay",
    error: "Bild-Overlay nicht gefunden.",
    call: (op, o) =>
      updateImageOverlayPlacementAction(op, o.imageId, {
        centerLat: 50,
        centerLng: 8,
        scaleM: 10,
        rotationDeg: 0,
        opacity: 1,
      }),
  },
  {
    name: "hiding a Bild-Overlay",
    error: "Bild-Overlay nicht gefunden.",
    call: (op, o) => setImageOverlayVisibilityAction(op, o.imageId, false),
  },
  {
    name: "deleting a Bild-Overlay",
    error: "Bild-Overlay nicht gefunden.",
    call: (op, o) => deleteImageOverlayAction(op, o.imageId),
  },
  {
    name: "replacing a Bild-Overlay's file",
    error: "Bild-Overlay nicht gefunden.",
    call: async (op, o) => {
      const form = new FormData();
      form.append("file", await aPng());
      const response = await replaceImageOverlayFile(
        await multipartRequest("PUT", form),
        routeParams({ id: op, overlayId: o.imageId }),
      );
      return response.json();
    },
  },
  {
    name: "deleting an Ansichtslink",
    error: "Ansichtslink nicht gefunden.",
    call: (op, o) => deleteViewLinkAction(op, o.viewLinkId),
  },
])("$name under another Einsatz", ({ error, call }) => {
  it("reports the object as not found and changes nothing", async () => {
    const a = await anOperation("A");
    const b = await anOperation("B");
    const objects = await oneOfEachIn(a.id);
    const before = await everythingIn(a.id);

    const result = await call(b.id, objects);

    expect(result).toEqual({ error });
    expect(await everythingIn(a.id)).toEqual(before);
    expect(state.fetchedUrls).toEqual([]);
  });
});

function anOperation(name: string) {
  return insertOperation(state.db as Db, { name, description: null });
}

async function oneOfEachIn(operationId: string): Promise<Objects> {
  const db = state.db as Db;
  const symbol = await createMapSymbol(db, {
    operationId,
    composition: { grundzeichen: "kraftfahrzeug-landgebunden" },
    lat: 53.55,
    lng: 9.99,
  });
  await generateDeviceLink(db, operationId, symbol.id);
  const area = await createArea(db, {
    operationId,
    geometry: { shape: "circle", center: { lat: 53.5, lng: 10 }, radius: 100 },
    color: "#e2001a",
    opacity: 0.4,
    label: "Zone",
  });
  const kml = await createKmlOverlay(db, {
    operationId,
    sourceType: "url",
    sourceUrl: "https://example.org/pegel.kml",
    name: "Pegel",
    content: "<kml>alt</kml>",
  });
  const image = await createImageOverlay(db, {
    operationId,
    filePath: await storeOverlayImage(operationId, Buffer.from("alt")),
    name: "Plan",
    widthPx: 1000,
    heightPx: 1000,
    placement: {
      centerLat: 53.55,
      centerLng: 9.99,
      scaleM: 500,
      rotationDeg: 30,
      opacity: 0.8,
    },
  });
  const viewLink = await createViewLink(db, {
    operationId,
    label: "Leitstelle",
  });
  return {
    symbolId: symbol.id,
    areaId: area.id,
    kmlId: kml.id,
    imageId: image.id,
    viewLinkId: viewLink.id,
  };
}

/** Alle Objekte eines Einsatzes und alle Dateien im Upload-Verzeichnis. */
async function everythingIn(operationId: string) {
  const db = state.db as Db;
  return {
    mapSymbols: await listMapSymbols(db, operationId),
    areas: await listAreas(db, operationId),
    kmlOverlays: await listKmlOverlays(db, operationId),
    imageOverlays: await listImageOverlays(db, operationId),
    viewLinks: await listViewLinks(db, operationId),
    files: await filesUnderUploads(),
  };
}

async function filesUnderUploads(): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort();
}

async function aPng(): Promise<File> {
  const png = await sharp({
    create: { width: 20, height: 10, channels: 3, background: "#123456" },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(png)], "neu.png", { type: "image/png" });
}
