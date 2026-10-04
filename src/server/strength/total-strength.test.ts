import { describe, expect, it } from "vitest";
import { listEntries } from "@/server/journal/journal";
import { annulEntry } from "@/server/journal/journal-history";
import { closeOperation } from "@/server/operations/operation-lifecycle";
import { insertOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import type { StrengthValues } from "@/strength/strength";
import { freshDb } from "@/test/db";
import { createStation } from "./stations";
import { recordStrengthReport } from "./strength-reports";
import { reportTotalStrength } from "./total-strength";

type TestDb = Awaited<ReturnType<typeof freshDb>>;

async function anOperation(db: TestDb) {
  return insertOperation(db, { name: "Cyclassics", description: null });
}

async function aStation(db: TestDb, operationId: string, name: string) {
  return createStation(db, { operationId, name, author: "anna" });
}

const counts = (
  leaders: number,
  subLeaders: number,
  crew: number,
  additionalPersonnel: number,
): StrengthValues => ({
  leaders,
  subLeaders,
  crew,
  additionalPersonnel,
  note: null,
});

/** Erfasst eine Meldung und setzt die Zeit ihres ETB-Eintrags. */
async function report(
  db: TestDb,
  stationId: string,
  values: StrengthValues,
  reportedAt = new Date().toISOString(),
) {
  await db.transaction((tx) =>
    recordStrengthReport(tx, { stationId, values, author: "bernd" }),
  );
  await db.query(
    `UPDATE journal_entries SET created_at = $1
      WHERE id = (SELECT journal_entry_id FROM strength_reports
                   JOIN journal_entries e ON e.id = journal_entry_id
                  ORDER BY e.number DESC LIMIT 1)`,
    [reportedAt],
  );
}

const lastEntry = async (db: TestDb, operationId: string) =>
  (await listEntries(db, operationId)).at(-1);

describe("reportTotalStrength", () => {
  it("records the sum over the Stellen in the ETB with its author", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const nord = await aStation(db, op.id, "UHSt Nord");
    const sued = await aStation(db, op.id, "UHSt Süd");
    await aStation(db, op.id, "UHSt West");
    await report(db, nord.id, counts(9, 9, 9, 9), "2026-09-26T07:00:00Z");
    await report(db, nord.id, counts(1, 2, 10, 4), "2026-09-26T08:30:00Z");
    await report(db, sued.id, counts(1, 4, 15, 2), "2026-09-26T08:10:00Z");

    await reportTotalStrength(db, { operationId: op.id, author: "clara" });

    expect(await lastEntry(db, op.id)).toMatchObject({
      type: "gesamtstärke-gemeldet",
      author: "clara",
      text: "Gesamtstärke gemeldet: 2/6/25//33, +6 zusätzlich, 39 Personen (2 Stellen, älteste Meldung 10:10)",
    });
  });

  it("reports 0 Stellen when every Stelle reports 0", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const nord = await aStation(db, op.id, "UHSt Nord");
    await report(db, nord.id, counts(0, 0, 0, 0));

    await reportTotalStrength(db, { operationId: op.id, author: "clara" });

    expect((await lastEntry(db, op.id))?.text).toBe(
      "Gesamtstärke gemeldet: 0/0/0//0, +0 zusätzlich, 0 Personen (0 Stellen)",
    );
  });

  it("rejects a sum without any valid report, writing nothing", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const nord = await aStation(db, op.id, "UHSt Nord");
    await report(db, nord.id, counts(0, 1, 6, 2));
    const annulled = await db.query<{ id: string }>(
      "SELECT journal_entry_id AS id FROM strength_reports",
    );
    await db.query(
      "UPDATE journal_entries SET state = 'annulliert' WHERE id = $1",
      [annulled.rows[0].id],
    );
    const before = await listEntries(db, op.id);

    await expect(
      reportTotalStrength(db, { operationId: op.id, author: "clara" }),
    ).rejects.toThrow(
      new ValidationError("Es gibt noch keine gültige Stärkemeldung."),
    );
    expect(await listEntries(db, op.id)).toEqual(before);
  });

  it("still reports once the Gesamteinsatz is closed", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const nord = await aStation(db, op.id, "UHSt Nord");
    await report(db, nord.id, counts(0, 1, 6, 2));
    await closeOperation(db, op.id);

    await reportTotalStrength(db, { operationId: op.id, author: "clara" });

    expect((await lastEntry(db, op.id))?.type).toBe("gesamtstärke-gemeldet");
  });

  it("can be annulled", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const nord = await aStation(db, op.id, "UHSt Nord");
    await report(db, nord.id, counts(0, 1, 6, 2));
    await reportTotalStrength(db, { operationId: op.id, author: "clara" });
    const entry = await lastEntry(db, op.id);

    await annulEntry(db, entry?.id ?? "");

    expect((await lastEntry(db, op.id))?.state).toBe("annulliert");
  });

  it("includes a report numbered before it that it had to wait for", async () => {
    const db = await freshDb();
    const op = await anOperation(db);
    const nord = await aStation(db, op.id, "UHSt Nord");
    await report(db, nord.id, counts(0, 1, 6, 2));
    let recorded = () => {};
    const recordHolds = new Promise<void>((r) => {
      recorded = r;
    });
    let release = () => {};
    const released = new Promise<void>((r) => {
      release = r;
    });
    const recording = db.transaction(async (tx) => {
      await recordStrengthReport(tx, {
        stationId: nord.id,
        values: counts(1, 1, 1, 1),
        author: "bernd",
      });
      recorded();
      await released;
    });
    await recordHolds;

    const reporting = reportTotalStrength(db, {
      operationId: op.id,
      author: "clara",
    });
    await waitForALockWait(db);
    release();
    await Promise.all([recording, reporting]);

    const [reportEntry, totalEntry] = (await listEntries(db, op.id)).slice(-2);
    expect(reportEntry.type).toBe("stärkemeldung");
    expect(totalEntry.type).toBe("gesamtstärke-gemeldet");
    expect(totalEntry.text).toMatch(
      /^Gesamtstärke gemeldet: 1\/1\/1\/\/3, \+1 zusätzlich, 4 Personen/,
    );
  });
});

/** Wartet, bis eine Verbindung dieser Datenbank auf eine Zeilensperre wartet. */
async function waitForALockWait(db: TestDb) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const { rows } = await db.query<{ waiting: number }>(
      `SELECT count(*)::int AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if (rows[0].waiting > 0) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("Keine Verbindung wartet auf eine Sperre.");
}
