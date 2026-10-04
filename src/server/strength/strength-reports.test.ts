import { describe, expect, it } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import { listEntries } from "@/server/journal/journal";
import { closeOperation } from "@/server/operations/operation-lifecycle";
import { insertOperation, lockOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import {
  formatStrengthReportText,
  type StrengthValues,
} from "@/strength/strength";
import { freshDb } from "@/test/db";
import { createStation, renameStation } from "./stations";
import {
  annulStrengthReport,
  correctStrengthReport,
  listStrengthReports,
  recordStrengthReport,
} from "./strength-reports";

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
  crew: 6,
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

async function aReport(db: TestDb) {
  const { op, station } = await aStation(db);
  await record(db, station.id);
  const [report] = await listStrengthReports(db, op.id);
  return { op, station, report };
}

const INVALID_COUNTS = new ValidationError(
  "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.",
);

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

  it("stores the note as checked, trimmed", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);

    await record(db, station.id, values({ note: " Streife 2 " }));

    expect((await listStrengthReports(db, op.id))[0].note).toBe("Streife 2");
  });

  it("rejects bad values without writing anything", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);
    const entriesBefore = await listEntries(db, op.id);

    await expect(record(db, station.id, values({ crew: -1 }))).rejects.toThrow(
      INVALID_COUNTS,
    );
    expect(await listStrengthReports(db, op.id)).toEqual([]);
    expect(await listEntries(db, op.id)).toEqual(entriesBefore);
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

    await record(db, station.id, values({ crew: 5 }));
    await record(db, station.id, values({ crew: 4 }));

    const reports = await listStrengthReports(db, op.id);
    expect(reports.map((r) => r.crew)).toEqual([5, 4]);
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
    await whileRenamingUnderLock(db, op.id, station.id, () =>
      record(db, station.id, values({ note: null })),
    );

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

