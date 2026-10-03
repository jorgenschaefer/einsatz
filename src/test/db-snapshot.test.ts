import { describe, expect, it } from "vitest";
import type { Db } from "@/server/db/db";
import { freshDb } from "./db";
import { snapshotDb } from "./db-snapshot";

const addOperation = (db: Db, name: string) =>
  db.query("INSERT INTO operations (id, name) VALUES (gen_random_uuid(), $1)", [
    name,
  ]);

describe("snapshotDb", () => {
  it("is equal when nothing was written", async () => {
    const db = await freshDb();
    await addOperation(db, "Lage");

    expect(await snapshotDb(db)).toEqual(await snapshotDb(db));
  });

  it.each<[string, (db: Db) => Promise<unknown>]>([
    ["a row is added", (db) => addOperation(db, "Hochwasser")],
    ["a row is changed", (db) => db.query("UPDATE operations SET name = 'B'")],
    ["a row is deleted", (db) => db.query("DELETE FROM operations")],
  ])("differs when %s", async (_, write) => {
    const db = await freshDb();
    await addOperation(db, "Lage");
    const before = await snapshotDb(db);

    await write(db);

    expect(await snapshotDb(db)).not.toEqual(before);
  });

  it("leaves out the applied migrations", async () => {
    const db = await freshDb();

    expect(Object.keys(await snapshotDb(db))).not.toContain(
      "schema_migrations",
    );
  });
});
