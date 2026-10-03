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
import { getOperation, insertOperation } from "@/server/operations/operations";
import {
  type ActAs,
  expectBadCallsRejected,
  expectEveryActionRequiresLogin,
  expectForeignObjectsRejected,
} from "@/test/action-checks";
import {
  type Bad,
  INVALID_ID,
  NOT_A_UUID,
  rejects,
} from "@/test/bad-calls/bad-call";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import * as actions from "./actions";

const { setDefaultViewAction } = actions;

const INVALID_VIEW = "Der Kartenausschnitt ist ungültig.";

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
    setDefaultViewAction: [
      rejects("a non-UUID Einsatz-ID", INVALID_ID, () =>
        setDefaultViewAction(NOT_A_UUID, { lat: 50, lng: 8, zoom: 10 }),
      ),
      rejects("a view of null", INVALID_VIEW, (f) =>
        setDefaultViewAction(f.operationId, null as Bad),
      ),
      rejects("a view as text", INVALID_VIEW, (f) =>
        setDefaultViewAction(f.operationId, "Hamburg" as Bad),
      ),
      rejects("a view as an array", INVALID_VIEW, (f) =>
        setDefaultViewAction(f.operationId, [] as Bad),
      ),
      rejects("a zoom of NaN", "Ungültige Zoomstufe.", (f) =>
        setDefaultViewAction(f.operationId, {
          lat: 50,
          lng: 8,
          zoom: Number.NaN,
        }),
      ),
      rejects("a lat as a BigInt", "Ungültige Koordinaten.", (f) =>
        setDefaultViewAction(f.operationId, {
          lat: BigInt(50) as Bad,
          lng: 8,
          zoom: 10,
        }),
      ),
    ],
  },
  { db, actAs },
);

expectForeignObjectsRejected(
  actions,
  { setDefaultViewAction: "takes only the Einsatz-ID" },
  { db, actAs },
);

describe("setDefaultViewAction", () => {
  it("stores the Einsatz's default view and tells open clients", async () => {
    await actAs("user");
    const op = await insertOperation(db(), { name: "Lage", description: null });
    const view = { lat: 53.55, lng: 9.99, zoom: 12 };
    const listener = vi.fn();
    const unsubscribe = subscribeOperation(op.id, listener);

    let result: unknown;
    try {
      result = await setDefaultViewAction(op.id, view);
    } finally {
      unsubscribe();
    }

    expect(result).toEqual({});
    expect(listener).toHaveBeenCalledTimes(1);
    expect((await getOperation(db(), op.id))?.defaultView).toEqual(view);
  });
});
