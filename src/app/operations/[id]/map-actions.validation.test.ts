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
import { createKmlOverlay, listKmlOverlays } from "@/server/kml/kml-overlays";
import {
  createMapSymbol,
  listMapSymbols,
} from "@/server/mapsymbols/map-symbols";
import { getOperation, insertOperation } from "@/server/operations/operations";
import { createViewLink, listViewLinks } from "@/server/viewlinks/view-links";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import { setDefaultViewAction } from "./actions";
import {
  createAreaAction,
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
  addKmlUrlAction,
  reloadKmlAction,
  removeKmlAction,
  setKmlVisibilityAction,
} from "./kml-actions";
import {
  deleteMapSymbolAction,
  generateDeviceLinkAction,
  moveMapSymbolAction,
  placeMapSymbolAction,
  removeDeviceLinkAction,
  updateMapSymbolCompositionAction,
} from "./map-symbol-actions";
import {
  createViewLinkAction,
  deleteViewLinkAction,
} from "./view-link-actions";

interface Objects {
  operationId: string;
  symbolId: string;
  areaId: string;
  kmlId: string;
  imageId: string;
  viewLinkId: string;
}

// Server Actions nehmen, was der Client schickt – die Typen hier lügen absichtlich.
// biome-ignore lint/suspicious/noExplicitAny: bewusst falsch getypte Eingaben
type Bad = any;

const INVALID_ID = "Ungültige ID.";
const NOT_A_UUID = "op-1";
const HEX_COLOR = "Die Farbe muss # und sechs Hex-Ziffern sein, etwa #e2001a.";
const STYLE = { color: "#e2001a", opacity: 0.4, label: "Zone" };
const PLACEMENT = {
  centerLat: 50,
  centerLng: 8,
  scaleM: 10,
  rotationDeg: 0,
  opacity: 1,
};
const CIRCLE = { shape: "circle", center: { lat: 50, lng: 8 }, radius: 10 };
const A_POINT = { lat: 50, lng: 8 };

type Call = (o: Objects) => Promise<ActionResult>;

type ObjectKey = Exclude<keyof Objects, "operationId">;

/**
 * Jede Lagekarten-Action einmal mit gültigen Argumenten außer den Ids, und
 * welches Objekt sie ändert (`null`: sie nimmt nur die Einsatz-ID).
 */
const withIds: [
  string,
  ObjectKey | null,
  (operationId: string, id: string) => Promise<ActionResult>,
][] = [
  [
    "setDefaultViewAction",
    null,
    (op) => setDefaultViewAction(op, { lat: 50, lng: 8, zoom: 10 }),
  ],
  [
    "placeMapSymbolAction",
    null,
    (op) => placeMapSymbolAction(op, { text: "A" }, 50, 8),
  ],
  [
    "moveMapSymbolAction",
    "symbolId",
    (op, id) => moveMapSymbolAction(op, id, 50, 8),
  ],
  [
    "updateMapSymbolCompositionAction",
    "symbolId",
    (op, id) => updateMapSymbolCompositionAction(op, id, { text: "neu" }),
  ],
  [
    "deleteMapSymbolAction",
    "symbolId",
    (op, id) => deleteMapSymbolAction(op, id),
  ],
  [
    "generateDeviceLinkAction",
    "symbolId",
    (op, id) => generateDeviceLinkAction(op, id),
  ],
  [
    "removeDeviceLinkAction",
    "symbolId",
    (op, id) => removeDeviceLinkAction(op, id),
  ],
  ["createAreaAction", null, (op) => createAreaAction(op, CIRCLE as Bad)],
  [
    "updateAreaStyleAction",
    "areaId",
    (op, id) => updateAreaStyleAction(op, id, STYLE),
  ],
  [
    "updateAreaGeometryAction",
    "areaId",
    (op, id) => updateAreaGeometryAction(op, id, CIRCLE as Bad),
  ],
  ["deleteAreaAction", "areaId", (op, id) => deleteAreaAction(op, id)],
  [
    "addKmlUrlAction",
    null,
    (op) => addKmlUrlAction(op, "Pegel", "https://example.org/neu.kml"),
  ],
  [
    "setKmlVisibilityAction",
    "kmlId",
    (op, id) => setKmlVisibilityAction(op, id, false),
  ],
  ["reloadKmlAction", "kmlId", (op, id) => reloadKmlAction(op, id)],
  ["removeKmlAction", "kmlId", (op, id) => removeKmlAction(op, id)],
  [
    "updateImageOverlayPlacementAction",
    "imageId",
    (op, id) => updateImageOverlayPlacementAction(op, id, PLACEMENT),
  ],
  [
    "setImageOverlayVisibilityAction",
    "imageId",
    (op, id) => setImageOverlayVisibilityAction(op, id, false),
  ],
  [
    "deleteImageOverlayAction",
    "imageId",
    (op, id) => deleteImageOverlayAction(op, id),
  ],
  [
    "createViewLinkAction",
    null,
    (op) => createViewLinkAction(op, "Leitstelle"),
  ],
  [
    "deleteViewLinkAction",
    "viewLinkId",
    (op, id) => deleteViewLinkAction(op, id),
  ],
];

