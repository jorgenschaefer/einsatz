import { describe, expect, it } from "vitest";
import {
  formatStrengthReportText,
  latestValidReport,
  type StrengthValues,
  sumOf,
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
