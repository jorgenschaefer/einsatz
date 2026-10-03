import { describe, expect, it } from "vitest";
import type { Db } from "@/server/db/db";
import { insertOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import {
  createImageOverlay,
  deleteImageOverlay,
  listImageOverlays,
  replaceImageOverlayFile,
  setImageOverlayVisibility,
  updateImagePlacement,
} from "./image-overlays";

const NOT_FOUND = new ValidationError("Bild-Overlay nicht gefunden.");

describe.each<{
  name: string;
  change: (db: Db, operationId: string, id: string) => Promise<unknown>;
}>([
  {
    name: "updateImagePlacement",
    change: (db, op, id) =>
      updateImagePlacement(db, op, id, {
        centerLat: 50,
        centerLng: 8,
        scaleM: 10,
        rotationDeg: 0,
        opacity: 1,
      }),
  },
  {
    name: "setImageOverlayVisibility",
    change: (db, op, id) => setImageOverlayVisibility(db, op, id, false),
  },
  {
    name: "replaceImageOverlayFile",
    change: (db, op, id) =>
      replaceImageOverlayFile(db, op, id, {
        filePath: "op/x/neu.webp",
        name: "Neu",
        widthPx: 30,
        heightPx: 15,
      }),
  },
  { name: "deleteImageOverlay", change: deleteImageOverlay },
])("$name", ({ change }) => {
  it("refuses a Bild-Overlay of another Einsatz and leaves it unchanged", async () => {
    const db = await freshDb();
    const { operationId, overlayId } = await anOverlayIn(db);
    const other = await insertOperation(db, { name: "B", description: null });
    const before = await listImageOverlays(db, operationId);

    await expect(change(db, other.id, overlayId)).rejects.toThrow(NOT_FOUND);
    expect(await listImageOverlays(db, operationId)).toEqual(before);
  });

  it("reports a Bild-Overlay that no longer exists", async () => {
    const db = await freshDb();
    const { operationId, overlayId } = await anOverlayIn(db);
    await deleteImageOverlay(db, operationId, overlayId);

    await expect(change(db, operationId, overlayId)).rejects.toThrow(NOT_FOUND);
  });
});

describe("deleteImageOverlay", () => {
  it("returns the file of the deleted Bild-Overlay", async () => {
    const db = await freshDb();
    const { operationId, overlayId } = await anOverlayIn(db);

    expect(await deleteImageOverlay(db, operationId, overlayId)).toEqual({
      filePath: "op/x/alt.webp",
    });
  });
});

async function anOverlayIn(db: Db) {
  const op = await insertOperation(db, { name: "A", description: null });
  const overlay = await createImageOverlay(db, {
    operationId: op.id,
    filePath: "op/x/alt.webp",
    name: "Alt",
    widthPx: 1000,
    heightPx: 1000,
    placement: {
      centerLat: 53.55,
      centerLng: 9.99,
      scaleM: 500,
      rotationDeg: 30,
      opacity: 0.8,
    },
  });
  return { operationId: op.id, overlayId: overlay.id };
}
