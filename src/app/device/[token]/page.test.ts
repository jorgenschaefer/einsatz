import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));

import { DeviceView } from "@/map/DeviceView";
import type { ReadOnlySituationMapData } from "@/map/ReadOnlySituationMap";
import { createImageOverlay } from "@/server/image-overlays/image-overlays";
import {
  createMapSymbol,
  generateDeviceLink,
} from "@/server/mapsymbols/map-symbols";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { PLACEMENT } from "@/test/operation-fixture";
import { expectPageRequiresToken } from "@/test/page-checks";
import DevicePage from "./page";

beforeEach(async () => {
  state.db = await freshDb();
});

expectPageRequiresToken(DevicePage);

describe("device page", () => {
  it("shows the link's Einsatz with its images served under /device", async () => {
    const db = state.db as Db;
    const op = await insertOperation(db, { name: "Lage", description: null });
    const overlay = await createImageOverlay(db, {
      operationId: op.id,
      filePath: `${op.id}/plan.webp`,
      name: "Plan",
      widthPx: 200,
      heightPx: 100,
      placement: PLACEMENT,
    });
    const symbol = await createMapSymbol(db, {
      operationId: op.id,
      composition: {},
      lat: 53.55,
      lng: 9.99,
    });
    const token = await generateDeviceLink(db, op.id, symbol.id);

    const page = (await DevicePage({
      params: Promise.resolve({ token }),
    })) as ReactElement<ReadOnlySituationMapData>;

    expect(page.type).toBe(DeviceView);
    expect(page.props.operationId).toBe(op.id);
    expect(page.props.imageOverlays.map((o) => o.imageUrl)).toEqual([
      `/device/${token}/overlays/${overlay.id}?v=plan.webp`,
    ]);
  });
});
