import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));

import { createImageOverlay } from "@/server/image-overlays/image-overlays";
import {
  createMapSymbol,
  generateDeviceLink,
} from "@/server/mapsymbols/map-symbols";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { snapshotDb } from "@/test/db-snapshot";
import {
  expectNonUuidObjectIdRefused,
  expectRouteRequiresToken,
} from "@/test/route-checks";
import { routeParams } from "@/test/upload-request";
import * as route from "./route";
import { GET } from "./route";

const db = () => state.db as Db;

let token: string;

beforeEach(async () => {
  state.db = await freshDb();
  token = await aLinkTo((await anOperation("Lage")).id);
});

const get = (overlayId: string, linkToken = token) =>
  GET(
    new Request("http://localhost/"),
    routeParams({ token: linkToken, overlayId }),
  );

expectRouteRequiresToken(route, {
  GET: { send: (noLink) => get(randomUUID(), noLink) },
});

expectNonUuidObjectIdRefused(route, {
  GET: {
    send: () => get("marker-icon.png"),
    answer: { status: 404 },
    stored: () => snapshotDb(db()),
  },
});

describe("device overlay route", () => {
  it("answers 404 for an overlay of another Einsatz", async () => {
    const other = await anOperation("Andere Lage");
    const overlay = await createImageOverlay(db(), {
      operationId: other.id,
      filePath: `${other.id}/karte.png`,
      name: "Karte",
      widthPx: 1000,
      heightPx: 1000,
      placement: {
        centerLat: 53.55,
        centerLng: 9.99,
        scaleM: 500,
        rotationDeg: 0,
        opacity: 1,
      },
    });

    const res = await get(overlay.id);

    expect(res.status).toBe(404);
  });
});

function anOperation(name: string) {
  return insertOperation(db(), { name, description: null });
}

async function aLinkTo(operationId: string) {
  const symbol = await createMapSymbol(db(), {
    operationId,
    composition: {},
    lat: 53.55,
    lng: 9.99,
  });
  return generateDeviceLink(db(), operationId, symbol.id);
}
