import type { Db } from "@/server/db/db";
import { appendEntry } from "@/server/journal/journal";
import { insertOperation } from "@/server/operations/operations";
import { createStation } from "@/server/strength/stations";
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
