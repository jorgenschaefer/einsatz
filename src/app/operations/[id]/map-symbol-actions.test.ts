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

import { subscribeOperation } from "@/server/events/operation-events";
import {
  createMapSymbol,
  generateDeviceLink,
  listMapSymbols,
  reportPosition,
  resolveDeviceAccess,
} from "@/server/mapsymbols/map-symbols";
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
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import * as actions from "./map-symbol-actions";

const {
  deleteMapSymbolAction,
  generateDeviceLinkAction,
  moveMapSymbolAction,
  placeMapSymbolAction,
  removeDeviceLinkAction,
  updateMapSymbolCompositionAction,
} = actions;

const NOT_FOUND = "Kartenzeichen nicht gefunden.";
const INVALID_COMPOSITION = "Ungültige Zeichen-Komposition.";
const INVALID_COORDINATES = "Ungültige Koordinaten.";

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
    placeMapSymbolAction: [
      rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
        placeMapSymbolAction(NOT_A_UUID, { text: "A" }, 50, 8),
      ),
      rejects("a composition of null", INVALID_COMPOSITION, (f) =>
        placeMapSymbolAction(f.operationId, null as Bad, 50, 8),
      ),
      rejects("a composition as text", INVALID_COMPOSITION, (f) =>
        placeMapSymbolAction(f.operationId, "A" as Bad, 50, 8),
      ),
      rejects("lat as text", INVALID_COORDINATES, (f) =>
        placeMapSymbolAction(f.operationId, { text: "A" }, "50" as Bad, 8),
      ),
      rejects("lng of null", INVALID_COORDINATES, (f) =>
        placeMapSymbolAction(f.operationId, { text: "A" }, 50, null as Bad),
      ),
      rejects("a Bezeichnung of 201", tooLong("Die Bezeichnung", "200"), (f) =>
        placeMapSymbolAction(f.operationId, { text: text(201) }, 50, 8),
      ),
      rejects("an axis of 201", INVALID_COMPOSITION, (f) =>
        placeMapSymbolAction(f.operationId, { einheit: text(201) }, 50, 8),
      ),
    ],
    moveMapSymbolAction: [
      ...idCalls("symbolId", (op, id) => moveMapSymbolAction(op, id, 50, 8)),
      rejects("lat of null", INVALID_COORDINATES, (f) =>
        moveMapSymbolAction(f.operationId, f.symbolId, null as Bad, 8),
      ),
      rejects("lng as text", INVALID_COORDINATES, (f) =>
        moveMapSymbolAction(f.operationId, f.symbolId, 50, "8" as Bad),
      ),
    ],
    updateMapSymbolCompositionAction: [
      ...idCalls("symbolId", (op, id) =>
        updateMapSymbolCompositionAction(op, id, { text: "B" }),
      ),
      rejects("a composition of null", INVALID_COMPOSITION, (f) =>
        updateMapSymbolCompositionAction(
          f.operationId,
          f.symbolId,
          null as Bad,
        ),
      ),
      rejects("a composition as text", INVALID_COMPOSITION, (f) =>
        updateMapSymbolCompositionAction(f.operationId, f.symbolId, "A" as Bad),
      ),
      rejects("a Bezeichnung of 201", tooLong("Die Bezeichnung", "200"), (f) =>
        updateMapSymbolCompositionAction(f.operationId, f.symbolId, {
          text: text(201),
        }),
      ),
    ],
    deleteMapSymbolAction: idCalls("symbolId", deleteMapSymbolAction),
    generateDeviceLinkAction: idCalls("symbolId", generateDeviceLinkAction),
    removeDeviceLinkAction: idCalls("symbolId", removeDeviceLinkAction),
  },
  { db, actAs },
);

expectForeignObjectsRejected(
  actions,
  {
    placeMapSymbolAction: "takes only the Einsatz-ID",
    moveMapSymbolAction: {
      error: NOT_FOUND,
      call: (a, b) => moveMapSymbolAction(b, a.symbolId, 50, 8),
    },
    updateMapSymbolCompositionAction: {
      error: NOT_FOUND,
      call: (a, b) =>
        updateMapSymbolCompositionAction(b, a.symbolId, { text: "neu" }),
    },
    deleteMapSymbolAction: {
      error: NOT_FOUND,
      call: (a, b) => deleteMapSymbolAction(b, a.symbolId),
    },
    generateDeviceLinkAction: {
      error: NOT_FOUND,
      call: (a, b) => generateDeviceLinkAction(b, a.symbolId),
    },
    removeDeviceLinkAction: {
      error: NOT_FOUND,
      call: (a, b) => removeDeviceLinkAction(b, a.symbolId),
    },
  },
  { db, actAs },
);

async function aSymbolWithDeviceLink() {
  const op = await insertOperation(db(), { name: "Lage", description: null });
  const symbol = await createMapSymbol(db(), {
    operationId: op.id,
    composition: { grundzeichen: "kraftfahrzeug-landgebunden" },
    lat: 53.55,
    lng: 10,
  });
  const token = await generateDeviceLink(db(), symbol.operationId, symbol.id);
  return { op, symbol, token };
}

describe("removeDeviceLinkAction", () => {
  beforeEach(() => actAs("user"));

  it("ends the device's access and tells open clients, keeping the Kartenzeichen", async () => {
    const { op, symbol, token } = await aSymbolWithDeviceLink();
    const listener = vi.fn();
    const unsubscribe = subscribeOperation(op.id, listener);

    let result: unknown;
    try {
      result = await removeDeviceLinkAction(op.id, symbol.id);
    } finally {
      unsubscribe();
    }

    expect(result).toEqual({});
    expect(listener).toHaveBeenCalledTimes(1);
    expect(await resolveDeviceAccess(db(), token)).toBeNull();
    const [after] = await listMapSymbols(db(), op.id);
    expect(after).toEqual({ ...symbol, deviceLinkToken: null });
  });

  it("places a Kartenzeichen whose device had reported by hand again", async () => {
    const { op, symbol, token } = await aSymbolWithDeviceLink();
    await reportPosition(db(), token, 53.6, 10.1);

    await removeDeviceLinkAction(op.id, symbol.id);

    const [after] = await listMapSymbols(db(), op.id);
    expect(after).toMatchObject({
      lat: 53.6,
      lng: 10.1,
      positionSource: "manual",
    });
  });
});
