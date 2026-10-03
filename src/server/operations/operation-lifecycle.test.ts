import { describe, expect, it } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import type { Db } from "@/server/db/db";
import { appendEntry, listEntries } from "@/server/journal/journal";
import {
  createMapSymbol,
  generateDeviceLink,
  listMapSymbols,
  reportPosition,
  resolveDeviceAccess,
} from "@/server/mapsymbols/map-symbols";
import { ValidationError } from "@/server/validation";
import {
  createViewLink,
  listViewLinks,
  resolveViewAccess,
} from "@/server/viewlinks/view-links";
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
      route: NO_ROUTE,
    });
    expect(
      (await listEntries(db, op.id)).some((e) => e.text === "nachträglich"),
    ).toBe(true);
  });
});

describe("closing an operation deletes its Gerätelinks and Ansichtslinks", () => {
  async function operationWithLinks(db: Db) {
    const op = await createOperation(db, { name: "Hochwasser" });
    for (const label of ["Leitstelle", "Stab"]) {
      await createViewLink(db, { operationId: op.id, label });
    }
    for (const lat of [1, 2]) {
      const symbol = await createMapSymbol(db, {
        operationId: op.id,
        composition: { grundzeichen: "kraftfahrzeug-landgebunden" },
        lat,
        lng: 2,
      });
      await generateDeviceLink(db, symbol.operationId, symbol.id);
    }
    return op;
  }

  const deviceTokens = async (db: Db, operationId: string) =>
    (await listMapSymbols(db, operationId)).map((s) => s.deviceLinkToken);

  it("removes every Gerätelink and Ansichtslink of the closed operation", async () => {
    const db = await freshDb();
    const op = await operationWithLinks(db);

    await closeOperation(db, op.id);

    expect(await deviceTokens(db, op.id)).toEqual([null, null]);
    expect(await listViewLinks(db, op.id)).toEqual([]);
  });

  it("makes Kartenzeichen whose device had reported manually placed again", async () => {
    const db = await freshDb();
    const op = await operationWithLinks(db);
    for (const token of await deviceTokens(db, op.id)) {
      await reportPosition(db, token as string, 53.6, 10.1);
    }

    await closeOperation(db, op.id);

    expect(
      (await listMapSymbols(db, op.id)).map((s) => s.positionSource),
    ).toEqual(["manual", "manual"]);
  });

  it("leaves another operation's links alone", async () => {
    const db = await freshDb();
    const op = await operationWithLinks(db);
    const other = await operationWithLinks(db);
    const otherTokens = await deviceTokens(db, other.id);
    const otherViewLinks = await listViewLinks(db, other.id);

    await closeOperation(db, op.id);

    expect(await deviceTokens(db, other.id)).toEqual(otherTokens);
    expect(await listViewLinks(db, other.id)).toEqual(otherViewLinks);
  });

  it("changes nothing when the operation is already closed", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Hochwasser" });
    await closeOperation(db, op.id);
    const link = await createViewLink(db, {
      operationId: op.id,
      label: "Leitstelle",
    });

    await closeOperation(db, op.id);

    expect(await listViewLinks(db, op.id)).toEqual([link]);
  });

  it("keeps old links dead after reopening, while new ones work", async () => {
    const db = await freshDb();
    const op = await createOperation(db, { name: "Hochwasser" });
    const symbol = await createMapSymbol(db, {
      operationId: op.id,
      composition: { grundzeichen: "kraftfahrzeug-landgebunden" },
      lat: 1,
      lng: 2,
    });
    const oldDeviceToken = await generateDeviceLink(
      db,
      symbol.operationId,
      symbol.id,
    );
    const oldViewLink = await createViewLink(db, {
      operationId: op.id,
      label: "Leitstelle",
    });

    await closeOperation(db, op.id);
    await reopenOperation(db, op.id);

    expect(await resolveDeviceAccess(db, oldDeviceToken)).toBeNull();
    expect(await resolveViewAccess(db, oldViewLink.token)).toBeNull();
    const newDeviceToken = await generateDeviceLink(
      db,
      symbol.operationId,
      symbol.id,
    );
    const newViewLink = await createViewLink(db, {
      operationId: op.id,
      label: "Leitstelle",
    });
    expect(await resolveDeviceAccess(db, newDeviceToken)).toEqual({
      operationId: op.id,
    });
    expect(await resolveViewAccess(db, newViewLink.token)).toEqual({
      operationId: op.id,
    });
  });

  it.each([
    ["closing", closeOperation],
    ["reopening", reopenOperation],
  ])("rejects %s with an Einsatz-ID that is not a UUID", async (_, change) => {
    const db = await freshDb();
    await expect(change(db, "op-1")).rejects.toThrow(
      new ValidationError("Ungültige ID."),
    );
  });
});
