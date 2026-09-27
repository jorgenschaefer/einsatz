import { describe, expect, it } from "vitest";
import { appendEntry, listEntries } from "@/server/journal/journal";
import { freshDb } from "@/test/db";
import {
  createOperation,
  OPERATION_OPENED_ENTRY_TEXT,
} from "./create-operation";
import {
  closeOperation,
  OPERATION_CLOSED_ENTRY_TEXT,
  reopenOperation,
} from "./operation-lifecycle";
import { getOperation } from "./operations";

describe("closeOperation / reopenOperation", () => {
  it('closes an active operation and appends an automatic "Einsatz geschlossen" entry', async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Hochwasser" });
    await closeOperation(db, op.id);

    expect((await getOperation(db, op.id))?.status).toBe("closed");
    const entries = await listEntries(db, op.id);
    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({
      number: 2,
      type: "einsatz-geschlossen",
      text: OPERATION_CLOSED_ENTRY_TEXT,
      author: null,
    });
  });

  it('reopens a closed operation and appends an automatic "Einsatz eröffnet" entry', async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Hochwasser" });
    await closeOperation(db, op.id);
    await reopenOperation(db, op.id);

    expect((await getOperation(db, op.id))?.status).toBe("active");
    const entries = await listEntries(db, op.id);
    expect(entries.map((e) => e.type)).toEqual([
      "einsatz-eröffnet",
      "einsatz-geschlossen",
      "einsatz-eröffnet",
    ]);
    expect(entries.map((e) => e.number)).toEqual([1, 2, 3]);
    expect(entries[2].text).toBe(OPERATION_OPENED_ENTRY_TEXT);
  });

  it("does nothing when closing an already-closed operation (no duplicate milestone)", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Hochwasser" });
    await closeOperation(db, op.id);
    await closeOperation(db, op.id);

    expect(
      (await listEntries(db, op.id)).filter(
        (e) => e.type === "einsatz-geschlossen",
      ),
    ).toHaveLength(1);
  });

  it("does nothing when reopening an already-active operation", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Hochwasser" });
    await reopenOperation(db, op.id);
    expect(await listEntries(db, op.id)).toHaveLength(1); // only the initial opening entry
  });

  it("leaves a closed operation fully editable (no write-lock)", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Hochwasser" });
    await closeOperation(db, op.id);
    await appendEntry(db, {
      operationId: op.id,
      text: "nachträglich",
      type: "manuell",
      author: "anna",
    });
    expect(
      (await listEntries(db, op.id)).some((e) => e.text === "nachträglich"),
    ).toBe(true);
  });
});
