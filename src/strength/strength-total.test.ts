import { describe, expect, it } from "vitest";
import { cyclassicsReportsByStation } from "./cyclassics.fixtures";
import { latestValidReport } from "./strength";
import {
  berlinTimeOfDay,
  formatTotalStrengthText,
  isReportStale,
  isTotalStale,
  type ReportedStrength,
  totalHistory,
  totalOf,
} from "./strength-total";

describe("totalOf", () => {
  const report = (
    counts: [number, number, number, number],
    reportedAt: string,
    over: { number?: number; state?: "gueltig" | "annulliert" } = {},
  ) => ({
    leaders: counts[0],
    subLeaders: counts[1],
    crew: counts[2],
    additionalPersonnel: counts[3],
    note: null,
    reportedAt,
    number: over.number ?? 1,
    state: over.state ?? "gueltig",
  });

  it("is 0 without Stellen, with no oldest report", () => {
    expect(totalOf([])).toEqual({
      leaders: 0,
      subLeaders: 0,
      crew: 0,
      additionalPersonnel: 0,
      stationCount: 0,
      oldestReportedAt: null,
    });
  });

  it("adds up the latest valid report of each Stelle and names the oldest of them", () => {
    const total = totalOf([
      [
        report([1, 1, 1, 1], "2026-09-26T07:00:00Z", { number: 1 }),
        report([0, 1, 6, 2], "2026-09-26T08:10:00Z", { number: 5 }),
        report([9, 9, 9, 9], "2026-09-26T08:30:00Z", {
          number: 7,
          state: "annulliert",
        }),
      ],
      [report([2, 5, 19, 4], "2026-09-26T08:20:00Z", { number: 6 })],
    ]);
    expect(total).toEqual({
      leaders: 2,
      subLeaders: 6,
      crew: 25,
      additionalPersonnel: 6,
      stationCount: 2,
      oldestReportedAt: new Date("2026-09-26T08:10:00Z"),
    });
  });

  it("leaves out a Stelle without a valid report", () => {
    const total = totalOf([
      [],
      [report([9, 9, 9, 9], "2026-09-26T06:00:00Z", { state: "annulliert" })],
      [report([0, 1, 6, 2], "2026-09-26T08:10:00Z")],
    ]);
    expect(total.stationCount).toBe(1);
    expect(total.crew).toBe(6);
    expect(total.oldestReportedAt).toEqual(new Date("2026-09-26T08:10:00Z"));
  });

  it("counts a Stelle reporting 0 Personen neither as Stelle nor for the oldest report", () => {
    const total = totalOf([
      [report([0, 0, 0, 0], "2026-09-26T06:00:00Z")],
      [report([0, 1, 6, 2], "2026-09-26T08:10:00Z")],
    ]);
    expect(total.stationCount).toBe(1);
    expect(total.oldestReportedAt).toEqual(new Date("2026-09-26T08:10:00Z"));
  });

  it("counts a Stelle with only zusätzliches Personal", () => {
    const total = totalOf([[report([0, 0, 0, 3], "2026-09-26T06:00:00Z")]]);
    expect(total.stationCount).toBe(1);
    expect(total.oldestReportedAt).toEqual(new Date("2026-09-26T06:00:00Z"));
  });

  it("is 0 without an oldest report when every Stelle reports 0", () => {
    const total = totalOf([
      [report([0, 0, 0, 0], "2026-09-26T06:00:00Z")],
      [report([0, 0, 0, 0], "2026-09-26T07:00:00Z")],
    ]);
    expect(total.stationCount).toBe(0);
    expect(total.oldestReportedAt).toBeNull();
  });

  it("counts a Stelle normally again once it reports Personen after 0", () => {
    const total = totalOf([
      [
        report([0, 0, 0, 0], "2026-09-26T06:00:00Z", { number: 1 }),
        report([0, 0, 4, 0], "2026-09-26T07:00:00Z", { number: 2 }),
      ],
    ]);
    expect(total.stationCount).toBe(1);
    expect(total.oldestReportedAt).toEqual(new Date("2026-09-26T07:00:00Z"));
  });
});

