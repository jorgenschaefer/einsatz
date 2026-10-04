import { describe, expect, it } from "vitest";
import {
  type CyclassicsReport,
  cyclassicsReportsByStation,
} from "./cyclassics.fixtures";
import {
  berlinTimeOfDay,
  formatStrength,
  formatStrengthReportText,
  latestValidReport,
  type StrengthValues,
  stationHistory,
  sumOf,
  totalPersonsOf,
} from "./strength";

const values = (over: Partial<StrengthValues> = {}): StrengthValues => ({
  leaders: 0,
  subLeaders: 1,
  crew: 6,
  additionalPersonnel: 2,
  note: "2 einsatzbereite Streifen",
  ...over,
});

describe("sumOf / totalPersonsOf", () => {
  it("sums Führer, Unterführer and Einsatzkräfte, and adds zusätzliches Personal for the Gesamtpersonen", () => {
    expect(sumOf(values())).toBe(7);
    expect(totalPersonsOf(values())).toBe(9);
  });

  it("is 0 for an empty report", () => {
    const zero = values({
      leaders: 0,
      subLeaders: 0,
      crew: 0,
      additionalPersonnel: 0,
    });
    expect(sumOf(zero)).toBe(0);
    expect(totalPersonsOf(zero)).toBe(0);
  });
});

describe("formatStrength", () => {
  it("writes Führer/Unterführer/Einsatzkräfte//G", () => {
    expect(formatStrength(values({ leaders: 1, crew: 12 }))).toBe("1/1/12//14");
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

describe("stationHistory", () => {
  const report = (number: number, state: "gueltig" | "annulliert") => ({
    number,
    state,
  });

  it("is empty without reports", () => {
    expect(stationHistory([])).toEqual([]);
  });

  it("lists the valid reports newest first by ETB number, whatever the order", () => {
    expect(
      stationHistory([
        report(3, "gueltig"),
        report(12, "gueltig"),
        report(7, "gueltig"),
      ]),
    ).toEqual([
      report(12, "gueltig"),
      report(7, "gueltig"),
      report(3, "gueltig"),
    ]);
  });

  it("leaves out annulled reports", () => {
    expect(
      stationHistory([
        report(3, "gueltig"),
        report(7, "annulliert"),
        report(9, "gueltig"),
      ]),
    ).toEqual([report(9, "gueltig"), report(3, "gueltig")]);
  });

  it("does not reorder the reports it was given", () => {
    const reports = [report(3, "gueltig"), report(7, "gueltig")];
    stationHistory(reports);
    expect(reports).toEqual([report(3, "gueltig"), report(7, "gueltig")]);
  });
});

describe("the Cyclassics dataset: 4 Stellen, 13 hourly reports each", () => {
  const describeReport = (r: CyclassicsReport) =>
    `${berlinTimeOfDay(r.reportedAt)} ${formatStrength(r)} +${r.additionalPersonnel}` +
    ` = ${totalPersonsOf(r)} Personen${r.note ? ` – ${r.note}` : ""}`;

  it("shows the 20:00 report as each Stelle's latest (AC-6)", () => {
    expect(
      cyclassicsReportsByStation.map((reports) => {
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

  it("lists each Stelle's 13 reports newest first (AC-9)", () => {
    expect(
      cyclassicsReportsByStation.map((reports) =>
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
});
