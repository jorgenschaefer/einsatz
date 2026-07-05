import { describe, expect, it } from "vitest";
import { insertOperation } from "@/server/operations/operations";
import { freshDb } from "@/test/db";
import { appendEntry, listEntries } from "./journal";

async function anOperation(db: Awaited<ReturnType<typeof freshDb>>) {
  return insertOperation(db, { name: "Hochwasser", description: null });
}

describe("journal", () => {
  it("assigns gapless per-operation numbers starting at 1", async () => {
    const db = await freshDb();
    const op = await anOperation(db);

    const first = await appendEntry(db, {
      operationId: op.id,
      text: "A",
      type: "manuell",
      author: "anna",
    });
    const second = await appendEntry(db, {
      operationId: op.id,
      text: "B",
      type: "manuell",
      author: "anna",
    });

    expect(first.number).toBe(1);
    expect(second.number).toBe(2);
    await db.close();
  });

  it("numbers entries independently per operation", async () => {
    const db = await freshDb();
    const a = await anOperation(db);
    const b = await anOperation(db);

    const inA = await appendEntry(db, {
      operationId: a.id,
      text: "A",
      type: "manuell",
      author: "anna",
    });
    const inB = await appendEntry(db, {
      operationId: b.id,
      text: "B",
      type: "manuell",
      author: "anna",
    });

    expect(inA.number).toBe(1);
    expect(inB.number).toBe(1);
    await db.close();
  });

  it("lists entries of an operation in order", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await appendEntry(db, {
      operationId: op.id,
      text: "first",
      type: "manuell",
      author: "anna",
    });
    await appendEntry(db, {
      operationId: op.id,
      text: "second",
      type: "manuell",
      author: "anna",
    });

    const entries = await listEntries(db, op.id);
    expect(entries.map((e) => e.text)).toEqual(["first", "second"]);
    await db.close();
  });
});
