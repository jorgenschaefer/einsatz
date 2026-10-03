import { describe, expect, it } from "vitest";
import type { Db } from "@/server/db/db";
import { insertOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import {
  createMapSymbol,
  deleteMapSymbol,
  generateDeviceLink,
  listMapSymbols,
  moveMapSymbol,
  removeDeviceLink,
  updateMapSymbolComposition,
} from "./map-symbols";

const changes: {
  name: string;
  change: (db: Db, operationId: string, id: string) => Promise<unknown>;
}[] = [
  {
    name: "moveMapSymbol",
    change: (db, op, id) => moveMapSymbol(db, op, id, 50, 8),
  },
  {
    name: "updateMapSymbolComposition",
    change: (db, op, id) =>
      updateMapSymbolComposition(db, op, id, { text: "neu" }),
  },
  {
    name: "deleteMapSymbol",
    change: (db, op, id) => deleteMapSymbol(db, op, id),
  },
  {
    name: "generateDeviceLink",
    change: (db, op, id) => generateDeviceLink(db, op, id),
  },
  {
    name: "removeDeviceLink",
    change: (db, op, id) => removeDeviceLink(db, op, id),
  },
];

async function aSymbolIn(db: Db) {
  const op = await insertOperation(db, { name: "A", description: null });
  const symbol = await createMapSymbol(db, {
    operationId: op.id,
    composition: { grundzeichen: "kraftfahrzeug-landgebunden" },
    lat: 53.55,
    lng: 9.99,
  });
  await generateDeviceLink(db, op.id, symbol.id);
  return { operationId: op.id, symbolId: symbol.id };
}

describe.each(changes)("$name", ({ change }) => {
  it("changes a Kartenzeichen of the named Einsatz", async () => {
    const db = await freshDb();
    const { operationId, symbolId } = await aSymbolIn(db);
    const before = await listMapSymbols(db, operationId);

    await change(db, operationId, symbolId);

    expect(await listMapSymbols(db, operationId)).not.toEqual(before);
  });

  it("refuses a Kartenzeichen of another Einsatz and leaves it unchanged", async () => {
    const db = await freshDb();
    const { operationId, symbolId } = await aSymbolIn(db);
    const other = await insertOperation(db, { name: "B", description: null });
    const before = await listMapSymbols(db, operationId);

    await expect(change(db, other.id, symbolId)).rejects.toThrow(
      new ValidationError("Kartenzeichen nicht gefunden."),
    );
    expect(await listMapSymbols(db, operationId)).toEqual(before);
  });

  it("reports a Kartenzeichen that no longer exists", async () => {
    const db = await freshDb();
    const { operationId, symbolId } = await aSymbolIn(db);
    await deleteMapSymbol(db, operationId, symbolId);

    await expect(change(db, operationId, symbolId)).rejects.toThrow(
      new ValidationError("Kartenzeichen nicht gefunden."),
    );
  });
});
