export interface StrengthCounts {
  leaders: number;
  subLeaders: number;
  crew: number;
  additionalPersonnel: number;
}

export interface StrengthValues extends StrengthCounts {
  note: string | null;
}

/** G (Gesamt): Führer + Unterführer + Einsatzkräfte. */
export function sumOf(values: StrengthCounts): number {
  return values.leaders + values.subLeaders + values.crew;
}

/** Gesamtpersonen: G + zusätzliches Personal. */
export function totalPersonsOf(values: StrengthCounts): number {
  return sumOf(values) + values.additionalPersonnel;
}

/** Die Stärke F/UF/E/G als reiner Text, z. B. „0/1/6//7" (im ETB). */
export function formatStrength(counts: StrengthCounts): string {
  return `${counts.leaders}/${counts.subLeaders}/${counts.crew}//${sumOf(counts)}`;
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
