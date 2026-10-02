import { describe, expect, it } from "vitest";
import { insertOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import {
  createKmlOverlay,
  deleteKmlOverlay,
  listKmlOverlays,
  reloadKmlOverlay,
  setKmlVisibility,
  updateKmlContent,
} from "./kml-overlays";

async function anOperation(db: Awaited<ReturnType<typeof freshDb>>) {
  return insertOperation(db, { name: "Hochwasser", description: null });
}

describe("kml overlays repository", () => {
  it("creates a URL overlay (visible by default) and reads it back", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const overlay = await createKmlOverlay(db, {
      operationId: op.id,
      sourceType: "url",
      sourceUrl: "https://example.com/route.kml",
      name: "Laufstrecke",
      content: "<kml/>",
    });
    expect(overlay).toMatchObject({
      sourceType: "url",
      sourceUrl: "https://example.com/route.kml",
      name: "Laufstrecke",
      visible: true,
    });
    const [loaded] = await listKmlOverlays(db, op.id);
    expect(loaded.content).toBe("<kml/>");
  });

  it("toggles visibility, reloads content, and deletes; scoped to the operation", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const other = await anOperation(db);
    const overlay = await createKmlOverlay(db, {
      operationId: op.id,
      sourceType: "file",
      sourceUrl: null,
      name: "f.kml",
      content: "<a/>",
    });

    await setKmlVisibility(db, overlay.id, false);
    await updateKmlContent(db, overlay.id, "<b/>");
    const [loaded] = await listKmlOverlays(db, op.id);
    expect(loaded).toMatchObject({ visible: false, content: "<b/>" });
    expect(await listKmlOverlays(db, other.id)).toHaveLength(0);

    await deleteKmlOverlay(db, overlay.id);
    expect(await listKmlOverlays(db, op.id)).toHaveLength(0);
  });

  it("reloads a URL overlay by re-fetching from its source URL", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const overlay = await createKmlOverlay(db, {
      operationId: op.id,
      sourceType: "url",
      sourceUrl: "https://example.com/route.kml",
      name: "Laufstrecke",
      content: "<old/>",
    });
    await reloadKmlOverlay(db, overlay.id, async (url) => {
      expect(url).toBe("https://example.com/route.kml");
      return "<new/>";
    });
    const [loaded] = await listKmlOverlays(db, op.id);
    expect(loaded.content).toBe("<new/>");
  });

  it("keeps the content when re-fetching fails", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const overlay = await createKmlOverlay(db, {
      operationId: op.id,
      sourceType: "url",
      sourceUrl: "https://example.com/route.kml",
      name: "Laufstrecke",
      content: "<kml>alt</kml>",
    });

    await expect(
      reloadKmlOverlay(db, overlay.id, async () => {
        throw new ValidationError("Die Adresse liefert keine KML-Datei.");
      }),
    ).rejects.toThrow("Die Adresse liefert keine KML-Datei.");

    const [loaded] = await listKmlOverlays(db, op.id);
    expect(loaded.content).toBe("<kml>alt</kml>");
  });

  it("refuses to reload a file overlay", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const overlay = await createKmlOverlay(db, {
      operationId: op.id,
      sourceType: "file",
      sourceUrl: null,
      name: "f.kml",
      content: "<a/>",
    });
    await expect(
      reloadKmlOverlay(db, overlay.id, async () => "<b/>"),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
