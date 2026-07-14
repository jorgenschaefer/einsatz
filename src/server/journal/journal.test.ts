import { describe, expect, it } from "vitest";
import { insertOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import { appendEntry, listEntries } from "./journal";

async function anOperation(db: Awaited<ReturnType<typeof freshDb>>) {
  return insertOperation(db, { name: "Hochwasser", description: null });
}

describe("journal", () => {
  it("rejects an empty or whitespace-only entry text in the domain", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const append = (text: string) =>
      appendEntry(db, { operationId: op.id, text, type: "manuell", author: "a" });

    await expect(append("")).rejects.toBeInstanceOf(ValidationError);
    await expect(append("   ")).rejects.toBeInstanceOf(ValidationError);
    expect(await listEntries(db, op.id)).toHaveLength(0);
    await db.close();
  });

  it("stores the trimmed entry text", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const entry = await appendEntry(db, {
      operationId: op.id,
      text: "  Deich hält  ",
      type: "manuell",
      author: "a",
    });
    expect(entry.text).toBe("Deich hält");
    await db.close();
  });
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