describe("totalHistory", () => {
  const report = (
    crew: number,
    reportedAt: string,
    number: number,
    state: "gueltig" | "annulliert" = "gueltig",
  ) => ({
    leaders: 0,
    subLeaders: 0,
    crew,
    additionalPersonnel: 0,
    note: null,
    reportedAt,
    number,
    state,
  });

  const rows = (reportsByStation: ReportedStrength[][]) =>
    totalHistory(reportsByStation).map((row) => ({
      number: row.number,
      reportedAt: row.reportedAt,
      crew: row.total.crew,
    }));

  it("is empty without a valid report", () => {
    expect(
      totalHistory([[], [report(4, "2026-09-26T07:00:00Z", 1, "annulliert")]]),
    ).toEqual([]);
  });

  it("has a row per valid report, newest first, with the sum of each Stelle's latest report by then", () => {
    expect(
      rows([
        [
          report(1, "2026-09-26T07:00:00Z", 1),
          report(3, "2026-09-26T09:00:00Z", 5),
        ],
        [
          report(10, "2026-09-26T08:00:00Z", 2),
          report(20, "2026-09-26T10:00:00Z", 8),
        ],
      ]),
    ).toEqual([
      { number: 8, reportedAt: "2026-09-26T10:00:00Z", crew: 23 },
      { number: 5, reportedAt: "2026-09-26T09:00:00Z", crew: 13 },
      { number: 2, reportedAt: "2026-09-26T08:00:00Z", crew: 11 },
      { number: 1, reportedAt: "2026-09-26T07:00:00Z", crew: 1 },
    ]);
  });

  it("leaves annulled reports out of the rows and out of the sums", () => {
    expect(
      rows([
        [
          report(1, "2026-09-26T07:00:00Z", 1),
          report(9, "2026-09-26T08:00:00Z", 3, "annulliert"),
        ],
        [report(10, "2026-09-26T09:00:00Z", 5)],
      ]),
    ).toEqual([
      { number: 5, reportedAt: "2026-09-26T09:00:00Z", crew: 11 },
      { number: 1, reportedAt: "2026-09-26T07:00:00Z", crew: 1 },
    ]);
  });

  it("counts a report in the same minute only from its own second on", () => {
    expect(
      rows([
        [report(1, "2026-09-26T07:00:10Z", 1)],
        [report(10, "2026-09-26T07:00:50Z", 2)],
      ]),
    ).toEqual([
      { number: 2, reportedAt: "2026-09-26T07:00:50Z", crew: 11 },
      { number: 1, reportedAt: "2026-09-26T07:00:10Z", crew: 1 },
    ]);
  });

  it("counts reports of the very same time in each other's rows", () => {
    expect(
      rows([
        [report(1, "2026-09-26T07:00:00Z", 1)],
        [report(10, "2026-09-26T07:00:00.000Z", 2)],
      ]),
    ).toEqual([
      { number: 2, reportedAt: "2026-09-26T07:00:00.000Z", crew: 11 },
      { number: 1, reportedAt: "2026-09-26T07:00:00Z", crew: 11 },
    ]);
  });

  it("carries the whole Total of the row's time", () => {
    const [row] = totalHistory([
      [
        {
          ...report(6, "2026-09-26T07:00:00Z", 1),
          leaders: 1,
          subLeaders: 2,
          additionalPersonnel: 3,
        },
      ],
      [report(4, "2026-09-26T08:00:00Z", 2)],
    ]);
    expect(row.total).toEqual({
      leaders: 1,
      subLeaders: 2,
      crew: 10,
      additionalPersonnel: 3,
      stationCount: 2,
      oldestReportedAt: new Date("2026-09-26T07:00:00Z"),
    });
  });
});