const longText = (length: number) => "x".repeat(length);

const badCalls: [string, string, Call][] = [
  ...withIds.map(([action, object, call]): [string, string, Call] => [
    `${action} with an Einsatz-ID that is not a UUID`,
    INVALID_ID,
    (o) => call(NOT_A_UUID, object ? o[object] : ""),
  ]),
  ...withIds.flatMap(([action, object, call]): [string, string, Call][] =>
    object
      ? [
          [
            `${action} with an object ID that is not a UUID`,
            INVALID_ID,
            (o) => call(o.operationId, NOT_A_UUID),
          ],
        ]
      : [],
  ),

  // Falsche Typen
  [
    "a Kartenzeichen with composition null",
    "Ungültige Zeichen-Komposition.",
    (o) => placeMapSymbolAction(o.operationId, null as Bad, 50, 8),
  ],
  [
    "a Kartenzeichen with a composition as text",
    "Ungültige Zeichen-Komposition.",
    (o) =>
      updateMapSymbolCompositionAction(o.operationId, o.symbolId, "A" as Bad),
  ],
  [
    "a Kartenzeichen with lat as text",
    "Ungültige Koordinaten.",
    (o) => placeMapSymbolAction(o.operationId, { text: "A" }, "50" as Bad, 8),
  ],
  [
    "moving a Kartenzeichen with lng as text",
    "Ungültige Koordinaten.",
    (o) => moveMapSymbolAction(o.operationId, o.symbolId, 50, "8" as Bad),
  ],
  [
    "a Kartenzeichen Bezeichnung of 201 characters",
    "Die Bezeichnung darf höchstens 200 Zeichen lang sein.",
    (o) => placeMapSymbolAction(o.operationId, { text: longText(201) }, 50, 8),
  ],
  [
    "a Bereich with geometry null",
    "Ungültige Bereichsgeometrie.",
    (o) => createAreaAction(o.operationId, null as Bad),
  ],
  [
    "a Bereich with a geometry as text",
    "Ungültige Bereichsgeometrie.",
    (o) => updateAreaGeometryAction(o.operationId, o.areaId, "circle" as Bad),
  ],
  [
    "a Bereich with style null",
    "Ungültige Darstellung des Bereichs.",
    (o) => updateAreaStyleAction(o.operationId, o.areaId, null as Bad),
  ],
  [
    "a Bereich with a style as text",
    "Ungültige Darstellung des Bereichs.",
    (o) => updateAreaStyleAction(o.operationId, o.areaId, "rot" as Bad),
  ],
  [
    "a Bild-Overlay with placement null",
    "Ungültige Platzierung.",
    (o) =>
      updateImageOverlayPlacementAction(o.operationId, o.imageId, null as Bad),
  ],
  [
    "a Bild-Overlay with a placement as text",
    "Ungültige Platzierung.",
    (o) =>
      updateImageOverlayPlacementAction(o.operationId, o.imageId, "x" as Bad),
  ],
  [
    "a default view of null",
    "Der Kartenausschnitt ist ungültig.",
    (o) => setDefaultViewAction(o.operationId, null as Bad),
  ],
  [
    "a default view as text",
    "Der Kartenausschnitt ist ungültig.",
    (o) => setDefaultViewAction(o.operationId, "Hamburg" as Bad),
  ],
  [
    'a KML-Ebene visible as "yes"',
    "Die Sichtbarkeit muss wahr oder falsch sein.",
    (o) => setKmlVisibilityAction(o.operationId, o.kmlId, "yes" as Bad),
  ],
  [
    'a Bild-Overlay visible as "yes"',
    "Die Sichtbarkeit muss wahr oder falsch sein.",
    (o) =>
      setImageOverlayVisibilityAction(o.operationId, o.imageId, "yes" as Bad),
  ],
  [
    "a KML name as a number",
    "Der Name muss Text sein.",
    (o) =>
      addKmlUrlAction(o.operationId, 7 as Bad, "https://example.org/a.kml"),
  ],
  [
    "an Ansichtslink label as a number",
    "Die Bezeichnung muss Text sein.",
    (o) => createViewLinkAction(o.operationId, 7 as Bad),
  ],
  [
    "a Bereich label as a number",
    "Die Beschriftung muss Text sein.",
    (o) =>
      updateAreaStyleAction(o.operationId, o.areaId, {
        ...STYLE,
        label: 7 as Bad,
      }),
  ],

  // Bereichsformen
  [
    'a Bereich of shape "triangle"',
    "Unbekannte Bereichsform.",
    (o) =>
      createAreaAction(o.operationId, { shape: "triangle", points: [] } as Bad),
  ],
  [
    "a polygon without points",
    "Ungültige Bereichsgeometrie.",
    (o) => createAreaAction(o.operationId, { shape: "polygon" } as Bad),
  ],
  [
    "a line whose points are text",
    "Ungültige Bereichsgeometrie.",
    (o) =>
      updateAreaGeometryAction(o.operationId, o.areaId, {
        shape: "line",
        points: "1,2",
      } as Bad),
  ],
  [
    "a polygon with a point that is not an object",
    "Ungültige Koordinaten.",
    (o) =>
      createAreaAction(o.operationId, {
        shape: "polygon",
        points: [A_POINT, A_POINT, null],
      } as Bad),
  ],
  [
    "a circle without center",
    "Ungültige Koordinaten.",
    (o) =>
      createAreaAction(o.operationId, { shape: "circle", radius: 10 } as Bad),
  ],
  [
    "a polygon of 2 points",
    "Ein Polygon braucht mindestens 3 Punkte.",
    (o) =>
      createAreaAction(o.operationId, {
        shape: "polygon",
        points: [A_POINT, A_POINT],
      }),
  ],
  [
    "a line of 1 point",
    "Eine Linie braucht mindestens 2 Punkte.",
    (o) =>
      updateAreaGeometryAction(o.operationId, o.areaId, {
        shape: "line",
        points: [A_POINT],
      }),
  ],

  // Bereichsfarbe
  ...["red", "#e2001", "#e2001aa", "#gg001a"].map(
    (color): [string, string, Call] => [
      `a Bereich colour "${color}"`,
      HEX_COLOR,
      (o) =>
        updateAreaStyleAction(o.operationId, o.areaId, { ...STYLE, color }),
    ],
  ),

  // Längen
  [
    "a Bereich Beschriftung of 201 characters",
    "Die Beschriftung darf höchstens 200 Zeichen lang sein.",
    (o) =>
      updateAreaStyleAction(o.operationId, o.areaId, {
        ...STYLE,
        label: longText(201),
      }),
  ],
  [
    "an Ansichtslink label of 201 characters",
    "Die Bezeichnung darf höchstens 200 Zeichen lang sein.",
    (o) => createViewLinkAction(o.operationId, longText(201)),
  ],
  [
    "a KML name of 201 characters",
    "Der Name darf höchstens 200 Zeichen lang sein.",
    (o) =>
      addKmlUrlAction(
        o.operationId,
        longText(201),
        "https://example.org/a.kml",
      ),
  ],
];

