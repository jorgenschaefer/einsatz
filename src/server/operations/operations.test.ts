import { describe, expect, it } from "vitest";
import { freshDb } from "@/test/db";
import {
  getOperation,
  insertOperation,
  listOperations,
  setDefaultView,
} from "./operations";

describe("operations repository", () => {
  it("inserts an active operation and reads it back", async () => {
    const db = await freshDb();
    const created = await insertOperation(db, {
      name: "Hochwasser",
      description: "Deich Nord",
    });
    expect(created).toMatchObject({
      name: "Hochwasser",
      description: "Deich Nord",
      status: "active",
    });
    expect(created.startedAt).toBeInstanceOf(Date);
    expect(created.defaultView).toBeNull();

    const found = await getOperation(db, created.id);
    expect(found).toMatchObject({ id: created.id, name: "Hochwasser" });
    await db.close();
  });

  it("returns null for an unknown operation", async () => {
    const db = await freshDb();
    expect(
      await getOperation(db, "00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
    await db.close();
  });

  it("persists a default map view that reads back on the operation", async () => {
    const db = await freshDb();
    const op = await insertOperation(db, {
      name: "Hochwasser",
      description: null,
    });
    await setDefaultView(db, op.id, { lat: 53.55, lng: 9.99, zoom: 13 });

    const reloaded = await getOperation(db, op.id);
    expect(reloaded?.defaultView).toEqual({ lat: 53.55, lng: 9.99, zoom: 13 });
    await db.close();
  });

  it("lists all operations, newest first", async () => {
    const db = await freshDb();
    await insertOperation(db, { name: "Erst", description: null });
    await insertOperation(db, { name: "Zweit", description: null });
    const all = await listOperations(db);
    expect(all).toHaveLength(2);
    expect(all.map((o) => o.name)).toContain("Erst");
    expect(all.map((o) => o.name)).toContain("Zweit");
    await db.close();
  });
});
