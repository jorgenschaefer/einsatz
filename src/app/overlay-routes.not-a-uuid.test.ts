import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("@/server/auth/current-user", () => ({
  requireUser: async () => ({ id: "u1", username: "anna", role: "user" }),
}));

import { GET as deviceOverlayGET } from "@/app/device/[token]/overlays/[overlayId]/route";
import { GET as operationOverlayGET } from "@/app/operations/[id]/overlays/[overlayId]/route";
import { GET as viewOverlayGET } from "@/app/view/[token]/overlays/[overlayId]/route";
import type { Db } from "@/server/db/db";
import {
  createMapSymbol,
  generateDeviceLink,
} from "@/server/mapsymbols/map-symbols";
import { insertOperation } from "@/server/operations/operations";
import { createViewLink } from "@/server/viewlinks/view-links";
import { freshDb } from "@/test/db";

const NOT_A_UUID = "marker-icon.png";
const request = () => new Request("http://localhost/");

async function anOperation() {
  state.db = await freshDb();
  return insertOperation(state.db as Db, { name: "Lage", description: null });
}

describe("overlay image routes with an overlay id that is not a UUID", () => {
  it("answers 404 in the Lageansicht", async () => {
    const op = await anOperation();

    const res = await operationOverlayGET(request(), {
      params: Promise.resolve({ id: op.id, overlayId: NOT_A_UUID }),
    });

    expect(res.status).toBe(404);
  });

  it("answers 404 behind an Ansichtslink", async () => {
    const op = await anOperation();
    const link = await createViewLink(state.db as Db, {
      operationId: op.id,
      label: "Leitstelle",
    });

    const res = await viewOverlayGET(request(), {
      params: Promise.resolve({ token: link.token, overlayId: NOT_A_UUID }),
    });

    expect(res.status).toBe(404);
  });

  it("answers 404 behind a Gerätelink", async () => {
    const op = await anOperation();
    const symbol = await createMapSymbol(state.db as Db, {
      operationId: op.id,
      composition: {
        grundzeichen: "kraftfahrzeug-landgebunden",
        fachaufgabe: "rettungswesen",
        organisation: "hilfsorganisation",
      },
      lat: 53.55,
      lng: 9.99,
    });
    const token = await generateDeviceLink(state.db as Db, symbol.id);

    const res = await deviceOverlayGET(request(), {
      params: Promise.resolve({ token, overlayId: NOT_A_UUID }),
    });

    expect(res.status).toBe(404);
  });
});
