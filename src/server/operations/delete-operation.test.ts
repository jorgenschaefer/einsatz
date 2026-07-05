import { describe, expect, it } from "vitest";
import { appendEntry, listEntries } from "@/server/journal/journal";
import {
  createMapSymbol,
  listMapSymbols,
} from "@/server/mapsymbols/map-symbols";
import { freshDb } from "@/test/db";
import { createOperation } from "./create-operation";
import { deleteOperation, getOperation } from "./operations";

describe("deleteOperation", () => {
  it("deletes the operation and cascades its journal entries and map symbols", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Hochwasser" }); // has an automatic entry
    await appendEntry(db, {
      operationId: op.id,
      text: "Lage",
      type: "manuell",
      author: "anna",
    });
    await createMapSymbol(db, {
      operationId: op.id,
      composition: { organisation: "hilfsorganisation" },
      lat: 1,
      lng: 2,
    });

    await deleteOperation(db, op.id);

    expect(await getOperation(db, op.id)).toBeNull();
    expect(await listEntries(db, op.id)).toHaveLength(0);
    expect(await listMapSymbols(db, op.id)).toHaveLength(0);
    await db.close();
  });
});
