import { randomUUID } from "node:crypto";
import type { Db, Queryable } from "@/server/db/db";
import {
  appendEntry,
  type JournalEntryState,
  reviseEntry,
} from "@/server/journal/journal";
import { lockOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import {
  formatStrengthReportText,
  type StrengthValues,
} from "@/strength/strength";

/** Zeit, Zustand und Reihenfolge einer Meldung sind die ihres ETB-Eintrags. */
export interface StrengthReport extends StrengthValues {
  id: string;
  stationId: string;
  reportedAt: Date;
  state: JournalEntryState;
  number: number;
}

/**
 * Erfasst eine Stärkemeldung samt ETB-Eintrag; muss innerhalb einer
 * Transaktion laufen. Liefert die `operationId` des Gesamteinsatzes der Stelle.
 */
export async function recordStrengthReport(
  tx: Queryable,
  input: { stationId: string; values: StrengthValues; author: string },
): Promise<string> {
  const values = requireStrengthValues(input.values);
  const station = await loadStation(tx, input.stationId);
  // Erst die Einsatz-Sperre, dann der Name: eine Umbenennung, die vor dieser
  // Meldung ins ETB kommt, steht so auch in ihrem Text.
  await lockOperation(tx, station.operationId);
  const { name } = await loadStation(tx, input.stationId);
  const entry = await appendEntry(tx, {
    operationId: station.operationId,
    text: formatStrengthReportText(name, values),
    type: "stärkemeldung",
    author: input.author,
  });
  await tx.query(
    `INSERT INTO strength_reports
       (id, station_id, journal_entry_id, leaders, sub_leaders, helpers, additional_personnel, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      randomUUID(),
      input.stationId,
      entry.id,
      values.leaders,
      values.subLeaders,
      values.helpers,
      values.additionalPersonnel,
      values.note,
    ],
  );
  return station.operationId;
}

async function loadStation(
  tx: Queryable,
  stationId: string,
): Promise<{ operationId: string; name: string }> {
  const { rows } = await tx.query<{ operation_id: string; name: string }>(
    "SELECT operation_id, name FROM stations WHERE id = $1",
    [stationId],
  );
  if (!rows[0]) throw new ValidationError("Stelle nicht gefunden.");
  return { operationId: rows[0].operation_id, name: rows[0].name };
}

/**
 * Korrigiert Stelle, Werte und Notiz einer Meldung; ihre Uhrzeit bleibt. Liefert
 * die `operationId` ihres Gesamteinsatzes.
 */
export async function correctStrengthReport(
  db: Db,
  input: {
    reportId: string;
    stationId: string;
    values: StrengthValues;
    author: string;
  },
): Promise<string> {
  const values = requireStrengthValues(input.values);
  return db.transaction(async (tx) => {
    const {
      rows: [report],
    } = await tx.query<{ operation_id: string; journal_entry_id: string }>(
      `SELECT s.operation_id, r.journal_entry_id
         FROM strength_reports r
         JOIN stations s ON s.id = r.station_id
        WHERE r.id = $1`,
      [input.reportId],
    );
    if (!report) throw new ValidationError("Meldung nicht gefunden.");
    const operationId = report.operation_id;
    // Wie bei der Erfassung: erst die Einsatz-Sperre, dann der Name der Stelle.
    await lockOperation(tx, operationId);
    const {
      rows: [station],
    } = await tx.query<{ name: string }>(
      "SELECT name FROM stations WHERE id = $1 AND operation_id = $2",
      [input.stationId, operationId],
    );
    if (!station) throw new ValidationError("Stelle nicht gefunden.");
    await tx.query(
      `UPDATE strength_reports
          SET station_id = $2, leaders = $3, sub_leaders = $4, helpers = $5,
              additional_personnel = $6, note = $7
        WHERE id = $1`,
      [
        input.reportId,
        input.stationId,
        values.leaders,
        values.subLeaders,
        values.helpers,
        values.additionalPersonnel,
        values.note,
      ],
    );
    await reviseEntry(
      tx,
      report.journal_entry_id,
      formatStrengthReportText(station.name, values),
      input.author,
    );
    return operationId;
  });
}

/** Alle Meldungen der Stellen eines Gesamteinsatzes, in ETB-Reihenfolge. */
export async function listStrengthReports(
  db: Queryable,
  operationId: string,
): Promise<StrengthReport[]> {
  const { rows } = await db.query<{
    id: string;
    station_id: string;
    leaders: number;
    sub_leaders: number;
    helpers: number;
    additional_personnel: number;
    note: string | null;
    created_at: string | Date;
    state: JournalEntryState;
    number: number;
  }>(
    `SELECT r.id, r.station_id, r.leaders, r.sub_leaders, r.helpers,
            r.additional_personnel, r.note, e.created_at, e.state, e.number
       FROM strength_reports r
       JOIN journal_entries e ON e.id = r.journal_entry_id
      WHERE e.operation_id = $1
      ORDER BY e.number ASC`,
    [operationId],
  );
  return rows.map((row) => ({
    id: row.id,
    stationId: row.station_id,
    leaders: row.leaders,
    subLeaders: row.sub_leaders,
    helpers: row.helpers,
    additionalPersonnel: row.additional_personnel,
    note: row.note,
    reportedAt: new Date(row.created_at),
    state: row.state,
    number: row.number,
  }));
}

const MAX_COUNT = 9999;

function requireStrengthValues(values: StrengthValues): StrengthValues {
  const counts = [
    values.leaders,
    values.subLeaders,
    values.helpers,
    values.additionalPersonnel,
  ];
  if (!counts.every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_COUNT)) {
    throw new ValidationError(
      "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.",
    );
  }
  if (values.note !== null && typeof values.note !== "string") {
    throw new ValidationError("Die Notiz muss Text sein.");
  }
  return { ...values, note: values.note?.trim() || null };
}
