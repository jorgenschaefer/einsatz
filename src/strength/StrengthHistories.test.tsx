import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@/test/render";
import { StationHistory, TotalHistory } from "./StrengthHistories";
import type { StationView, StrengthReportView } from "./StrengthPanel";
import { report, strength } from "./StrengthPanel.fixtures";

const rowsOf = (name: string) =>
  within(screen.getByRole("table", { name }))
    .getAllByRole("row")
    .map((row) =>
      Array.from(row.querySelectorAll("th, td")).map((c) => c.textContent),
    );

describe("StationHistory", () => {
  const station = (reports: StrengthReportView[]): StationView => ({
    id: "s1",
    name: "UHSt 3",
    reports,
  });

  function setup(reports: StrengthReportView[]) {
    const props = { onCorrect: vi.fn(), onAnnul: vi.fn() };
    const { rerender } = render(
      <StationHistory station={station(reports)} {...props} />,
    );
    return {
      ...props,
      rerender: (next: StrengthReportView[]) =>
        rerender(<StationHistory station={station(next)} {...props} />),
    };
  }

  const historyRows = () => rowsOf("Verlauf UHSt 3");

  it("lists every valid report newest first, with time, all values and its note below", () => {
    setup([
      report({
        number: 3,
        reportedAt: "2026-09-26T06:02:00.000Z",
        leaders: 1,
        subLeaders: 1,
        crew: 6,
        additionalPersonnel: 2,
        note: null,
      }),
      report({
        number: 17,
        reportedAt: "2026-09-26T08:10:00.000Z",
        leaders: 1,
        subLeaders: 1,
        crew: 5,
        additionalPersonnel: 3,
        note: "Streife unterwegs",
      }),
      report({
        number: 9,
        reportedAt: "2026-09-26T07:04:00.000Z",
        leaders: 1,
        subLeaders: 1,
        crew: 5,
        additionalPersonnel: 2,
        note: "Übergabe",
      }),
    ]);

    expect(historyRows()).toEqual([
      ["Zeit", "F/UF/E/G", "+", "Pers.", ""],
      ["10:10", "1/1/5/7", "3", "10", "⋯"],
      ["Streife unterwegs"],
      ["09:04", "1/1/5/7", "2", "9", "⋯"],
      ["Übergabe"],
      ["08:02", "1/1/6/8", "2", "10", "⋯"],
    ]);
  });

  it("leaves out annulled reports", () => {
    setup([
      report({ number: 3, crew: 4 }),
      report({ number: 7, crew: 9, state: "annulliert" }),
    ]);

    expect(historyRows()).toEqual([
      ["Zeit", "F/UF/E/G", "+", "Pers.", ""],
      ["11:01", "0/1/4/5", "2", "7", "⋯"],
      ["2 einsatzbereite Streifen"],
    ]);
  });

  it("underlines G in the head and in each row", () => {
    setup([report()]);

    const table = within(screen.getByRole("table", { name: "Verlauf UHSt 3" }));
    expect(table.getByText(strength("F/UF/E/G"))).toBeInTheDocument();
    expect(table.getByText(strength("0/1/6/7"))).toBeInTheDocument();
  });

  it("shows a report arriving live", () => {
    const { rerender } = setup([report({ number: 3 })]);

    rerender([
      report({ number: 3 }),
      report({ number: 7, reportedAt: "2026-09-26T09:30:00.000Z", crew: 9 }),
    ]);

    expect(historyRows()).toEqual([
      ["Zeit", "F/UF/E/G", "+", "Pers.", ""],
      ["11:30", "0/1/9/10", "2", "12", "⋯"],
      ["2 einsatzbereite Streifen"],
      ["11:01", "0/1/6/7", "2", "9", "⋯"],
      ["2 einsatzbereite Streifen"],
    ]);
  });

  it("is not shown without a valid report", () => {
    setup([report({ state: "annulliert" })]);

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("tells apart two reports of the same minute", () => {
    setup([report({ id: "r1", number: 3 }), report({ id: "r2", number: 4 })]);

    expect(
      screen.getByRole("button", { name: "Aktionen für Meldung 11:01 (#3)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Aktionen für Meldung 11:01 (#4)" }),
    ).toBeInTheDocument();
  });

  describe("the menu of a report", () => {
    const later = report({
      id: "r2",
      number: 7,
      reportedAt: "2026-09-26T09:30:00.000Z",
    });

    async function openMenu() {
      await userEvent.click(
        screen.getByRole("button", { name: "Aktionen für Meldung 11:30 (#7)" }),
      );
      return screen.findAllByRole("menuitem");
    }

    it("offers Korrigieren, then Annullieren …", async () => {
      setup([report({ id: "r1", number: 3 }), later]);

      expect((await openMenu()).map((i) => i.textContent)).toEqual([
        "Korrigieren",
        "Annullieren …",
      ]);
    });

    it("asks to correct the report of its row, not taking the focus back", async () => {
      const { onCorrect, onAnnul } = setup([report({ number: 3 }), later]);
      await openMenu();

      await userEvent.click(
        screen.getByRole("menuitem", { name: "Korrigieren" }),
      );

      expect(onCorrect).toHaveBeenCalledWith("r2");
      expect(onAnnul).not.toHaveBeenCalled();
      // Mantine gäbe den Fokus erst nach 10 ms an „⋯“ zurück.
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(
        screen.getByRole("button", { name: "Aktionen für Meldung 11:30 (#7)" }),
      ).not.toHaveFocus();
    });

    it("asks to annul the report of its row", async () => {
      const { onCorrect, onAnnul } = setup([report({ number: 3 }), later]);
      await openMenu();

      await userEvent.click(
        screen.getByRole("menuitem", { name: "Annullieren …" }),
      );

      expect(onAnnul).toHaveBeenCalledWith(later);
      expect(onCorrect).not.toHaveBeenCalled();
    });
  });
});

describe("TotalHistory", () => {
  function setup(stations: StationView[]) {
    const onBack = vi.fn();
    const { rerender } = render(
      <TotalHistory stations={stations} onBack={onBack} />,
    );
    return {
      onBack,
      rerender: (next: StationView[]) =>
        rerender(<TotalHistory stations={next} onBack={onBack} />),
    };
  }

  const totalHistoryRows = () => rowsOf("Summenverlauf");

  it("lists a row per valid report, newest first, with the sum that applied then", () => {
    setup([
      {
        id: "s1",
        name: "UHSt 3",
        reports: [
          // 08:02 in Berlin
          report({ number: 1, reportedAt: "2026-09-26T06:02:00.000Z" }),
          report({
            number: 4,
            reportedAt: "2026-09-26T08:10:00.000Z",
            crew: 3,
            state: "annulliert",
          }),
        ],
      },
      {
        id: "s2",
        name: "Ziel",
        reports: [
          report({
            number: 2,
            reportedAt: "2026-09-26T07:04:00.000Z",
            leaders: 1,
            crew: 10,
            additionalPersonnel: 0,
          }),
        ],
      },
    ]);

    expect(totalHistoryRows()).toEqual([
      ["Zeit", "F/UF/E/G", "+", "Pers."],
      ["09:04", "1/2/16/19", "2", "21"],
      ["08:02", "0/1/6/7", "2", "9"],
    ]);
    const table = within(screen.getByRole("table", { name: "Summenverlauf" }));
    expect(table.getByText(strength("F/UF/E/G"))).toBeInTheDocument();
    expect(table.getByText(strength("1/2/16/19"))).toBeInTheDocument();
  });

  it("goes back on Zurück", async () => {
    const { onBack } = setup([
      { id: "s1", name: "UHSt 3", reports: [report()] },
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Zurück" }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("shows a report arriving live", () => {
    const first = {
      id: "s1",
      name: "UHSt 3",
      reports: [report({ number: 1 })],
    };
    const { rerender } = setup([
      first,
      { id: "s2", name: "Ziel", reports: [] },
    ]);

    rerender([
      first,
      {
        id: "s2",
        name: "Ziel",
        reports: [
          report({
            number: 2,
            reportedAt: "2026-09-26T09:30:00.000Z",
            crew: 4,
            additionalPersonnel: 0,
          }),
        ],
      },
    ]);

    expect(totalHistoryRows()).toEqual([
      ["Zeit", "F/UF/E/G", "+", "Pers."],
      ["11:30", "0/2/10/12", "2", "14"],
      ["11:01", "0/1/6/7", "2", "9"],
    ]);
  });

  it("shows no table, only Zurück, without a valid report", () => {
    setup([
      {
        id: "s1",
        name: "UHSt 3",
        reports: [report({ state: "annulliert" })],
      },
    ]);

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("button", { name: "Zurück" })).toBeVisible();
  });
});
