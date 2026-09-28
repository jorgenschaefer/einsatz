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

/** Die Stärke-Schreibweise F/UF/H//Σ, z. B. „0/1/6//7". */
export function formatStrength(counts: StrengthCounts): string {
  return `${counts.leaders}/${counts.subLeaders}/${counts.helpers}//${sumOf(counts)}`;
}

export function formatStrengthReportText(
  stationName: string,
  values: StrengthValues,
): string {
  const text =
    `Stärkemeldung ${stationName}: ${formatStrength(values)}, ` +
    `+${values.additionalPersonnel} zusätzlich, ${totalPersonsOf(values)} Personen`;
  const note = values.note?.trim();
  return note ? `${text} – ${note}` : text;
}

type NumberedReport = { number: number; state: "gueltig" | "annulliert" };

/** Die gültige Meldung mit der höchsten ETB-Nummer: die neueste im Verlauf. */
export function latestValidReport<R extends NumberedReport>(
  reports: R[],
): R | undefined {
  return stationHistory(reports)[0];
}

/** Verlauf einer Stelle: ihre gültigen Meldungen, neueste zuerst. */
export function stationHistory<R extends NumberedReport>(reports: R[]): R[] {
  return reports
    .filter((report) => report.state === "gueltig")
    .sort((a, b) => b.number - a.number);
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

/** Uhrzeit HH:mm in Europe/Berlin, in der Ansicht wie im ETB-Text. */
export const berlinTimeOfDay = (time: Date | string) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
