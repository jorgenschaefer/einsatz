import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("@/server/geocoder/geocode-service", () => ({
  geocodeQueryForTokenLink: vi.fn(),
}));

import { geocodeQueryForTokenLink } from "@/server/geocoder/geocode-service";
import {
  createMapSymbol,
  generateDeviceLink,
} from "@/server/mapsymbols/map-symbols";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { expectRouteRequiresToken } from "@/test/route-checks";
import { routeParams } from "@/test/upload-request";
import * as route from "./route";
import { GET } from "./route";

const call = (token: string, q = "hamburg") =>
  GET(new Request(`http://localhost/?q=${q}`), routeParams({ token }));

beforeEach(async () => {
  state.db = await freshDb();
});

expectRouteRequiresToken(route, { GET: { send: (token) => call(token) } });

describe("device geocode route", () => {
  it("returns the geocoder hits for the query when the token has access", async () => {
    const db = state.db as Db;
    const op = await insertOperation(db, { name: "Lage", description: null });
    const symbol = await createMapSymbol(db, {
      operationId: op.id,
      composition: {},
      lat: 53.55,
      lng: 9.99,
    });
    const token = await generateDeviceLink(db, op.id, symbol.id);
    vi.mocked(geocodeQueryForTokenLink).mockImplementation(async (q) => [
      { label: q, lat: 53.5, lng: 9.9 },
    ]);

    const res = await call(token, "Rathaus");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { label: "Rathaus", lat: 53.5, lng: 9.9 },
    ]);
  });
});
