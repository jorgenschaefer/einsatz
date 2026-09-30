import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
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
      appendEntry(db, {
        operationId: op.id,
        text,
        type: "manuell",
        author: "a",
        route: NO_ROUTE,
      });

    await expect(append("")).rejects.toBeInstanceOf(ValidationError);
    await expect(append("   ")).rejects.toBeInstanceOf(ValidationError);
    expect(await listEntries(db, op.id)).toHaveLength(0);
  });

  it("stores the trimmed entry text", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const entry = await appendEntry(db, {
      operationId: op.id,
      text: "  Deich hält  ",
      type: "manuell",
      author: "a",
      route: NO_ROUTE,
    });
    expect(entry.text).toBe("Deich hält");
  });
  it("assigns gapless per-operation numbers starting at 1", async () => {
    const db = await freshDb();
    const op = await anOperation(db);

    const first = await appendEntry(db, {
      operationId: op.id,
      text: "A",
      type: "manuell",
      author: "anna",
      route: NO_ROUTE,
    });
    const second = await appendEntry(db, {
      operationId: op.id,
      text: "B",
      type: "manuell",
      author: "anna",
      route: NO_ROUTE,
    });

    expect(first.number).toBe(1);
    expect(second.number).toBe(2);
  });

  it("serializes concurrent appends so numbers stay gapless and unique", async () => {
    const db = await freshDb();
    const op = await anOperation(db);

    const entries = await Promise.all(
      ["A", "B", "C", "D", "E"].map((text) =>
        db.transaction((tx) =>
          appendEntry(tx, {
            operationId: op.id,
            text,
            type: "manuell",
            author: "anna",
            route: NO_ROUTE,
          }),
        ),
      ),
    );

    expect(entries.map((e) => e.number).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("rejects a duplicate (operation_id, number) via the UNIQUE constraint", async () => {
    // Backstop hinter der Lock-basierten Nummerierung: selbst wenn zwei parallele
    // Anhänge dieselbe Nummer berechnen würden, weist die DB den zweiten ab.
    const db = await freshDb();
    const op = await anOperation(db);
    const insertRaw = (number: number) =>
      db.query(
        `INSERT INTO journal_entries (id, operation_id, number, text, type)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), op.id, number, "X", "manuell"],
      );

    await insertRaw(1);
    await expect(insertRaw(1)).rejects.toThrow();
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
      route: NO_ROUTE,
    });
    const inB = await appendEntry(db, {
      operationId: b.id,
      text: "B",
      type: "manuell",
      author: "anna",
      route: NO_ROUTE,
    });

    expect(inA.number).toBe(1);
    expect(inB.number).toBe(1);
  });

  it("lists entries of an operation in order", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await appendEntry(db, {
      operationId: op.id,
      text: "first",
      type: "manuell",
      author: "anna",
      route: NO_ROUTE,
    });
    await appendEntry(db, {
      operationId: op.id,
      text: "second",
      type: "manuell",
      author: "anna",
      route: NO_ROUTE,
    });

    const entries = await listEntries(db, op.id);
    expect(entries.map((e) => e.text)).toEqual(["first", "second"]);
  });

  it("stores Von, An and Weg trimmed and lists them with the entry", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const appended = await appendEntry(db, {
      operationId: op.id,
      text: "Deich hält",
      type: "manuell",
      author: "anna",
      route: { sender: " UHSt 2 ", recipient: "EAL  ", channel: " Funk" },
    });

    const route = { sender: "UHSt 2", recipient: "EAL", channel: "Funk" };
    expect(appended).toMatchObject(route);
    expect(await listEntries(db, op.id)).toEqual([
      expect.objectContaining(route),
    ]);
  });

  it("stores blank Von, An and Weg as absent", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await appendEntry(db, {
      operationId: op.id,
      text: "Deich hält",
      type: "manuell",
      author: "anna",
      route: { sender: "  ", recipient: "", channel: " " },
    });

    expect(await listEntries(db, op.id)).toEqual([
      expect.objectContaining({ sender: null, recipient: null, channel: null }),
    ]);
  });

  it("lists an entry without a route with Von, An and Weg absent", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await appendEntry(db, {
      operationId: op.id,
      text: "Einsatz eröffnet",
      type: "einsatz-eröffnet",
      author: null,
      route: NO_ROUTE,
    });

    expect(await listEntries(db, op.id)).toEqual([
      expect.objectContaining({ sender: null, recipient: null, channel: null }),
    ]);
  });
});
