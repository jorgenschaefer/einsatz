import { describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";
import {
  createImageOverlay,
  setImageOverlayVisibility,
} from "@/server/image-overlays/image-overlays";
import { createKmlOverlay, setKmlVisibility } from "@/server/kml/kml-overlays";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { PLACEMENT } from "@/test/operation-fixture";

vi.mock("pdf-to-png-converter", () => ({ pdfToPng: vi.fn() }));

import { loadReadOnlySituationMap } from "./read-only-situation-map";

describe("loadReadOnlySituationMap", () => {
  it("serves image overlays through the token route under the base path", async () => {
    const db = await freshDb();
    const op = await insertOperation(db, { name: "Lage", description: null });
    const overlay = await anImageOverlay(db, op.id, "plan.webp");

    const map = await loadReadOnlySituationMap(db, op.id, "/view", "tok");

    expect(map?.token).toBe("tok");
    expect(map?.imageOverlays).toEqual([
      expect.objectContaining({
        imageUrl: `/view/tok/overlays/${overlay.id}?v=plan.webp`,
        aspect: 2,
      }),
    ]);
  });

  it("leaves hidden KML-Ebenen and Bild-Overlays out", async () => {
    const db = await freshDb();
    const op = await insertOperation(db, { name: "Lage", description: null });
    const kml = (name: string) =>
      createKmlOverlay(db, {
        operationId: op.id,
        sourceType: "file",
        sourceUrl: null,
        name,
        content: `<kml><Placemark><name>${name}</name></Placemark></kml>`,
      });
    const visibleKml = await kml("Offen");
    const hiddenKml = await kml("Geheim");
    await setKmlVisibility(db, op.id, hiddenKml.id, false);
    const visibleImage = await anImageOverlay(db, op.id, "offen.webp");
    const hiddenImage = await anImageOverlay(db, op.id, "verdeckt.webp");
    await setImageOverlayVisibility(db, op.id, hiddenImage.id, false);

    const map = await loadReadOnlySituationMap(db, op.id, "/device", "tok");

    expect(map?.kmlOverlays.map((o) => o.id)).toEqual([visibleKml.id]);
    expect(map?.imageOverlays.map((o) => o.id)).toEqual([visibleImage.id]);
    expect(JSON.stringify(map)).not.toContain("Geheim");
    expect(JSON.stringify(map)).not.toContain(hiddenImage.id);
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

function anImageOverlay(db: Db, operationId: string, fileName: string) {
  return createImageOverlay(db, {
    operationId,
    filePath: `${operationId}/${fileName}`,
    name: fileName,
    widthPx: 200,
    heightPx: 100,
    placement: PLACEMENT,
  });
}
