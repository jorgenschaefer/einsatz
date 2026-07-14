import { describe, expect, it } from "vitest";
import {
  closeOperation,
  reopenOperation,
} from "@/server/operations/operation-lifecycle";
import { insertOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import {
  createMapSymbol,
  deleteMapSymbol,
  generateDeviceLink,
  listMapSymbols,
  moveMapSymbol,
  reportPosition,
  resolveDeviceAccess,
  type SymbolComposition,
  updateMapSymbolComposition,
} from "./map-symbols";

const composition: SymbolComposition = {
  grundzeichen: "kraftfahrzeug-landgebunden",
  fachaufgabe: "rettungswesen",
  organisation: "hilfsorganisation",
};

async function anOperation(db: Awaited<ReturnType<typeof freshDb>>) {
  return insertOperation(db, { name: "Hochwasser", description: null });
}

describe("map symbols repository", () => {
  it("creates a symbol and lists it with its composition and position", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const created = await createMapSymbol(db, {
      operationId: op.id,
      composition,
      lat: 53.55,
      lng: 9.99,
    });
    expect(created.id).toBeTruthy();

    const [loaded] = await listMapSymbols(db, op.id);
    expect(loaded).toMatchObject({ id: created.id, lat: 53.55, lng: 9.99 });
    expect(loaded.composition).toEqual(composition);
    await db.close();
  });

  it("creates a symbol with a manual position source and no device link", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await createMapSymbol(db, {
      operationId: op.id,
      composition,
      lat: 1,
      lng: 2,
    });
    const [loaded] = await listMapSymbols(db, op.id);
    expect(loaded).toMatchObject({
      positionSource: "manual",
      deviceLinkToken: null,
      reportedAt: null,
    });
    await db.close();
  });

  it("rejects a malformed composition and persists nothing", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const create = (c: unknown) =>
      createMapSymbol(db, {
        operationId: op.id,
        composition: c as SymbolComposition,
        lat: 53.55,
        lng: 9.99,
      });

    await expect(create("not-an-object")).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(create(null)).rejects.toBeInstanceOf(ValidationError);
    await expect(create({ unbekannt: "x" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(create({ text: 42 })).rejects.toBeInstanceOf(ValidationError);

    expect(await listMapSymbols(db, op.id)).toHaveLength(0);
    await db.close();
  });

  it("accepts a composition with free text/symbol values (no value-enum check)", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const free: SymbolComposition = {
      text: "Rotkreuz Musterstadt 83/1",
      symbol: "irgendein-frei-gewählter-wert",
    };
    const created = await createMapSymbol(db, {
      operationId: op.id,
      composition: free,
      lat: 53.55,
      lng: 9.99,
    });
    const [loaded] = await listMapSymbols(db, op.id);
    expect(loaded.composition).toEqual(free);
    expect(loaded.id).toBe(created.id);
    await db.close();
  });

  it("updateMapSymbolComposition rejects a malformed composition and keeps the old value", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const symbol = await createMapSymbol(db, {
      operationId: op.id,
      composition,
      lat: 53.55,
      lng: 9.99,
    });
    await expect(
      updateMapSymbolComposition(db, symbol.id, {
        böse: "x",
      } as unknown as SymbolComposition),
    ).rejects.toBeInstanceOf(ValidationError);
    const [loaded] = await listMapSymbols(db, op.id);
    expect(loaded.composition).toEqual(composition);
    await db.close();
  });

  it("resets the position source to manual when the symbol is moved by hand", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const symbol = await createMapSymbol(db, {
      operationId: op.id,
      composition,
      lat: 1,
      lng: 2,
    });
    const token = await generateDeviceLink(db, symbol.id);
    await reportPosition(db, token, 53, 9, new Date()); // wird 'device'

    await moveMapSymbol(db, symbol.id, 5, 6); // Führungskraft verschiebt manuell
    const [loaded] = await listMapSymbols(db, op.id);
    expect(loaded).toMatchObject({ lat: 5, lng: 6, positionSource: "manual" });
    await db.close();
  });

  it("reports a live position that overrides the manual one, even after a manual move", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const symbol = await createMapSymbol(db, {
      operationId: op.id,
      composition,
      lat: 1,
      lng: 2,
    });
    const token = await generateDeviceLink(db, symbol.id);

    await moveMapSymbol(db, symbol.id, 10, 20); // Verbindung riss ab, manuell verschoben
    const at = new Date("2026-07-03T12:00:00Z");
    expect(await reportPosition(db, token, 53.5, 9.9, at)).toBe("ok");

    const [loaded] = await listMapSymbols(db, op.id);
    expect(loaded).toMatchObject({
      lat: 53.5,
      lng: 9.9,
      positionSource: "device",
    });
    expect(loaded.reportedAt?.toISOString()).toBe(at.toISOString());
    await db.close();
  });

  it("denies a position report for an unknown or regenerated token", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const symbol = await createMapSymbol(db, {
      operationId: op.id,
      composition,
      lat: 1,
      lng: 2,
    });
    const token = await generateDeviceLink(db, symbol.id);
    await generateDeviceLink(db, symbol.id); // Token neu generiert → alter ungültig

    expect(await reportPosition(db, token, 50, 8, new Date())).toBe("denied");
    expect(await reportPosition(db, "never-issued", 50, 8, new Date())).toBe(
      "denied",
    );
    await db.close();
  });

  it("denies reports for a closed operation and accepts again once reopened", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const symbol = await createMapSymbol(db, {
      operationId: op.id,
      composition,
      lat: 1,
      lng: 2,
    });
    const token = await generateDeviceLink(db, symbol.id);

    await closeOperation(db, op.id);
    expect(await reportPosition(db, token, 50, 8, new Date())).toBe("denied");

    await reopenOperation(db, op.id);
    expect(await reportPosition(db, token, 51, 7, new Date())).toBe("ok");
    await db.close();
  });

  it("resolves device access to the symbol and operation only while the operation is active", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const symbol = await createMapSymbol(db, {
      operationId: op.id,
      composition,
      lat: 1,
      lng: 2,
    });
    const token = await generateDeviceLink(db, symbol.id);

    expect(await resolveDeviceAccess(db, token)).toEqual({
      operationId: op.id,
    });
    expect(await resolveDeviceAccess(db, "nope")).toBeNull();

    await closeOperation(db, op.id);
    expect(await resolveDeviceAccess(db, token)).toBeNull(); // abgeschlossen → kein Zugang

    await reopenOperation(db, op.id);
    await generateDeviceLink(db, symbol.id); // Token neu generiert
    expect(await resolveDeviceAccess(db, token)).toBeNull(); // alter Link ungültig
    await db.close();
  });

  it("generates a device link and regenerating yields a different token", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const symbol = await createMapSymbol(db, {
      operationId: op.id,
      composition,
      lat: 1,
      lng: 2,
    });

    const token = await generateDeviceLink(db, symbol.id);
    expect(token).toBeTruthy();
    const regenerated = await generateDeviceLink(db, symbol.id);
    expect(regenerated).not.toBe(token);
    await db.close();
  });

  it("scopes symbols to their operation", async () => {
    const db = await freshDb();
    const a = await anOperation(db);
    const b = await anOperation(db);
    await createMapSymbol(db, {
      operationId: a.id,
      composition,
      lat: 1,
      lng: 2,
    });
    expect(await listMapSymbols(db, b.id)).toHaveLength(0);
    await db.close();
  });

  it("moves a symbol to a new position, keeping only the latest", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const s = await createMapSymbol(db, {
      operationId: op.id,
      composition,
      lat: 1,
      lng: 2,
    });
    await moveMapSymbol(db, s.id, 10, 20);

    const [loaded] = await listMapSymbols(db, op.id);
    expect(loaded).toMatchObject({ lat: 10, lng: 20 });
    await db.close();
  });

  it("updates the composition, leaving the position unchanged", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const s = await createMapSymbol(db, {
      operationId: op.id,
      composition,
      lat: 1,
      lng: 2,
    });
    const next: SymbolComposition = {
      grundzeichen: "ortsfeste-stelle",
      organisation: "feuerwehr",
      text: "FW 1",
    };
    await updateMapSymbolComposition(db, s.id, next);

    const [loaded] = await listMapSymbols(db, op.id);
    expect(loaded.composition).toEqual(next);
    expect(loaded).toMatchObject({ lat: 1, lng: 2 });
    await db.close();
  });

  it("deletes a symbol", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const s = await createMapSymbol(db, {
      operationId: op.id,
      composition,
      lat: 1,
      lng: 2,
    });
    await deleteMapSymbol(db, s.id);
    expect(await listMapSymbols(db, op.id)).toHaveLength(0);
    await db.close();
  });

  it("rejects placing a symbol at out-of-range coordinates", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await expect(
      createMapSymbol(db, {
        operationId: op.id,
        composition,
        lat: 200,
        lng: 9,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await listMapSymbols(db, op.id)).toHaveLength(0);
    await db.close();
  });

  it("rejects moving a symbol to invalid coordinates", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const s = await createMapSymbol(db, {
      operationId: op.id,
      composition,
      lat: 53.55,
      lng: 9.99,
    });
    await expect(
      moveMapSymbol(db, s.id, Number.NaN, 9.99),
    ).rejects.toBeInstanceOf(ValidationError);
    await db.close();
  });
});
