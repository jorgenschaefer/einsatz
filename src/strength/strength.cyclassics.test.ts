import { describe, expect, it } from "vitest";
import {
  berlinTimeOfDay,
  formatStrength,
  formatTotalStrengthText,
  isReportStale,
  isTotalStale,
  latestValidReport,
  type ReportedStrength,
  stationHistory,
  totalHistory,
  totalOf,
  totalPersonsOf,
} from "./strength";

// Cyclassics: 4 Stellen report once an hour from 08:00 to 20:00 (CEST), one
// after the other within the same minute. The first Stelle never adds a note.
const HOURS = 13;
const STATIONS = 4;
const FIRST_HOUR = 8;
// ETB entries 1–5 are „Einsatz eröffnet" and the four „Stelle angelegt".
const FIRST_REPORT_NUMBER = 6;

type CyclassicsReport = ReportedStrength & { note: string | null };

const report = (station: number, hour: number): CyclassicsReport => ({
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
});

const reportsByStation: CyclassicsReport[][] = Array.from(
  { length: STATIONS },
  (_, station) =>
    Array.from({ length: HOURS }, (_, hour) => report(station, hour)),
);

const at = (berlinTime: string) =>
  new Date(`2026-08-23T${berlinTime}+02:00`).getTime();

const describeReport = (r: CyclassicsReport) =>
  `${berlinTimeOfDay(r.reportedAt)} ${formatStrength(r)} +${r.additionalPersonnel}` +
  ` = ${totalPersonsOf(r)} Personen${r.note ? ` – ${r.note}` : ""}`;