beforeEach(async () => {
  state.db = await freshDb();
  state.token = await signIn(state.db as Db);
  state.fetchedUrls = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(badCalls)("%s", (_, error, call) => {
  it("is rejected with a message and stores nothing", async () => {
    const objects = await oneOfEach();
    const before = await everything(objects.operationId);

    const result = await call(objects);

    expect(result).toMatchObject({ error });
    expect(await everything(objects.operationId)).toEqual(before);
  });
});

describe.each<[string, string, unknown]>([
  ["as a number", "Die KML-URL muss Text sein.", 7],
  [
    "of 2,001 characters",
    "Die KML-URL darf höchstens 2.000 Zeichen lang sein.",
    `https://example.org/${longText(2001 - 20)}`,
  ],
])("a KML URL %s", (_, error, url) => {
  it("is rejected with a message before it is fetched, and adds nothing", async () => {
    const o = await oneOfEach();

    const result = await addKmlUrlAction(o.operationId, "Pegel", url as Bad);

    expect(result).toEqual({ error });
    expect(state.fetchedUrls).toEqual([]);
    expect(await listKmlOverlays(state.db as Db, o.operationId)).toHaveLength(
      1,
    );
  });
});

describe("the longest texts allowed", () => {
  it("stores a Bereich Beschriftung of 200 characters", async () => {
    const o = await oneOfEach();
    const label = longText(200);

    const result = await updateAreaStyleAction(o.operationId, o.areaId, {
      ...STYLE,
      label,
    });

    expect(result).toEqual({});
    const [area] = await listAreas(state.db as Db, o.operationId);
    expect(area.label).toBe(label);
  });

  it("stores an Ansichtslink label of 200 characters", async () => {
    const o = await oneOfEach();
    const label = longText(200);

    expect(await createViewLinkAction(o.operationId, label)).toEqual({});

    const labels = (await listViewLinks(state.db as Db, o.operationId)).map(
      (link) => link.label,
    );
    expect(labels).toContain(label);
  });

  it("fetches a KML URL of 2,000 characters", async () => {
    const o = await oneOfEach();
    const url = `https://example.org/${longText(2000 - 20)}`;

    expect(await addKmlUrlAction(o.operationId, "Pegel", url)).toEqual({});

    expect(state.fetchedUrls).toEqual([url]);
  });
});

async function oneOfEach(): Promise<Objects> {
  const db = state.db as Db;
  const { id: operationId } = await insertOperation(db, {
    name: "Lage",
    description: null,
  });
  const symbol = await createMapSymbol(db, {
    operationId,
    composition: { text: "Florian 1" },
    lat: 53.55,
    lng: 9.99,
  });
  const area = await createArea(db, {
    operationId,
    geometry: { shape: "circle", center: { lat: 53.5, lng: 10 }, radius: 100 },
    ...STYLE,
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
    filePath: `${operationId}/plan.webp`,
    name: "Plan",
    widthPx: 1000,
    heightPx: 1000,
    placement: { ...PLACEMENT, scaleM: 500 },
  });
  const viewLink = await createViewLink(db, {
    operationId,
    label: "Leitstelle",
  });
  return {
    operationId,
    symbolId: symbol.id,
    areaId: area.id,
    kmlId: kml.id,
    imageId: image.id,
    viewLinkId: viewLink.id,
  };
}

/** Alle Lagekarten-Objekte des Einsatzes, sein Standardausschnitt und die Zeilenzahl jeder Tabelle. */
async function everything(operationId: string) {
  const db = state.db as Db;
  return {
    defaultView: (await getOperation(db, operationId))?.defaultView,
    mapSymbols: await listMapSymbols(db, operationId),
    areas: await listAreas(db, operationId),
    kmlOverlays: await listKmlOverlays(db, operationId),
    imageOverlays: await listImageOverlays(db, operationId),
    viewLinks: await listViewLinks(db, operationId),
    rowCounts: await rowCounts(db),
  };
}

async function rowCounts(db: Db): Promise<Record<string, number>> {
  const tables = [
    "map_symbols",
    "areas",
    "kml_overlays",
    "image_overlays",
    "view_links",
  ];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${table}`,
    );
    counts[table] = rows[0].n;
  }
  return counts;
}
