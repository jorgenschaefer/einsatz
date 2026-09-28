import { describe, expect, it } from "vitest";
import {
  formatStrengthReportText,
  formatTotalStrengthText,
  isReportStale,
  isTotalStale,
  latestValidReport,
  type StrengthValues,
  sumOf,
  totalOf,
  totalPersonsOf,
} from "./strength";

const values = (over: Partial<StrengthValues> = {}): StrengthValues => ({
  leaders: 0,
  subLeaders: 1,
  helpers: 6,
  additionalPersonnel: 2,
  note: "2 einsatzbereite Streifen",
  ...over,
});

describe("sumOf / totalPersonsOf", () => {
  it("sums Führer, Unterführer and Helfer, and adds zusätzliches Personal for the Gesamtpersonen", () => {
    expect(sumOf(values())).toBe(7);
    expect(totalPersonsOf(values())).toBe(9);
  });

  it("is 0 for an empty report", () => {
    const zero = values({
      leaders: 0,
      subLeaders: 0,
      helpers: 0,
      additionalPersonnel: 0,
    });
    expect(sumOf(zero)).toBe(0);
    expect(totalPersonsOf(zero)).toBe(0);
  });
});

describe("formatStrengthReportText", () => {
  it("formats the report with its note", () => {
    expect(formatStrengthReportText("UHSt 3", values())).toBe(
      "Stärkemeldung UHSt 3: 0/1/6//7, +2 zusätzlich, 9 Personen – 2 einsatzbereite Streifen",
    );
  });

  it.each([null, "", "  \n "])("leaves out „ – …“ for the note %j", (note) => {
    expect(formatStrengthReportText("UHSt 3", values({ note }))).toBe(
      "Stärkemeldung UHSt 3: 0/1/6//7, +2 zusätzlich, 9 Personen",
    );
  });

  it("trims the note", () => {
    expect(
      formatStrengthReportText("UHSt 3", values({ note: "  Streife 2 \n" })),
    ).toBe(
      "Stärkemeldung UHSt 3: 0/1/6//7, +2 zusätzlich, 9 Personen – Streife 2",
    );
  });
});

describe("latestValidReport", () => {
  const report = (number: number, state: "gueltig" | "annulliert") => ({
    number,
    state,
  });

  it("is undefined without reports", () => {
    expect(latestValidReport([])).toBeUndefined();
  });

  it("is the valid report with the highest ETB number, whatever the order", () => {
    const latest = report(12, "gueltig");
    expect(
      latestValidReport([report(3, "gueltig"), latest, report(7, "gueltig")]),
    ).toBe(latest);
  });

  it("skips annulled reports", () => {
    const previous = report(3, "gueltig");
    expect(latestValidReport([previous, report(7, "annulliert")])).toBe(
      previous,
    );
  });

  it("is undefined when every report is annulled", () => {
    expect(latestValidReport([report(3, "annulliert")])).toBeUndefined();
  });
});

describe("totalOf", () => {
  const report = (
    counts: [number, number, number, number],
    reportedAt: string,
    over: { number?: number; state?: "gueltig" | "annulliert" } = {},
  ) => ({
    leaders: counts[0],
    subLeaders: counts[1],
    helpers: counts[2],
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
      helpers: 0,
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
      helpers: 25,
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
    expect(total.helpers).toBe(6);
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

describe("isReportStale / isTotalStale", () => {
  const reportedAt = "2026-09-26T08:10:00Z";
  const at = (minutes: number) =>
    new Date(reportedAt).getTime() + minutes * 60_000;
  const report = (helpers: number, additionalPersonnel = 0) => ({
    leaders: 0,
    subLeaders: 0,
    helpers,
    additionalPersonnel,
    reportedAt,
  });
  const total = (oldestReportedAt: Date | null) => ({
    leaders: 0,
    subLeaders: 0,
    helpers: 4,
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
    helpers: 25,
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
        helpers: 0,
        additionalPersonnel: 0,
        stationCount: 0,
        oldestReportedAt: null,
      }),
    ).toBe(
      "Gesamtstärke gemeldet: 0/0/0//0, +0 zusätzlich, 0 Personen (0 Stellen)",
    );
  });
});
