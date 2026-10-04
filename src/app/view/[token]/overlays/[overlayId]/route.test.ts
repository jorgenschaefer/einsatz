import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));

import {
  createImageOverlay,
  setImageOverlayVisibility,
} from "@/server/image-overlays/image-overlays";
import { storeOverlayImage } from "@/server/image-overlays/image-storage";
import { insertOperation } from "@/server/operations/operations";
import { createViewLink } from "@/server/viewlinks/view-links";
import { freshDb } from "@/test/db";
import { snapshotDb } from "@/test/db-snapshot";
import { PLACEMENT } from "@/test/operation-fixture";
import {
  expectNonUuidObjectIdRefused,
  expectRouteRequiresToken,
} from "@/test/route-checks";
import { routeParams } from "@/test/upload-request";
import { uploadsDirPerTest } from "@/test/uploads-dir";
import * as route from "./route";
import { GET } from "./route";

const db = () => state.db as Db;

let operationId: string;
let token: string;

beforeEach(async () => {
  state.db = await freshDb();
  operationId = (await anOperation("Lage")).id;
  token = await aLinkTo(operationId);
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

describe("view overlay route", () => {
  uploadsDirPerTest();

  it("serves a visible overlay's image, and answers 404 once it is hidden", async () => {
    const overlay = await anImageOverlay(
      operationId,
      await storeOverlayImage(operationId, Buffer.from("webp-bytes")),
    );

    const visible = await get(overlay.id);
    expect(visible.status).toBe(200);
    expect(await visible.text()).toBe("webp-bytes");

    await setImageOverlayVisibility(db(), operationId, overlay.id, false);
    expect((await get(overlay.id)).status).toBe(404);
  });

  it("answers 404 for an overlay of another Einsatz", async () => {
    const other = await anOperation("Andere Lage");
    const overlay = await anImageOverlay(other.id, `${other.id}/karte.png`);

    const res = await get(overlay.id);

    expect(res.status).toBe(404);
  });
});

function anImageOverlay(operationId: string, filePath: string) {
  return createImageOverlay(db(), {
    operationId,
    filePath,
    name: "Karte",
    widthPx: 1000,
    heightPx: 1000,
    placement: PLACEMENT,
  });
}

function anOperation(name: string) {
  return insertOperation(db(), { name, description: null });
}

async function aLinkTo(operationId: string) {
  return (await createViewLink(db(), { operationId, label: "Leitstelle" }))
    .token;
}
