import { describe, expect, it } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import type { MapView } from "@/map/view";
import type { Db } from "@/server/db/db";
import { appendEntry, listEntries } from "@/server/journal/journal";
import {
  createMapSymbol,
  listMapSymbols,
} from "@/server/mapsymbols/map-symbols";
import { createStation, listStations } from "@/server/strength/stations";
import {
  listStrengthReports,
  recordStrengthReport,
} from "@/server/strength/strength-reports";
import { ValidationError } from "@/server/validation";
import { freshDb } from "@/test/db";
import {
  deleteOperationRow,
  getOperation,
  insertOperation,
  listOperations,
  setDefaultView,
  setOperationStatus,
} from "./operations";

describe("operations repository", () => {
  it("inserts an active operation and reads it back", async () => {
    const db = await freshDb();
    const created = await insertOperation(db, {
      name: "Hochwasser",
      description: "Deich Nord",
    });
    expect(created).toMatchObject({
      name: "Hochwasser",
      description: "Deich Nord",
      status: "active",
    });
    expect(created.startedAt).toBeInstanceOf(Date);
    expect(created.defaultView).toBeNull();

    const found = await getOperation(db, created.id);
    expect(found).toMatchObject({ id: created.id, name: "Hochwasser" });
  });

  it("returns null for an unknown operation", async () => {
    const db = await freshDb();
    expect(
      await getOperation(db, "00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
  });

  it("returns null for an id that is not a UUID", async () => {
    const db = await freshDb();
    expect(await getOperation(db, "marker-icon.png")).toBeNull();
  });

  it("finds an operation by its id in upper case", async () => {
    const db = await freshDb();
    const created = await insertOperation(db, {
      name: "Hochwasser",
      description: null,
    });
    expect(await getOperation(db, created.id.toUpperCase())).toMatchObject({
      id: created.id,
    });
  });

  it("persists a default map view that reads back on the operation", async () => {
    const db = await freshDb();
    const op = await insertOperation(db, {
      name: "Hochwasser",
      description: null,
    });
    await setDefaultView(db, op.id, { lat: 53.55, lng: 9.99, zoom: 13 });

    const reloaded = await getOperation(db, op.id);
    expect(reloaded?.defaultView).toEqual({ lat: 53.55, lng: 9.99, zoom: 13 });
  });

  it("rejects a default view with invalid coordinates or zoom, writing nothing", async () => {
    const db = await freshDb();
    const op = await insertOperation(db, {
      name: "Hochwasser",
      description: null,
    });
    const set = (view: MapView) => setDefaultView(db, op.id, view);

    await expect(
      set({ lat: Number.NaN, lng: 9.99, zoom: 13 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      set({ lat: 53.55, lng: 9.99, zoom: 20 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      set({ lat: 53.55, lng: 9.99, zoom: -1 }),
    ).rejects.toBeInstanceOf(ValidationError);

    expect((await getOperation(db, op.id))?.defaultView).toBeNull();
  });

  it("accepts a default view at the tile-layer max zoom (19)", async () => {
    const db = await freshDb();
    const op = await insertOperation(db, {
      name: "Hochwasser",
      description: null,
    });
    await setDefaultView(db, op.id, { lat: 53.55, lng: 9.99, zoom: 19 });
    expect((await getOperation(db, op.id))?.defaultView).toEqual({
      lat: 53.55,
      lng: 9.99,
      zoom: 19,
    });
  });

  it("lists all operations, newest first", async () => {
    const db = await freshDb();
    await insertOperation(db, { name: "Erst", description: null });
    await insertOperation(db, { name: "Zweit", description: null });
    const all = await listOperations(db);
    expect(all).toHaveLength(2);
    expect(all.map((o) => o.name)).toContain("Erst");
    expect(all.map((o) => o.name)).toContain("Zweit");
  });
});

describe("deleteOperationRow", () => {
  async function closedOperation(db: Db, name: string) {
    const op = await insertOperation(db, { name, description: null });
    await setOperationStatus(db, op.id, "closed");
    return op;
  }

  it("deletes a closed operation only, reporting whether it did", async () => {
    const db = await freshDb();
    const active = await insertOperation(db, {
      name: "Läuft",
      description: null,
    });
    const closed = await closedOperation(db, "Ruhig");

    expect(await deleteOperationRow(db, active.id)).toBe(false);
    expect(await deleteOperationRow(db, closed.id)).toBe(true);

    expect(await getOperation(db, active.id)).not.toBeNull();
    expect(await getOperation(db, closed.id)).toBeNull();
  });

  it("deletes the operation and cascades its journal entries and map symbols", async () => {
    const db = await freshDb();
    const op = await closedOperation(db, "Hochwasser");
    await appendEntry(db, {
      operationId: op.id,
      text: "Lage",
      type: "manuell",
      author: "anna",
      route: NO_ROUTE,
    });
    await createMapSymbol(db, {
      operationId: op.id,
      composition: { organisation: "hilfsorganisation" },
      lat: 1,
      lng: 2,
    });

    await deleteOperationRow(db, op.id);

    expect(await getOperation(db, op.id)).toBeNull();
    expect(await listEntries(db, op.id)).toHaveLength(0);
    expect(await listMapSymbols(db, op.id)).toHaveLength(0);
  });

  it("cascades the operation's Stellen, their Stärkemeldungen and ETB entries", async () => {
    const db = await freshDb();
    const op = await closedOperation(db, "Cyclassics");
    const station = await createStation(db, {
      operationId: op.id,
      name: "UHSt 3",
      author: "anna",
    });
    await db.transaction((tx) =>
      recordStrengthReport(tx, {
        stationId: station.id,
        values: {
          leaders: 0,
          subLeaders: 1,
          crew: 6,
          additionalPersonnel: 2,
          note: null,
        },
        author: "anna",
      }),
    );

    await deleteOperationRow(db, op.id);

    expect(await listStations(db, op.id)).toHaveLength(0);
    expect(await listStrengthReports(db, op.id)).toHaveLength(0);
    expect(await listEntries(db, op.id)).toHaveLength(0);
    const { rows } = await db.query("SELECT id FROM strength_reports");
    expect(rows).toHaveLength(0);
  });
});
