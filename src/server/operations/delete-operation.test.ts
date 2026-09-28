import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteOverlayFiles = vi.fn(async (_paths: string[]) => {});
vi.mock("@/server/image-overlays/image-storage", () => ({
  deleteOverlayFiles: (paths: string[]) => deleteOverlayFiles(paths),
}));

import { createImageOverlay } from "@/server/image-overlays/image-overlays";
import { appendEntry, listEntries } from "@/server/journal/journal";
import {
  createMapSymbol,
  listMapSymbols,
} from "@/server/mapsymbols/map-symbols";
import { createStation, listStations } from "@/server/strength/stations";
import { freshDb } from "@/test/db";
import { createOperation } from "./create-operation";
import { deleteOperation } from "./delete-operation";
import { getOperation } from "./operations";

const A_PLACEMENT = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 500,
  rotationDeg: 0,
  opacity: 1,
};

beforeEach(() => {
  deleteOverlayFiles.mockClear();
});

describe("deleteOperation (domain)", () => {
  it("deletes the operation and cascades its journal entries and map symbols", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Hochwasser" }); // has an automatic entry
    await appendEntry(db, {
      operationId: op.id,
      text: "Lage",
      type: "manuell",
      author: "anna",
    });
    await createMapSymbol(db, {
      operationId: op.id,
      composition: { organisation: "hilfsorganisation" },
      lat: 1,
      lng: 2,
    });

    await deleteOperation(db, op.id);

    expect(await getOperation(db, op.id)).toBeNull();
    expect(await listEntries(db, op.id)).toHaveLength(0);
    expect(await listMapSymbols(db, op.id)).toHaveLength(0);
  });

  it("cascades the operation's Stellen", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Cyclassics" });
    await createStation(db, {
      operationId: op.id,
      name: "UHSt 3",
      author: "anna",
    });

    await deleteOperation(db, op.id);

    expect(await listStations(db, op.id)).toHaveLength(0);
  });

  it("removes the operation's overlay files along with the row", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Hochwasser" });
    await createImageOverlay(db, {
      operationId: op.id,
      filePath: "op/x/plan.webp",
      name: "Plan",
      widthPx: 100,
      heightPx: 100,
      placement: A_PLACEMENT,
    });

    await deleteOperation(db, op.id);

    expect(await getOperation(db, op.id)).toBeNull();
    expect(deleteOverlayFiles).toHaveBeenCalledWith(["op/x/plan.webp"]);
  });

  it("deletes an operation without overlays without touching files", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Ruhig" });

    await deleteOperation(db, op.id);

    expect(await getOperation(db, op.id)).toBeNull();
    expect(deleteOverlayFiles).toHaveBeenCalledWith([]); // no file paths
  });
});
