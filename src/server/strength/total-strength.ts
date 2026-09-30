import { NO_ROUTE } from "@/journal/entry-route";
import type { Db } from "@/server/db/db";
import { appendEntry } from "@/server/journal/journal";
import { lockOperation } from "@/server/operations/operations";
import { ValidationError } from "@/server/validation";
import { formatTotalStrengthText, totalOf } from "@/strength/strength";
import { listStrengthReports, type StrengthReport } from "./strength-reports";

/** Schreibt die Summe über die Stellen als „Gesamtstärke gemeldet" ins ETB. */
export async function reportTotalStrength(
  db: Db,
  input: { operationId: string; author: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    // Erst die Einsatz-Sperre, dann die Summe: eine Meldung, die vor diesem
    // Eintrag ins ETB kommt, ist so auch in ihm enthalten.
    await lockOperation(tx, input.operationId);
    const reports = await listStrengthReports(tx, input.operationId);
    if (!reports.some((r) => r.state === "gueltig")) {
      throw new ValidationError("Es gibt noch keine gültige Stärkemeldung.");
    }
    await appendEntry(tx, {
      operationId: input.operationId,
      text: formatTotalStrengthText(totalOf(byStation(reports))),
      type: "gesamtstärke-gemeldet",
      author: input.author,
      route: NO_ROUTE,
    });
  });
}

function byStation(reports: StrengthReport[]): StrengthReport[][] {
  const grouped = new Map<string, StrengthReport[]>();
  for (const report of reports) {
    grouped.set(report.stationId, [
      ...(grouped.get(report.stationId) ?? []),
      report,
    ]);
  }
  return [...grouped.values()];
}