describe("correctStrengthReport", () => {
  function correct(
    db: TestDb,
    reportId: string,
    stationId: string,
    correctedValues: StrengthValues = values({ crew: 5, note: null }),
  ) {
    return correctStrengthReport(db, {
      reportId,
      stationId,
      values: correctedValues,
      author: "clara",
    });
  }

  it("changes the values and keeps the time and number", async () => {
    const db = await freshDb();
    const { op, station, report } = await aReport(db);

    const operationId = await correct(db, report.id, station.id);

    expect(operationId).toBe(op.id);
    expect(await listStrengthReports(db, op.id)).toEqual([
      {
        ...report,
        ...values({ crew: 5, note: null }),
      },
    ]);
  });

  it("corrects the ETB entry and keeps the prior fassung with its author and time", async () => {
    const db = await freshDb();
    const { op, station, report } = await aReport(db);
    const [before] = (await listEntries(db, op.id)).slice(-1);

    await correct(db, report.id, station.id);

    const after = (await listEntries(db, op.id)).at(-1);
    expect(after).toEqual({
      ...before,
      text: "Stärkemeldung UHSt 3: 0/1/5//6, +2 zusätzlich, 8 Personen",
      author: "clara",
      editedAt: expect.any(Date),
      revisions: [
        {
          text: before.text,
          author: "bernd",
          createdAt: before.createdAt,
          ...NO_ROUTE,
        },
      ],
    });
  });

  it("moves the report to another Stelle and names it as called now", async () => {
    const db = await freshDb();
    const { op, report } = await aReport(db);
    const other = await createStation(db, {
      operationId: op.id,
      name: "UHSt 4",
      author: "anna",
    });
    await renameStation(db, {
      stationId: other.id,
      name: "UHSt 4 Süd",
      author: "anna",
    });

    await correct(db, report.id, other.id);

    expect((await listStrengthReports(db, op.id))[0].stationId).toBe(other.id);
    expect(
      (await listEntries(db, op.id)).find((e) => e.number === report.number)
        ?.text,
    ).toBe("Stärkemeldung UHSt 4 Süd: 0/1/5//6, +2 zusätzlich, 8 Personen");
  });

  it("rejects a Stelle of another Gesamteinsatz without writing anything", async () => {
    const db = await freshDb();
    const { op, report } = await aReport(db);
    const foreign = await aStation(db, "UHSt 9");
    const entriesBefore = await listEntries(db, op.id);

    await expect(correct(db, report.id, foreign.station.id)).rejects.toThrow(
      new ValidationError("Stelle nicht gefunden."),
    );
    expect(await listStrengthReports(db, op.id)).toEqual([report]);
    expect(await listEntries(db, op.id)).toEqual(entriesBefore);
  });

  it("rejects an unknown report", async () => {
    const db = await freshDb();
    const { station } = await aStation(db);

    await expect(
      correct(db, "00000000-0000-0000-0000-000000000000", station.id),
    ).rejects.toThrow(new ValidationError("Meldung nicht gefunden."));
  });

  it("rejects an annulled report without writing anything", async () => {
    const db = await freshDb();
    const { op, station, report } = await aReport(db);
    await annulStrengthReport(db, report.id);
    const [annulled] = await listStrengthReports(db, op.id);
    const entriesBefore = await listEntries(db, op.id);

    await expect(correct(db, report.id, station.id)).rejects.toThrow(
      new ValidationError("Annullierte Einträge können nicht geändert werden."),
    );
    expect(await listStrengthReports(db, op.id)).toEqual([annulled]);
    expect(await listEntries(db, op.id)).toEqual(entriesBefore);
  });

  it("rejects bad values without writing anything", async () => {
    const db = await freshDb();
    const { op, station, report } = await aReport(db);
    const entriesBefore = await listEntries(db, op.id);

    await expect(
      correct(db, report.id, station.id, values({ crew: 10000 })),
    ).rejects.toThrow(INVALID_COUNTS);
    expect(await listStrengthReports(db, op.id)).toEqual([report]);
    expect(await listEntries(db, op.id)).toEqual(entriesBefore);
  });

  it("stores the note as checked, trimmed", async () => {
    const db = await freshDb();
    const { station, op, report } = await aReport(db);

    await correct(db, report.id, station.id, values({ note: "  Streife 3 " }));

    expect((await listStrengthReports(db, op.id))[0].note).toBe("Streife 3");
  });

  it("still corrects once the Gesamteinsatz is closed", async () => {
    const db = await freshDb();
    const { op, station, report } = await aReport(db);
    await closeOperation(db, op.id);

    await correct(db, report.id, station.id);

    expect((await listStrengthReports(db, op.id))[0].crew).toBe(5);
  });

  it("runs concurrent corrections one after the other; both leave a fassung and the later wins", async () => {
    const db = await freshDb();
    const { op, station, report } = await aReport(db);
    let entryHeld = () => {};
    const entryHolds = new Promise<void>((r) => {
      entryHeld = r;
    });
    let release = () => {};
    const released = new Promise<void>((r) => {
      release = r;
    });
    const holding = db.transaction(async (tx) => {
      await tx.query(
        "SELECT id FROM journal_entries WHERE number = $1 AND operation_id = $2 FOR UPDATE",
        [report.number, op.id],
      );
      entryHeld();
      await released;
    });
    await entryHolds;

    const correcting = Promise.all([
      correct(db, report.id, station.id, values({ crew: 5, note: null })),
      correct(db, report.id, station.id, values({ crew: 4, note: null })),
    ]);
    // Beide Korrekturen sollen laufen, bevor der Eintrag frei wird.
    await new Promise((r) => setTimeout(r, 300));
    release();
    await Promise.all([holding, correcting]);

    const entry = (await listEntries(db, op.id)).at(-1);
    const [corrected] = await listStrengthReports(db, op.id);
    expect(entry?.revisions.map((r) => r.text)).toEqual([
      "Stärkemeldung UHSt 3: 0/1/6//7, +2 zusätzlich, 9 Personen – 2 einsatzbereite Streifen",
      corrected.crew === 4
        ? "Stärkemeldung UHSt 3: 0/1/5//6, +2 zusätzlich, 8 Personen"
        : "Stärkemeldung UHSt 3: 0/1/4//5, +2 zusätzlich, 7 Personen",
    ]);
    expect(entry?.text).toBe(formatStrengthReportText("UHSt 3", corrected));
  });

  it("names the Stelle as renamed by a rename it had to wait for", async () => {
    const db = await freshDb();
    const { op, station, report } = await aReport(db);
    await whileRenamingUnderLock(db, op.id, station.id, () =>
      correct(db, report.id, station.id),
    );

    expect(
      (await listEntries(db, op.id)).find((e) => e.number === report.number)
        ?.text,
    ).toBe("Stärkemeldung UHSt 3 Nord: 0/1/5//6, +2 zusätzlich, 8 Personen");
  });
});

