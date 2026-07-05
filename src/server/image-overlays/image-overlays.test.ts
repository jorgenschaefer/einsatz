import { describe, expect, it } from "vitest";
import {
  deleteOperation,
  insertOperation,
} from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import {
  createImageOverlay,
  deleteImageOverlay,
  getImageOverlay,
  listImageOverlays,
  replaceImageOverlayFile,
  setImageOverlayVisibility,
  updateImagePlacement,
} from "./image-overlays";

async function anOperation(db: Awaited<ReturnType<typeof freshDb>>) {
  return insertOperation(db, { name: "Hochwasser", description: null });
}

const A_PLACEMENT = {
  centerLat: 53.55,
  centerLng: 9.99,
  scaleM: 500,
  rotationDeg: 30,
  opacity: 0.8,
};

describe("image overlays repository", () => {
  it("creates an overlay and reads back its placement", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const overlay = await createImageOverlay(db, {
      operationId: op.id,
      filePath: "op/x/plan.png",
      name: "Lageplan",
      widthPx: 1200,
      heightPx: 800,
      placement: A_PLACEMENT,
    });
    expect(overlay).toMatchObject({
      name: "Lageplan",
      filePath: "op/x/plan.png",
      widthPx: 1200,
      heightPx: 800,
      visible: true,
      placement: A_PLACEMENT,
    });
    const [loaded] = await listImageOverlays(db, op.id);
    expect(loaded.placement).toEqual(A_PLACEMENT);
    expect(await getImageOverlay(db, overlay.id)).toMatchObject({
      id: overlay.id,
      filePath: "op/x/plan.png",
    });
    await db.close();
  });

  it("updates placement, toggles visibility, and deletes; scoped to the operation", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const other = await anOperation(db);
    const overlay = await createImageOverlay(db, {
      operationId: op.id,
      filePath: "op/x/plan.png",
      name: "Plan",
      widthPx: 100,
      heightPx: 100,
      placement: A_PLACEMENT,
    });

    const moved = {
      centerLat: 50,
      centerLng: 8,
      scaleM: 250,
      rotationDeg: 90,
      opacity: 0.5,
    };
    await updateImagePlacement(db, overlay.id, moved);
    await setImageOverlayVisibility(db, overlay.id, false);
    const [loaded] = await listImageOverlays(db, op.id);
    expect(loaded).toMatchObject({ visible: false, placement: moved });
    expect(await listImageOverlays(db, other.id)).toHaveLength(0);

    await deleteImageOverlay(db, overlay.id);
    expect(await listImageOverlays(db, op.id)).toHaveLength(0);
    await db.close();
  });

  it("replaces the file and dimensions but keeps placement and visibility", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const overlay = await createImageOverlay(db, {
      operationId: op.id,
      filePath: "op/x/alt.webp",
      name: "Alt",
      widthPx: 1000,
      heightPx: 1000,
      placement: A_PLACEMENT,
    });
    await setImageOverlayVisibility(db, overlay.id, false);

    await replaceImageOverlayFile(db, overlay.id, {
      filePath: "op/x/neu.webp",
      name: "Neu",
      widthPx: 3000,
      heightPx: 1500,
    });

    expect(await getImageOverlay(db, overlay.id)).toMatchObject({
      filePath: "op/x/neu.webp",
      name: "Neu",
      widthPx: 3000,
      heightPx: 1500,
      placement: A_PLACEMENT,
      visible: false,
    });
    await db.close();
  });

  it("cascades when the operation is deleted", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await createImageOverlay(db, {
      operationId: op.id,
      filePath: "op/x/plan.png",
      name: "Plan",
      widthPx: 100,
      heightPx: 100,
      placement: A_PLACEMENT,
    });
    await deleteOperation(db, op.id);
    expect(await listImageOverlays(db, op.id)).toHaveLength(0);
    await db.close();
  });
});
