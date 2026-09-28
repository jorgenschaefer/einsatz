export interface StrengthCounts {
  leaders: number;
  subLeaders: number;
  helpers: number;
  additionalPersonnel: number;
}

export interface StrengthValues extends StrengthCounts {
  note: string | null;
}

/** Σ: Führer + Unterführer + Helfer. */
export function sumOf(values: StrengthCounts): number {
  return values.leaders + values.subLeaders + values.helpers;
}

/** Gesamtpersonen: Σ + zusätzliches Personal. */
export function totalPersonsOf(values: StrengthCounts): number {
  return sumOf(values) + values.additionalPersonnel;
}

export function formatStrengthReportText(
  stationName: string,
  values: StrengthValues,
): string {
  const { leaders, subLeaders, helpers, additionalPersonnel } = values;
  const text =
    `Stärkemeldung ${stationName}: ${leaders}/${subLeaders}/${helpers}//${sumOf(values)}, ` +
    `+${additionalPersonnel} zusätzlich, ${totalPersonsOf(values)} Personen`;
  const note = values.note?.trim();
  return note ? `${text} – ${note}` : text;
}

/** Die gültige Meldung mit der höchsten ETB-Nummer. */
export function latestValidReport<
  R extends { number: number; state: "gueltig" | "annulliert" },
>(reports: R[]): R | undefined {
  let latest: R | undefined;
  for (const report of reports) {
    if (report.state !== "gueltig") continue;
    if (!latest || report.number > latest.number) latest = report;
  }
  return latest;
}

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
    helpers: 0,
    additionalPersonnel: 0,
    stationCount: 0,
    oldestReportedAt: null,
  };
  for (const reports of reportsByStation) {
    const latest = latestValidReport(reports);
    if (!latest) continue;
    total.leaders += latest.leaders;
    total.subLeaders += latest.subLeaders;
    total.helpers += latest.helpers;
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
  const { leaders, subLeaders, helpers, additionalPersonnel } = total;
  const stations =
    total.stationCount === 1 ? "1 Stelle" : `${total.stationCount} Stellen`;
  const oldest = total.oldestReportedAt
    ? `, älteste Meldung ${berlinTimeOfDay(total.oldestReportedAt)}`
    : "";
  return (
    `Gesamtstärke gemeldet: ${leaders}/${subLeaders}/${helpers}//${sumOf(total)}, ` +
    `+${additionalPersonnel} zusätzlich, ${totalPersonsOf(total)} Personen (${stations}${oldest})`
  );
}

/** Uhrzeit HH:mm in Europe/Berlin, in der Ansicht wie im ETB-Text. */
export const berlinTimeOfDay = (time: Date | string) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
