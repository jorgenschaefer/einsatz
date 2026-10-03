import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Action-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
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
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));

import type { AreaGeometry } from "@/map/area";
import { createArea, listAreas } from "@/server/areas/areas";
import { subscribeOperation } from "@/server/events/operation-events";
import { insertOperation } from "@/server/operations/operations";
import {
  type ActAs,
  expectBadCallsRejected,
  expectEveryActionRequiresLogin,
  expectForeignObjectsRejected,
} from "@/test/action-checks";
import {
  type Bad,
  INVALID_ID,
  idCalls,
  NOT_A_UUID,
  rejects,
  text,
  tooLong,
} from "@/test/bad-calls/bad-call";
import { STYLE } from "@/test/bad-calls/fixture";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import * as actions from "./area-actions";

const {
  createAreaAction,
  deleteAreaAction,
  updateAreaGeometryAction,
  updateAreaStyleAction,
} = actions;

const NOT_FOUND = "Bereich nicht gefunden.";
const INVALID_GEOMETRY = "Ungültige Bereichsgeometrie.";
const INVALID_COORDINATES = "Ungültige Koordinaten.";
const INVALID_STYLE = "Ungültige Darstellung des Bereichs.";
const HEX_COLOR = "Die Farbe muss # und sechs Hex-Ziffern sein, etwa #e2001a.";
const A_POINT = { lat: 50, lng: 8 };
const CIRCLE: AreaGeometry = { shape: "circle", center: A_POINT, radius: 10 };

const actAs: ActAs = async (caller) => {
  state.token =
    caller === "anonymous" ? undefined : await signIn(state.db as Db, caller);
};
const db = () => state.db as Db;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
});

expectEveryActionRequiresLogin(actions, { actAs });

expectBadCallsRejected(
  actions,
  {
    createAreaAction: [
      rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
        createAreaAction(NOT_A_UUID, CIRCLE),
      ),
      rejects("a geometry of null", INVALID_GEOMETRY, (f) =>
        createAreaAction(f.operationId, null as Bad),
      ),
      rejects('the shape "triangle"', "Unbekannte Bereichsform.", (f) =>
        createAreaAction(f.operationId, {
          shape: "triangle",
          points: [],
        } as Bad),
      ),
      rejects("a polygon without points", INVALID_GEOMETRY, (f) =>
        createAreaAction(f.operationId, { shape: "polygon" } as Bad),
      ),
      rejects("a polygon point that is no object", INVALID_COORDINATES, (f) =>
        createAreaAction(f.operationId, {
          shape: "polygon",
          points: [A_POINT, A_POINT, null],
        } as Bad),
      ),
      rejects(
        "a polygon of 2 points",
        "Ein Polygon braucht mindestens 3 Punkte.",
        (f) =>
          createAreaAction(f.operationId, {
            shape: "polygon",
            points: [A_POINT, A_POINT],
          }),
      ),
      rejects(
        "a line of 1 point",
        "Eine Linie braucht mindestens 2 Punkte.",
        (f) =>
          createAreaAction(f.operationId, { shape: "line", points: [A_POINT] }),
      ),
      rejects("a circle without centre", INVALID_COORDINATES, (f) =>
        createAreaAction(f.operationId, { shape: "circle", radius: 10 } as Bad),
      ),
      rejects("a radius as text", "Der Radius muss größer als 0 sein.", (f) =>
        createAreaAction(f.operationId, { ...CIRCLE, radius: "10" } as Bad),
      ),
      rejects("a point at infinity", INVALID_COORDINATES, (f) =>
        createAreaAction(f.operationId, {
          shape: "line",
          points: [A_POINT, { lat: Number.POSITIVE_INFINITY, lng: 8 }],
        }),
      ),
    ],
    updateAreaStyleAction: [
      ...idCalls("areaId", (op, id) => updateAreaStyleAction(op, id, STYLE)),
      rejects("a style of null", INVALID_STYLE, (f) =>
        updateAreaStyleAction(f.operationId, f.areaId, null as Bad),
      ),
      rejects("a style as text", INVALID_STYLE, (f) =>
        updateAreaStyleAction(f.operationId, f.areaId, "rot" as Bad),
      ),
      ...["red", "#e2001", "#e2001aa", "#gg001a"].map((color) =>
        rejects(`the colour "${color}"`, HEX_COLOR, (f) =>
          updateAreaStyleAction(f.operationId, f.areaId, { ...STYLE, color }),
        ),
      ),
      rejects(
        "an opacity as text",
        "Die Deckkraft muss zwischen 0 und 1 liegen.",
        (f) =>
          updateAreaStyleAction(f.operationId, f.areaId, {
            ...STYLE,
            opacity: "1" as Bad,
          }),
      ),
      rejects(
        "a Beschriftung as a number",
        "Die Beschriftung muss Text sein.",
        (f) =>
          updateAreaStyleAction(f.operationId, f.areaId, {
            ...STYLE,
            label: 7 as Bad,
          }),
      ),
      rejects(
        "a Beschriftung of 201",
        tooLong("Die Beschriftung", "200"),
        (f) =>
          updateAreaStyleAction(f.operationId, f.areaId, {
            ...STYLE,
            label: text(201),
          }),
      ),
    ],
    updateAreaGeometryAction: [
      ...idCalls("areaId", (op, id) =>
        updateAreaGeometryAction(op, id, CIRCLE),
      ),
      rejects("a geometry as text", INVALID_GEOMETRY, (f) =>
        updateAreaGeometryAction(f.operationId, f.areaId, "circle" as Bad),
      ),
      rejects("line points as text", INVALID_GEOMETRY, (f) =>
        updateAreaGeometryAction(f.operationId, f.areaId, {
          shape: "line",
          points: "1,2",
        } as Bad),
      ),
      rejects('the shape "point"', "Unbekannte Bereichsform.", (f) =>
        updateAreaGeometryAction(f.operationId, f.areaId, {
          shape: "point",
          center: A_POINT,
        } as Bad),
      ),
      rejects(
        "a line of 1 point",
        "Eine Linie braucht mindestens 2 Punkte.",
        (f) =>
          updateAreaGeometryAction(f.operationId, f.areaId, {
            shape: "line",
            points: [A_POINT],
          }),
      ),
    ],
    deleteAreaAction: idCalls("areaId", deleteAreaAction),
  },
  { db, actAs },
);

