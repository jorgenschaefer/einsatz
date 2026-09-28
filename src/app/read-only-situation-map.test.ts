import { describe, expect, it, vi } from "vitest";
import { createImageOverlay } from "@/server/image-overlays/image-overlays";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";

vi.mock("pdf-to-png-converter", () => ({ pdfToPng: vi.fn() }));

import { loadReadOnlySituationMap } from "./read-only-situation-map";

describe("loadReadOnlySituationMap", () => {
  it("serves image overlays through the token route under the base path", async () => {
    const db = await freshDb();
    const op = await insertOperation(db, { name: "Lage", description: null });
    const overlay = await createImageOverlay(db, {
      operationId: op.id,
      filePath: `${op.id}/plan.webp`,
      name: "Plan",
      widthPx: 200,
      heightPx: 100,
      placement: {
        centerLat: 53.55,
        centerLng: 9.99,
        scaleM: 500,
        rotationDeg: 0,
        opacity: 1,
      },
    });

    const map = await loadReadOnlySituationMap(db, op.id, "/view", "tok");

    expect(map?.token).toBe("tok");
    expect(map?.imageOverlays).toEqual([
      expect.objectContaining({
        imageUrl: `/view/tok/overlays/${overlay.id}?v=plan.webp`,
        aspect: 2,
      }),
    ]);
  });

  it("returns null when the Einsatz no longer exists", async () => {
    const db = await freshDb();
    expect(
      await loadReadOnlySituationMap(
        db,
        "00000000-0000-0000-0000-000000000000",
        "/device",
        "tok",
      ),
    ).toBeNull();
  });
});
