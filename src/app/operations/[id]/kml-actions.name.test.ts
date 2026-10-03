import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/server/db/db";

const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("@/server/auth/current-user", () => ({
  requireUser: async () => ({ id: "u1", username: "anna", role: "user" }),
}));
vi.mock("@/server/db/pg", () => ({ getDb: () => state.db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/events/operation-events", () => ({
  publishOperationChanged: () => {},
}));
vi.mock("@/server/kml/kml-import", () => ({
  loadKmlFromUrl: async () => "<kml/>",
}));

import { listKmlOverlays } from "@/server/kml/kml-overlays";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { addKmlUrlAction } from "./kml-actions";

const URL = "https://example.org/pegel.kml";

beforeEach(async () => {
  state.db = await freshDb();
});

const anOperation = () =>
  insertOperation(state.db as Db, { name: "Lage", description: null });

describe("addKmlUrlAction, the name of the KML-Ebene", () => {
  it("refuses a name of 201 characters and stores nothing", async () => {
    const op = await anOperation();

    const result = await addKmlUrlAction(op.id, "x".repeat(201), URL);

    expect(result).toEqual({
      error: "Der Name darf höchstens 200 Zeichen lang sein.",
    });
    expect(await listKmlOverlays(state.db as Db, op.id)).toEqual([]);
  });

  it("refuses a name that is not text and stores nothing", async () => {
    const op = await anOperation();

    const result = await addKmlUrlAction(op.id, 42 as unknown as string, URL);

    expect(result).toEqual({ error: "Der Name muss Text sein." });
    expect(await listKmlOverlays(state.db as Db, op.id)).toEqual([]);
  });

  it("names the KML-Ebene after its address when no name is given", async () => {
    const op = await anOperation();

    expect(await addKmlUrlAction(op.id, "  ", ` ${URL} `)).toEqual({});

    expect(await listKmlOverlays(state.db as Db, op.id)).toMatchObject([
      { name: URL, sourceUrl: URL },
    ]);
  });
});
