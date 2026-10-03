import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));

import type { ReadOnlySituationMapData } from "@/map/ReadOnlySituationMap";
import { ViewLinkView } from "@/map/ViewLinkView";
import { createImageOverlay } from "@/server/image-overlays/image-overlays";
import { insertOperation } from "@/server/operations/operations";
import { createViewLink } from "@/server/viewlinks/view-links";
import { PLACEMENT } from "@/test/bad-calls/fixture";
import { freshDb } from "@/test/db";
import { expectPageRequiresToken } from "@/test/page-checks";
import ViewPage from "./page";

beforeEach(async () => {
  state.db = await freshDb();
});

expectPageRequiresToken(ViewPage);

describe("view page", () => {
  it("shows the link's Einsatz with its images served under /view", async () => {
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
    const { token } = await createViewLink(db, {
      operationId: op.id,
      label: "Leitstelle",
    });

    const page = (await ViewPage({
      params: Promise.resolve({ token }),
    })) as ReactElement<ReadOnlySituationMapData>;

    expect(page.type).toBe(ViewLinkView);
    expect(page.props.operationId).toBe(op.id);
    expect(page.props.imageOverlays.map((o) => o.imageUrl)).toEqual([
      `/view/${token}/overlays/${overlay.id}?v=plan.webp`,
    ]);
  });
});
