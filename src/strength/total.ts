import {
  berlinTimeOfDay,
  formatStrength,
  latestValidReport,
  type StrengthCounts,
  stationHistory,
  totalPersonsOf,
} from "./strength";

/** Eine Meldung mit der Zeit, dem Zustand und der Nummer ihres ETB-Eintrags. */
export interface ReportedStrength extends StrengthCounts {
  reportedAt: Date | string;
  number: number;
  state: "gueltig" | "annulliert";
}

/** Summe über die Stellen. */
export interface Total extends StrengthCounts {
  /** Stellen, deren letzte gültige Meldung mehr als 0 Personen hat. */
  stationCount: number;
  /** Älteste dieser Meldungen; null, wenn keine Stelle zählt. */
  oldestReportedAt: Date | null;
}

/** Summiert die letzte gültige Meldung jeder Stelle. */
export function totalOf(reportsByStation: ReportedStrength[][]): Total {
  const total: Total = {
    leaders: 0,
    subLeaders: 0,
    crew: 0,
    additionalPersonnel: 0,
    stationCount: 0,
    oldestReportedAt: null,
  };
  for (const reports of reportsByStation) {
    const latest = latestValidReport(reports);
    if (!latest) continue;
    total.leaders += latest.leaders;
    total.subLeaders += latest.subLeaders;
    total.crew += latest.crew;
    total.additionalPersonnel += latest.additionalPersonnel;
    if (totalPersonsOf(latest) === 0) continue;
    total.stationCount += 1;
    const reportedAt = new Date(latest.reportedAt);
    if (!total.oldestReportedAt || reportedAt < total.oldestReportedAt) {
      total.oldestReportedAt = reportedAt;
    }
  }
  return total;
}

/** Eine Zeile des Summenverlaufs: eine gültige Meldung und die Summe, die dann galt. */
export interface TotalHistoryRow {
  number: number;
  reportedAt: Date | string;
  total: Total;
}

/** Summenverlauf: eine Zeile je gültiger Meldung, neueste zuerst. */
export function totalHistory(
  reportsByStation: ReportedStrength[][],
): TotalHistoryRow[] {
  return stationHistory(reportsByStation.flat()).map((row) => {
    const rowTime = new Date(row.reportedAt).getTime();
    const reportedByThen = reportsByStation.map((reports) =>
      reports.filter((r) => new Date(r.reportedAt).getTime() <= rowTime),
    );
    return {
      number: row.number,
      reportedAt: row.reportedAt,
      total: totalOf(reportedByThen),
    };
  });
}

/** Eine Meldung gilt nach 60 Minuten als veraltet. */
export const REPORT_STALE_AFTER_MS = 60 * 60 * 1000;

/** Eine Meldung mit 0 Personen (Stelle abgebaut) veraltet nie. */
export function isReportStale(
  report: StrengthCounts & { reportedAt: Date | string },
  now: number,
): boolean {
  return totalPersonsOf(report) > 0 && isOlderThanLimit(report.reportedAt, now);
}

export function isTotalStale(total: Total, now: number): boolean {
  return (
    total.oldestReportedAt !== null &&
    isOlderThanLimit(total.oldestReportedAt, now)
  );
}

const isOlderThanLimit = (reportedAt: Date | string, now: number) =>
  now - new Date(reportedAt).getTime() > REPORT_STALE_AFTER_MS;

export function formatTotalStrengthText(total: Total): string {
  const stations =
    total.stationCount === 1 ? "1 Stelle" : `${total.stationCount} Stellen`;
  const oldest = total.oldestReportedAt
    ? `, älteste Meldung ${berlinTimeOfDay(total.oldestReportedAt)}`
    : "";
  return (
    `Gesamtstärke gemeldet: ${formatStrength(total)}, ` +
    `+${total.additionalPersonnel} zusätzlich, ${totalPersonsOf(total)} Personen (${stations}${oldest})`
  );
}
