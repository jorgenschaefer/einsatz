import { describe, expect, it } from "vitest";
import { type EntryRoute, NO_ROUTE } from "@/journal/entry-route";
import { insertOperation } from "@/server/operations/operations";
import { createStation, renameStation } from "@/server/strength/stations";
import { freshDb } from "@/test/db";
import { listCorrespondents } from "./correspondents";
import { appendEntry } from "./journal";
import { annulEntry, correctEntry } from "./journal-history";

type TestDb = Awaited<ReturnType<typeof freshDb>>;

async function anOperation(db: TestDb) {
  return insertOperation(db, { name: "Cyclassics", description: null });
}

function addEntry(db: TestDb, operationId: string, route: Partial<EntryRoute>) {
  return appendEntry(db, {
    operationId,
    text: "Deich hält",
    type: "manuell",
    author: "anna",
    route: { ...NO_ROUTE, ...route },
  });
}

function addStation(db: TestDb, operationId: string, name: string) {
  return createStation(db, { operationId, name, author: "anna" });
}

/** Die Gesprächspartner ohne Rücksicht auf ihre Reihenfolge. */
async function correspondentsOf(db: TestDb, operationId: string) {
  return (await listCorrespondents(db, operationId)).sort();
}

describe("listCorrespondents", () => {
  it("has none in a new Gesamteinsatz", async () => {
    const db = await freshDb();
    const op = await anOperation(db);

    expect(await listCorrespondents(db, op.id)).toEqual([]);
  });

  it("lists the Stellen and the Von and An of the entries once each", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await addStation(db, op.id, "UHSt 1");
    await addEntry(db, op.id, { sender: "UHSt 1", recipient: "EAL" });
    await addEntry(db, op.id, { sender: "Leitstelle", channel: "Telefon" });
    await addEntry(db, op.id, { recipient: "EAL" });

    expect(await correspondentsOf(db, op.id)).toEqual([
      "EAL",
      "Leitstelle",
      "UHSt 1",
    ]);
  });

  it("does not list the Weg", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await addEntry(db, op.id, { channel: "Funk" });

    expect(await listCorrespondents(db, op.id)).toEqual([]);
  });

  it("merges values differing only in case into the most recently used spelling", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await addEntry(db, op.id, { sender: "Eal" });
    await addEntry(db, op.id, { recipient: "EAL" });

    expect(await listCorrespondents(db, op.id)).toEqual(["EAL"]);
  });

  it("counts a Stelle as used when it is created or renamed", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const station = await addStation(db, op.id, "UHSt 2");
    await addEntry(db, op.id, { sender: "UHST 2" });

    expect(await listCorrespondents(db, op.id)).toEqual(["UHST 2"]);

    await renameStation(db, {
      stationId: station.id,
      name: "Uhst 2",
      author: "bernd",
    });

    expect(await listCorrespondents(db, op.id)).toEqual(["Uhst 2"]);
  });

  it("counts an entry as used again when it is corrected", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const older = await addEntry(db, op.id, { sender: "Eal" });
    await addEntry(db, op.id, { sender: "EAL" });

    await correctEntry(
      db,
      older.id,
      { text: "Deich hält nicht", ...NO_ROUTE, sender: "Eal" },
      "bernd",
    );

    expect(await listCorrespondents(db, op.id)).toEqual(["Eal"]);
  });

  it("leaves out the Von and An of an annulled entry", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const annulled = await addEntry(db, op.id, {
      sender: "UHSt 4",
      recipient: "ELW 1",
    });
    await annulEntry(db, annulled.id);

    expect(await listCorrespondents(db, op.id)).toEqual([]);
  });

  it("leaves out the spelling of an annulled entry", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    await addEntry(db, op.id, { sender: "Eal" });
    const annulled = await addEntry(db, op.id, { sender: "EAL" });
    await annulEntry(db, annulled.id);

    expect(await listCorrespondents(db, op.id)).toEqual(["Eal"]);
  });

  it("leaves out the Stellen and entries of another Gesamteinsatz", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const other = await anOperation(db);
    await addStation(db, other.id, "UHSt 1");
    await addEntry(db, other.id, { sender: "EAL", recipient: "Leitstelle" });

    expect(await listCorrespondents(db, op.id)).toEqual([]);
  });
});