expectForeignObjectsRejected(
  actions,
  {
    createAreaAction: "takes only the Einsatz-ID",
    updateAreaStyleAction: {
      error: NOT_FOUND,
      call: (a, b) =>
        updateAreaStyleAction(b, a.areaId, {
          color: "#000000",
          opacity: 1,
          label: "neu",
        }),
    },
    updateAreaGeometryAction: {
      error: NOT_FOUND,
      call: (a, b) => updateAreaGeometryAction(b, a.areaId, CIRCLE),
    },
    deleteAreaAction: {
      error: NOT_FOUND,
      call: (a, b) => deleteAreaAction(b, a.areaId),
    },
  },
  { db, actAs },
);

function anOperation() {
  return insertOperation(db(), { name: "Lage", description: null });
}

describe("createAreaAction", () => {
  it("returns the id of the new Bereich, drawn in the default style, and tells open clients", async () => {
    await actAs("user");
    const op = await anOperation();
    const listener = vi.fn();
    const unsubscribe = subscribeOperation(op.id, listener);

    let result: unknown;
    try {
      result = await createAreaAction(op.id, CIRCLE);
    } finally {
      unsubscribe();
    }

    const [area] = await listAreas(db(), op.id);
    expect(result).toEqual({ id: area.id });
    expect(area).toMatchObject({
      geometry: CIRCLE,
      color: "#e2001a",
      opacity: 0.4,
      label: "",
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it("returns no id when the Bereich is refused", async () => {
    await actAs("user");
    const op = await anOperation();

    const result = await createAreaAction(op.id, { ...CIRCLE, radius: 0 });

    expect(result.error).toBe("Der Radius muss größer als 0 sein.");
    expect(result.id).toBeUndefined();
  });
});

describe("updateAreaStyleAction", () => {
  it("stores a Beschriftung of 200 characters", async () => {
    await actAs("user");
    const op = await anOperation();
    const { id } = await createArea(db(), {
      operationId: op.id,
      geometry: CIRCLE,
      ...STYLE,
    });
    const label = text(200);

    expect(await updateAreaStyleAction(op.id, id, { ...STYLE, label })).toEqual(
      {},
    );

    const [area] = await listAreas(db(), op.id);
    expect(area.label).toBe(label);
  });
});
