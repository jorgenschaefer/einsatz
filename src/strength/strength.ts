export interface StrengthValues {
  leaders: number;
  subLeaders: number;
  helpers: number;
  additionalPersonnel: number;
  note: string | null;
}

/** Σ: Führer + Unterführer + Helfer. */
export function sumOf(values: StrengthValues): number {
  return values.leaders + values.subLeaders + values.helpers;
}

/** Gesamtpersonen: Σ + zusätzliches Personal. */
export function totalPersonsOf(values: StrengthValues): number {
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
