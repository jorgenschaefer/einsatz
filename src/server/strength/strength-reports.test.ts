import { describe, expect, it } from "vitest";
import { listEntries } from "@/server/journal/journal";
import { closeOperation } from "@/server/operations/operation-lifecycle";
import { insertOperation, lockOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import type { StrengthValues } from "@/strength/strength";
import { freshDb } from "@/test/db";
import { createStation, renameStation } from "./stations";
import { listStrengthReports, recordStrengthReport } from "./strength-reports";

type TestDb = Awaited<ReturnType<typeof freshDb>>;

async function aStation(db: TestDb, name = "UHSt 3") {
  const op = await insertOperation(db, {
    name: "Cyclassics",
    description: null,
  });
  const station = await createStation(db, {
    operationId: op.id,
    name,
    author: "anna",
  });
  return { op, station };
}

const values = (over: Partial<StrengthValues> = {}): StrengthValues => ({
  leaders: 0,
  subLeaders: 1,
  helpers: 6,
  additionalPersonnel: 2,
  note: "2 einsatzbereite Streifen",
  ...over,
});

function record(
  db: TestDb,
  stationId: string,
  reportValues: StrengthValues = values(),
) {
  return db.transaction((tx) =>
    recordStrengthReport(tx, {
      stationId,
      values: reportValues,
      author: "bernd",
    }),
  );
}

describe("recordStrengthReport", () => {
  it("stores the report with the time, state and number of its ETB entry", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);

    const operationId = await record(db, station.id);

    expect(operationId).toBe(op.id);
    const entry = (await listEntries(db, op.id)).at(-1);
    expect(await listStrengthReports(db, op.id)).toEqual([
      {
        id: expect.any(String),
        stationId: station.id,
        ...values(),
        reportedAt: entry?.createdAt,
        state: "gueltig",
        number: entry?.number,
      },
    ]);
  });

  it("records „Stärkemeldung …“ in the ETB with its author", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);

    await record(db, station.id);

    expect((await listEntries(db, op.id)).at(-1)).toEqual(
      expect.objectContaining({
        text: "Stärkemeldung UHSt 3: 0/1/6//7, +2 zusätzlich, 9 Personen – 2 einsatzbereite Streifen",
        type: "stärkemeldung",
        author: "bernd",
      }),
    );
  });

  it("trims the note and stores an empty one as none", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);

    await record(db, station.id, values({ note: " Streife 2 " }));
    await record(db, station.id, values({ note: "   " }));

    expect((await listStrengthReports(db, op.id)).map((r) => r.note)).toEqual([
      "Streife 2",
      null,
    ]);
    expect((await listEntries(db, op.id)).at(-1)?.text).toBe(
      "Stärkemeldung UHSt 3: 0/1/6//7, +2 zusätzlich, 9 Personen",
    );
  });

  it("accepts all zeros", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);
    const zero = values({
      leaders: 0,
      subLeaders: 0,
      helpers: 0,
      additionalPersonnel: 0,
      note: null,
    });

    await record(db, station.id, zero);

    expect(await listStrengthReports(db, op.id)).toEqual([
      expect.objectContaining(zero),
    ]);
  });

  it("accepts 9999", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);

    await record(db, station.id, values({ additionalPersonnel: 9999 }));

    expect(await listStrengthReports(db, op.id)).toEqual([
      expect.objectContaining({ additionalPersonnel: 9999 }),
    ]);
  });

  it.each([
    ["a negative number", { helpers: -1 }],
    ["a fraction", { leaders: 1.5 }],
    ["not a number", { subLeaders: Number.NaN }],
    ["a string", { additionalPersonnel: "3" as unknown as number }],
    ["more than 9999", { helpers: 10000 }],
  ])("rejects %s without writing anything", async (_, over) => {
    const db = await freshDb();
    const { op, station } = await aStation(db);
    const entriesBefore = await listEntries(db, op.id);

    await expect(record(db, station.id, values(over))).rejects.toThrow(
      new ValidationError(
        "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.",
      ),
    );
    expect(await listStrengthReports(db, op.id)).toEqual([]);
    expect(await listEntries(db, op.id)).toEqual(entriesBefore);
  });

  it("rejects a note that is not text without writing anything", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);

    await expect(
      record(db, station.id, values({ note: 42 as unknown as string })),
    ).rejects.toThrow(new ValidationError("Die Notiz muss Text sein."));
    expect(await listStrengthReports(db, op.id)).toEqual([]);
  });

  it("rejects an unknown Stelle", async () => {
    const db = await freshDb();

    await expect(
      record(db, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(new ValidationError("Stelle nicht gefunden."));
  });

  it("keeps both reports of a Stelle made in the same minute, in ETB order", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);

    await record(db, station.id, values({ helpers: 5 }));
    await record(db, station.id, values({ helpers: 4 }));

    const reports = await listStrengthReports(db, op.id);
    expect(reports.map((r) => r.helpers)).toEqual([5, 4]);
    expect(reports[1].number).toBeGreaterThan(reports[0].number);
  });

  it("still accepts a report once the Gesamteinsatz is closed", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);
    await closeOperation(db, op.id);

    await record(db, station.id);

    expect(await listStrengthReports(db, op.id)).toHaveLength(1);
  });

  it("names the Stelle as renamed by a rename it had to wait for", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);
    let renamed = () => {};
    const renameHolds = new Promise<void>((r) => {
      renamed = r;
    });
    let release = () => {};
    const released = new Promise<void>((r) => {
      release = r;
    });
    const rename = db.transaction(async (tx) => {
      await lockOperation(tx, op.id);
      await tx.query("UPDATE stations SET name = 'UHSt 3 Nord' WHERE id = $1", [
        station.id,
      ]);
      renamed();
      await released;
    });
    await renameHolds;

    const recording = record(db, station.id, values({ note: null }));
    // Die Meldung soll auf die Sperre des Einsatzes warten, bevor diese frei wird.
    await new Promise((r) => setTimeout(r, 300));
    release();
    await Promise.all([rename, recording]);

    expect((await listEntries(db, op.id)).at(-1)?.text).toBe(
      "Stärkemeldung UHSt 3 Nord: 0/1/6//7, +2 zusätzlich, 9 Personen",
    );
  });

  it("records and renames the same Stelle concurrently without deadlocking", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);

    await Promise.all(
      Array.from({ length: 10 }, (_, i) => [
        record(db, station.id),
        renameStation(db, {
          stationId: station.id,
          name: `UHSt 3-${i}`,
          author: "anna",
        }),
      ]).flat(),
    );

    expect(await listStrengthReports(db, op.id)).toHaveLength(10);
  });
});

describe("listStrengthReports", () => {
  it("shows an annulled entry's report as annulled", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);
    await record(db, station.id);
    const entry = (await listEntries(db, op.id)).at(-1);
    // Annullieren aus der Ansicht „Stärke“ baut ein eigenes Ticket; hier direkt.
    await db.query(
      "UPDATE journal_entries SET state = 'annulliert' WHERE id = $1",
      [entry?.id],
    );

    expect((await listStrengthReports(db, op.id))[0].state).toBe("annulliert");
  });

  it("lists only the reports of the given Gesamteinsatz", async () => {
    const db = await freshDb();
    const first = await aStation(db);
    const second = await aStation(db);
    await record(db, first.station.id);

    expect(await listStrengthReports(db, second.op.id)).toEqual([]);
  });
});