describe("isReportStale / isTotalStale", () => {
  const reportedAt = "2026-09-26T08:10:00Z";
  const at = (minutes: number) =>
    new Date(reportedAt).getTime() + minutes * 60_000;
  const report = (crew: number, additionalPersonnel = 0) => ({
    leaders: 0,
    subLeaders: 0,
    crew,
    additionalPersonnel,
    reportedAt,
  });
  const total = (oldestReportedAt: Date | null) => ({
    leaders: 0,
    subLeaders: 0,
    crew: 4,
    additionalPersonnel: 0,
    stationCount: oldestReportedAt ? 1 : 0,
    oldestReportedAt,
  });

  it("is not stale at exactly 60 minutes, but a millisecond later", () => {
    expect(isReportStale(report(4), at(60))).toBe(false);
    expect(isReportStale(report(4), at(60) + 1)).toBe(true);
    expect(isTotalStale(total(new Date(reportedAt)), at(60))).toBe(false);
    expect(isTotalStale(total(new Date(reportedAt)), at(60) + 1)).toBe(true);
  });

  it("never calls a report of 0 Personen stale", () => {
    expect(isReportStale(report(0), at(600))).toBe(false);
  });

  it("calls a report with only zusätzliches Personal stale", () => {
    expect(isReportStale(report(0, 2), at(61))).toBe(true);
  });

  it("never calls a total without an oldest report stale", () => {
    expect(isTotalStale(total(null), at(600))).toBe(false);
  });
});

describe("formatTotalStrengthText", () => {
  const total = (stationCount: number, oldestReportedAt: Date | null) => ({
    leaders: 2,
    subLeaders: 6,
    crew: 25,
    additionalPersonnel: 6,
    stationCount,
    oldestReportedAt,
  });

  it("formats the sum with the Stellen and the oldest report in Berlin time", () => {
    expect(
      formatTotalStrengthText(total(4, new Date("2026-09-26T08:10:00Z"))),
    ).toBe(
      "Gesamtstärke gemeldet: 2/6/25//33, +6 zusätzlich, 39 Personen (4 Stellen, älteste Meldung 10:10)",
    );
  });

  it("says „1 Stelle“ for exactly one", () => {
    expect(
      formatTotalStrengthText(total(1, new Date("2026-01-15T08:10:00Z"))),
    ).toBe(
      "Gesamtstärke gemeldet: 2/6/25//33, +6 zusätzlich, 39 Personen (1 Stelle, älteste Meldung 09:10)",
    );
  });

  it("leaves out the oldest report when no Stelle counts", () => {
    expect(
      formatTotalStrengthText({
        leaders: 0,
        subLeaders: 0,
        crew: 0,
        additionalPersonnel: 0,
        stationCount: 0,
        oldestReportedAt: null,
      }),
    ).toBe(
      "Gesamtstärke gemeldet: 0/0/0//0, +0 zusätzlich, 0 Personen (0 Stellen)",
    );
  });
});

describe("the Cyclassics dataset: 4 Stellen, 13 hourly reports each", () => {
  const at = (berlinTime: string) =>
    new Date(`2026-08-23T${berlinTime}+02:00`).getTime();

  it("adds up the 20:00 reports and names the oldest of them (AC-7, AC-8)", () => {
    const total = totalOf(cyclassicsReportsByStation);

    expect(formatTotalStrengthText(total)).toBe(
      "Gesamtstärke gemeldet: 4/10/60//74, +6 zusätzlich, 80 Personen (4 Stellen, älteste Meldung 20:00)",
    );
    expect(total.oldestReportedAt?.toISOString()).toBe(
      cyclassicsReportsByStation[0][12].reportedAt,
    );
  });

  it("highlights nothing at 20:30 and everything at 21:01 (AC-8)", () => {
    const total = totalOf(cyclassicsReportsByStation);
    const latest = cyclassicsReportsByStation.map(
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

  describe("the Summenverlauf (AC-10)", () => {
    const rows = totalHistory(cyclassicsReportsByStation);
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
        formatTotalStrengthText(totalOf(cyclassicsReportsByStation)),
      );
    });
  });
});
