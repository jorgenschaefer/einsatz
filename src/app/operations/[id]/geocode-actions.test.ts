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
vi.mock("@/server/geocoder/photon", () => ({
  photonGeocoder: {
    geocode: async (query: string) => {
      state.photonQueries.push(query);
      return [{ label: "Hamburg", lat: 53.55, lng: 9.99 }];
    },
  },
}));

import { geocodeGate } from "@/server/geocoder/geocode-service";
import { freshDb } from "@/test/db";
import { signIn } from "@/test/sign-in";
import { geocodeAddressAction } from "./geocode-actions";

// Server Actions nehmen, was der Client schickt – die Typen hier lügen absichtlich.
// biome-ignore lint/suspicious/noExplicitAny: bewusst falsch getypte Eingaben
type Bad = any;

beforeEach(async () => {
  state.db = await freshDb();
  state.token = await signIn(state.db as Db);
  state.photonQueries = [];
  geocodeGate.reset();
});

describe("geocodeAddressAction", () => {
  it("finds the address Photon finds", async () => {
    expect(await geocodeAddressAction("Hamburg")).toEqual([
      { label: "Hamburg", lat: 53.55, lng: 9.99 },
    ]);
  });

  it.each([
    ["a number", 12345],
    ["null", null],
    ["an object", { query: "Hamburg" }],
  ])(
    "finds nothing for %s as query, without asking Photon",
    async (_, query) => {
      expect(await geocodeAddressAction(query as Bad)).toEqual([]);

      expect(state.photonQueries).toEqual([]);
    },
  );
});
