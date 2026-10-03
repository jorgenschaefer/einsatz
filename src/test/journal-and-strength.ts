import type { Db } from "@/server/db/db";
import { appendEntry, listEntries } from "@/server/journal/journal";
import { insertOperation } from "@/server/operations/operations";
import { createStation, listStations } from "@/server/strength/stations";
import {
  listStrengthReports,
  recordStrengthReport,
} from "@/server/strength/strength-reports";

export interface JournalAndStrength {
  operationId: string;
  entryId: string;
  stationId: string;
  reportId: string;
}

/** Ein Einsatz mit einem manuellen ETB-Eintrag, einer Stelle und einer Stärkemeldung. */
export async function aJournalAndStrength(db: Db): Promise<JournalAndStrength> {
  const { id: operationId } = await insertOperation(db, {
    name: "Lage",
    description: null,
  });
  const entry = await db.transaction((tx) =>
    appendEntry(tx, {
      operationId,
      text: "Deich hält",
      type: "manuell",
      author: "anna",
      route: { sender: "UHSt 2", recipient: "EAL", channel: "Funk" },
    }),
  );
  const station = await createStation(db, {
    operationId,
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
        note: "Funk gestört",
      },
      author: "anna",
    }),
  );
  const [report] = await listStrengthReports(db, operationId);
  return {
    operationId,
    entryId: entry.id,
    stationId: station.id,
    reportId: report.id,
  };
}

/** ETB, Stellen und Stärkemeldungen des Einsatzes und die Zeilenzahl jeder ihrer Tabellen. */
export async function journalAndStrength(db: Db, operationId: string) {
  return {
    entries: await listEntries(db, operationId),
    stations: await listStations(db, operationId),
    reports: await listStrengthReports(db, operationId),
    rowCounts: await rowCounts(db),
  };
}

async function rowCounts(db: Db): Promise<Record<string, number>> {
  const tables = [
    "journal_entries",
    "journal_entry_revisions",
    "stations",
    "strength_reports",
  ];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { rows } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${table}`,
    );
    counts[table] = rows[0].n;
  }
  return counts;
}
