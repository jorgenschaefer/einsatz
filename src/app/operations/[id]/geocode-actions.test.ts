import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

// IO-/Trust-Grenzen faken, damit die echte Action-Logik unverändert läuft.
const state = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as string | undefined,
  photonQueries: [] as string[],
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
  }),
}));
vi.mock("next/navigation", async (original) => ({
  ...(await original<object>()),
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectTo: to });
  },
}));
vi.mock("@/server/geocoder/photon", () => ({
  photonGeocoder: {
    geocode: async (query: string) => {
      state.photonQueries.push(query);
      return [{ label: "Hamburg", lat: 53.55, lng: 9.99 }];
    },
  },
}));

import { geocodeGate } from "@/server/geocoder/geocode-service";
import {
  type ActAs,
  expectBadCallsRejected,
  expectEveryActionRequiresLogin,
  expectForeignObjectsRejected,
} from "@/test/action-checks";
import { type Bad, noHits, text } from "@/test/bad-calls/bad-call";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import * as actions from "./geocode-actions";

const { geocodeAddressAction } = actions;

const actAs: ActAs = async (caller) => {
  state.token =
    caller === "anonymous" ? undefined : await signIn(state.db as Db, caller);
};
const db = () => state.db as Db;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = undefined;
  state.photonQueries = [];
  geocodeGate.reset();
});

expectEveryActionRequiresLogin(actions, { actAs });

// Photon fände immer einen Treffer: keine Treffer heißt, Photon wurde nicht gefragt.
expectBadCallsRejected(
  actions,
  {
    geocodeAddressAction: [
      noHits("a query as a number", () => geocodeAddressAction(12345 as Bad)),
      noHits("a query of null", () => geocodeAddressAction(null as Bad)),
      noHits("a query as an object", () => geocodeAddressAction({} as Bad)),
      noHits("a query of 201", () => geocodeAddressAction(`Ha${text(199)}`)),
    ],
  },
  { db, actAs },
);

expectForeignObjectsRejected(
  actions,
  { geocodeAddressAction: "takes no Einsatz-ID" },
  { db, actAs },
);

describe("geocodeAddressAction", () => {
  it("finds the address Photon finds", async () => {
    await actAs("user");

    expect(await geocodeAddressAction("Hamburg")).toEqual([
      { label: "Hamburg", lat: 53.55, lng: 9.99 },
    ]);
  });
});
