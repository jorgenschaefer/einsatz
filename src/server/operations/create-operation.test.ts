import { describe, expect, it } from "vitest";
import { listEntries } from "@/server/journal/journal";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import {
  createOperation,
  OPERATION_OPENED_ENTRY_TEXT,
} from "./create-operation";
import { listOperations } from "./operations";

describe("createOperation", () => {
  it('creates an active operation with one automatic "Einsatz eröffnet" journal entry', async () => {
    const db = await freshDb();
    const op = await createOperation(db, {
      name: "Hochwasser",
      description: "Deich Nord",
    });

    expect(op).toMatchObject({
      name: "Hochwasser",
      description: "Deich Nord",
      status: "active",
    });

    const entries = await listEntries(db, op.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      number: 1,
      type: "einsatz-eröffnet",
      text: OPERATION_OPENED_ENTRY_TEXT,
      state: "gueltig",
      author: null,
    });
  });

  it("trims the Bezeichnung", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "  Hochwasser  " });
    expect(op.name).toBe("Hochwasser");
  });

  it("rejects an empty Bezeichnung and persists nothing", async () => {
    const db = await freshDb();
    await expect(createOperation(db, { name: "   " })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(await listOperations(db)).toHaveLength(0);
  });
});