describe("annulStrengthReport", () => {
  it("annuls the report and keeps its ETB entry with number and text", async () => {
    const db = await freshDb();
    const { op, report } = await aReport(db);
    const entryBefore = (await listEntries(db, op.id)).at(-1);

    const operationId = await annulStrengthReport(db, report.id);

    expect(operationId).toBe(op.id);
    expect(await listStrengthReports(db, op.id)).toEqual([
      { ...report, state: "annulliert" },
    ]);
    expect((await listEntries(db, op.id)).at(-1)).toEqual({
      ...entryBefore,
      state: "annulliert",
    });
  });

  it("rejects an annulled report without writing anything", async () => {
    const db = await freshDb();
    const { op, report } = await aReport(db);
    await annulStrengthReport(db, report.id);
    const entriesBefore = await listEntries(db, op.id);

    await expect(annulStrengthReport(db, report.id)).rejects.toThrow(
      new ValidationError("Annullierte Einträge können nicht geändert werden."),
    );
    expect(await listEntries(db, op.id)).toEqual(entriesBefore);
  });

  it("rejects an unknown report", async () => {
    const db = await freshDb();

    await expect(
      annulStrengthReport(db, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(new ValidationError("Meldung nicht gefunden."));
  });

  it("still annuls once the Gesamteinsatz is closed", async () => {
    const db = await freshDb();
    const { op, report } = await aReport(db);
    await closeOperation(db, op.id);

    await annulStrengthReport(db, report.id);

    expect((await listStrengthReports(db, op.id))[0].state).toBe("annulliert");
  });
});

describe("listStrengthReports", () => {
  it("shows an annulled entry's report as annulled", async () => {
    const db = await freshDb();
    const { op, station } = await aStation(db);
    await record(db, station.id);
    const [report] = await listStrengthReports(db, op.id);
    await annulStrengthReport(db, report.id);

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

/**
 * Benennt die Stelle in „UHSt 3 Nord“ um, während der Einsatz gesperrt ist,
 * und startet `write` in dieser Zeit: `write` muss auf die Sperre warten.
 */
async function whileRenamingUnderLock(
  db: TestDb,
  operationId: string,
  stationId: string,
  write: () => Promise<unknown>,
) {
  let renamed = () => {};
  const renameHolds = new Promise<void>((r) => {
    renamed = r;
  });
  let release = () => {};
  const released = new Promise<void>((r) => {
    release = r;
  });
  const rename = db.transaction(async (tx) => {
    await lockOperation(tx, operationId);
    await tx.query("UPDATE stations SET name = 'UHSt 3 Nord' WHERE id = $1", [
      stationId,
    ]);
    renamed();
    await released;
  });
  await renameHolds;

  const writing = write();
  await new Promise((r) => setTimeout(r, 300));
  release();
  await Promise.all([rename, writing]);
}