describe("the Cyclassics dataset: 4 Stellen, 13 hourly reports each", () => {
  it("shows the 20:00 report as each Stelle's latest (AC-6)", () => {
    expect(
      reportsByStation.map((reports) => {
        const latest = latestValidReport(reports);
        return latest && describeReport(latest);
      }),
    ).toEqual([
      "20:00 1/1/12//14 +0 = 14 Personen",
      "20:00 1/2/14//17 +1 = 18 Personen – Runde 13",
      "20:00 1/3/16//20 +2 = 22 Personen – Runde 13",
      "20:00 1/4/18//23 +3 = 26 Personen – Runde 13",
    ]);
  });

  it("adds up the 20:00 reports and names the oldest of them (AC-7, AC-8)", () => {
    const total = totalOf(reportsByStation);

    expect(formatTotalStrengthText(total)).toBe(
      "Gesamtstärke gemeldet: 4/10/60//74, +6 zusätzlich, 80 Personen (4 Stellen, älteste Meldung 20:00)",
    );
    expect(total.oldestReportedAt?.toISOString()).toBe(
      reportsByStation[0][12].reportedAt,
    );
  });

  it("highlights nothing at 20:30 and everything at 21:01 (AC-8)", () => {
    const total = totalOf(reportsByStation);
    const latest = reportsByStation.map(
      (reports) => latestValidReport(reports) as ReportedStrength,
    );

    expect(isTotalStale(total, at("20:30"))).toBe(false);
    expect(latest.map((r) => isReportStale(r, at("20:30")))).toEqual([
      false,
      false,
      false,
      false,
    ]);

    expect(isTotalStale(total, at("21:01"))).toBe(true);
    expect(latest.map((r) => isReportStale(r, at("21:01")))).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it("lists each Stelle's 13 reports newest first (AC-9)", () => {
    expect(
      reportsByStation.map((reports) =>
        stationHistory(reports).map(describeReport),
      ),
    ).toEqual([
      [
        "20:00 1/1/12//14 +0 = 14 Personen",
        "19:00 1/1/11//13 +0 = 13 Personen",
        "18:00 1/1/10//12 +0 = 12 Personen",
        "17:00 1/1/9//11 +0 = 11 Personen",
        "16:00 1/1/8//10 +0 = 10 Personen",
        "15:00 1/1/7//9 +0 = 9 Personen",
        "14:00 1/1/6//8 +0 = 8 Personen",
        "13:00 1/1/5//7 +0 = 7 Personen",
        "12:00 1/1/4//6 +0 = 6 Personen",
        "11:00 1/1/3//5 +0 = 5 Personen",
        "10:00 1/1/2//4 +0 = 4 Personen",
        "09:00 1/1/1//3 +0 = 3 Personen",
        "08:00 1/1/0//2 +0 = 2 Personen",
      ],
      [
        "20:00 1/2/14//17 +1 = 18 Personen – Runde 13",
        "19:00 1/2/13//16 +1 = 17 Personen – Runde 12",
        "18:00 1/2/12//15 +1 = 16 Personen – Runde 11",
        "17:00 1/2/11//14 +1 = 15 Personen – Runde 10",
        "16:00 1/2/10//13 +1 = 14 Personen – Runde 9",
        "15:00 1/2/9//12 +1 = 13 Personen – Runde 8",
        "14:00 1/2/8//11 +1 = 12 Personen – Runde 7",
        "13:00 1/2/7//10 +1 = 11 Personen – Runde 6",
        "12:00 1/2/6//9 +1 = 10 Personen – Runde 5",
        "11:00 1/2/5//8 +1 = 9 Personen – Runde 4",
        "10:00 1/2/4//7 +1 = 8 Personen – Runde 3",
        "09:00 1/2/3//6 +1 = 7 Personen – Runde 2",
        "08:00 1/2/2//5 +1 = 6 Personen – Runde 1",
      ],
      [
        "20:00 1/3/16//20 +2 = 22 Personen – Runde 13",
        "19:00 1/3/15//19 +2 = 21 Personen – Runde 12",
        "18:00 1/3/14//18 +2 = 20 Personen – Runde 11",
        "17:00 1/3/13//17 +2 = 19 Personen – Runde 10",
        "16:00 1/3/12//16 +2 = 18 Personen – Runde 9",
        "15:00 1/3/11//15 +2 = 17 Personen – Runde 8",
        "14:00 1/3/10//14 +2 = 16 Personen – Runde 7",
        "13:00 1/3/9//13 +2 = 15 Personen – Runde 6",
        "12:00 1/3/8//12 +2 = 14 Personen – Runde 5",
        "11:00 1/3/7//11 +2 = 13 Personen – Runde 4",
        "10:00 1/3/6//10 +2 = 12 Personen – Runde 3",
        "09:00 1/3/5//9 +2 = 11 Personen – Runde 2",
        "08:00 1/3/4//8 +2 = 10 Personen – Runde 1",
      ],
      [
        "20:00 1/4/18//23 +3 = 26 Personen – Runde 13",
        "19:00 1/4/17//22 +3 = 25 Personen – Runde 12",
        "18:00 1/4/16//21 +3 = 24 Personen – Runde 11",
        "17:00 1/4/15//20 +3 = 23 Personen – Runde 10",
        "16:00 1/4/14//19 +3 = 22 Personen – Runde 9",
        "15:00 1/4/13//18 +3 = 21 Personen – Runde 8",
        "14:00 1/4/12//17 +3 = 20 Personen – Runde 7",
        "13:00 1/4/11//16 +3 = 19 Personen – Runde 6",
        "12:00 1/4/10//15 +3 = 18 Personen – Runde 5",
        "11:00 1/4/9//14 +3 = 17 Personen – Runde 4",
        "10:00 1/4/8//13 +3 = 16 Personen – Runde 3",
        "09:00 1/4/7//12 +3 = 15 Personen – Runde 2",
        "08:00 1/4/6//11 +3 = 14 Personen – Runde 1",
      ],
    ]);
  });

  describe("the Summenverlauf (AC-10)", () => {
    const rows = totalHistory(reportsByStation);
    const rowOf = (number: number) => rows.find((row) => row.number === number);
    const describeRow = (number: number) => {
      const row = rowOf(number);
      return row && formatTotalStrengthText(row.total);
    };

    it("has a row for each of the 52 reports, newest first", () => {
      expect(rows.map((row) => row.number)).toEqual(
        Array.from({ length: 52 }, (_, i) => 57 - i),
      );
      const hoursNewestFirst = [
        "20",
        "19",
        "18",
        "17",
        "16",
        "15",
        "14",
        "13",
        "12",
        "11",
        "10",
        "09",
        "08",
      ];
      expect(rows.map((row) => row.reportedAt)).toEqual(
        hoursNewestFirst.flatMap((hour) =>
          ["45", "30", "15", "00"].map((second) =>
            new Date(`2026-08-23T${hour}:00:${second}+02:00`).toISOString(),
          ),
        ),
      );
    });

    it("sums only the first Stelle at the first report", () => {
      expect(describeRow(6)).toBe(
        "Gesamtstärke gemeldet: 1/1/0//2, +0 zusätzlich, 2 Personen (1 Stelle, älteste Meldung 08:00)",
      );
    });

    it("adds each Stelle as its first report comes in", () => {
      expect(describeRow(7)).toBe(
        "Gesamtstärke gemeldet: 2/3/2//7, +1 zusätzlich, 8 Personen (2 Stellen, älteste Meldung 08:00)",
      );
      expect(describeRow(9)).toBe(
        "Gesamtstärke gemeldet: 4/10/12//26, +6 zusätzlich, 32 Personen (4 Stellen, älteste Meldung 08:00)",
      );
    });

    it("mixes this hour's reports with last hour's while the round is under way", () => {
      const row = rowOf(32);
      expect(row && berlinTimeOfDay(row.reportedAt)).toBe("14:00");
      expect(describeRow(32)).toBe(
        "Gesamtstärke gemeldet: 4/10/35//49, +6 zusätzlich, 55 Personen (4 Stellen, älteste Meldung 13:00)",
      );
    });

    it("ends with the current sum at the last report", () => {
      expect(describeRow(57)).toBe(
        formatTotalStrengthText(totalOf(reportsByStation)),
      );
    });
  });
});
