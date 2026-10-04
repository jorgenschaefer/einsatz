import type { ReportedStrength } from "./total";

// Cyclassics: 4 Stellen report once an hour from 08:00 to 20:00 (CEST), one
// after the other within the same minute. The first Stelle never adds a note.
const HOURS = 13;
const STATIONS = 4;
const FIRST_HOUR = 8;
// ETB entries 1–5 are „Einsatz eröffnet" and the four „Stelle angelegt".
const FIRST_REPORT_NUMBER = 6;

export type CyclassicsReport = ReportedStrength & { note: string | null };

export const cyclassicsReportsByStation: CyclassicsReport[][] = Array.from(
  { length: STATIONS },
  (_, station) =>
    Array.from({ length: HOURS }, (_, hour) => report(station, hour)),
);

function report(station: number, hour: number): CyclassicsReport {
  return {
    leaders: 1,
    subLeaders: station + 1,
    crew: hour + 2 * station,
    additionalPersonnel: station,
    note: station === 0 ? null : `Runde ${hour + 1}`,
    reportedAt: new Date(
      `2026-08-23T${String(FIRST_HOUR + hour).padStart(2, "0")}:00:${String(15 * station).padStart(2, "0")}+02:00`,
    ).toISOString(),
    number: FIRST_REPORT_NUMBER + hour * STATIONS + station,
    state: "gueltig",
  };
}
