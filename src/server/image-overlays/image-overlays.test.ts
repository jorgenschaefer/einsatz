import { describe, expect, it } from "vitest";
import { closeOperation } from "@/server/operations/operation-lifecycle";
import {
  deleteOperationRow,
  insertOperation,
} from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
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
  });

  it("returns null for an id that is not a UUID", async () => {
    const db = await freshDb();
    expect(await getImageOverlay(db, "marker-icon.png")).toBeNull();
  });

  it("finds an overlay by its id in upper case", async () => {
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
    expect(await getImageOverlay(db, overlay.id.toUpperCase())).toMatchObject({
      id: overlay.id,
    });
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
  });

  it("rejects invalid placements and writes nothing", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const base = {
      operationId: op.id,
      filePath: "op/x/plan.png",
      name: "Plan",
      widthPx: 100,
      heightPx: 100,
    };
    const create = (placement: typeof A_PLACEMENT) =>
      createImageOverlay(db, { ...base, placement });

    await expect(
      create({ ...A_PLACEMENT, centerLat: Number.NaN }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      create({ ...A_PLACEMENT, centerLat: 91 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      create({ ...A_PLACEMENT, centerLng: 181 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      create({ ...A_PLACEMENT, opacity: 1.5 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(create({ ...A_PLACEMENT, scaleM: 0 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      create({ ...A_PLACEMENT, rotationDeg: Number.POSITIVE_INFINITY }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(await listImageOverlays(db, op.id)).toHaveLength(0);
  });

  it("scaleM<=0 is rejected with the scale message, not the radius message", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    let message = "";
    try {
      await createImageOverlay(db, {
        operationId: op.id,
        filePath: "op/x/plan.png",
        name: "Plan",
        widthPx: 100,
        heightPx: 100,
        placement: { ...A_PLACEMENT, scaleM: -1 },
      });
    } catch (err) {
      message = (err as ValidationError).message;
    }
    expect(message).not.toMatch(/Radius/);
    expect(message).toMatch(/Skalierung/);
  });

  it("updateImagePlacement rejects invalid values and leaves the row unchanged", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const overlay = await createImageOverlay(db, {
      operationId: op.id,
      filePath: "op/x/plan.png",
      name: "Plan",
      widthPx: 100,
      heightPx: 100,
      placement: A_PLACEMENT,
    });

    await expect(
      updateImagePlacement(db, overlay.id, {
        ...A_PLACEMENT,
        centerLat: Number.NaN,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      updateImagePlacement(db, overlay.id, { ...A_PLACEMENT, scaleM: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      updateImagePlacement(db, overlay.id, { ...A_PLACEMENT, opacity: 1.5 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      updateImagePlacement(db, overlay.id, {
        ...A_PLACEMENT,
        rotationDeg: Number.NaN,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect((await getImageOverlay(db, overlay.id))?.placement).toEqual(
      A_PLACEMENT,
    );
  });

  it("accepts a finite rotation outside 0–360 without normalizing it", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const overlay = await createImageOverlay(db, {
      operationId: op.id,
      filePath: "op/x/plan.png",
      name: "Plan",
      widthPx: 100,
      heightPx: 100,
      placement: { ...A_PLACEMENT, rotationDeg: 720 },
    });
    expect(overlay.placement.rotationDeg).toBe(720);

    await updateImagePlacement(db, overlay.id, {
      ...A_PLACEMENT,
      rotationDeg: -30,
    });
    expect((await getImageOverlay(db, overlay.id))?.placement.rotationDeg).toBe(
      -30,
    );
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
    await closeOperation(db, op.id);
    await deleteOperationRow(db, op.id);
    expect(await listImageOverlays(db, op.id)).toHaveLength(0);
  });
});
