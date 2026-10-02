import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { screen, within } from "@/test/render";
import type { StrengthReportView } from "./StrengthPanel";
import { card, report, setup, strength } from "./StrengthPanel.fixtures";

describe("StrengthPanel", () => {
  describe("the Verlauf of a Stelle", () => {
    async function openHistory(reports: StrengthReportView[]) {
      const panel = setup({
        stations: [{ id: "s1", name: "UHSt 3", reports }],
      });
      await userEvent.click(within(card("UHSt 3")).getByText("UHSt 3"));
      return panel;
    }

    const historyRows = () =>
      within(screen.getByRole("table", { name: "Verlauf UHSt 3" }))
        .getAllByRole("row")
        .map((row) =>
          Array.from(row.querySelectorAll("th, td")).map((c) => c.textContent),
        );

    it("lists every valid report newest first, with time, all values and its note below", async () => {
      await openHistory([
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

    it("leaves out annulled reports", async () => {
      await openHistory([
        report({ number: 3, crew: 4 }),
        report({ number: 7, crew: 9, state: "annulliert" }),
      ]);

      expect(historyRows()).toEqual([
        ["Zeit", "F/UF/E/G", "+", "Pers.", ""],
        ["11:01", "0/1/4/5", "2", "7", "⋯"],
        ["2 einsatzbereite Streifen"],
      ]);
    });

    it("underlines G in the head and in each row", async () => {
      await openHistory([report()]);

      const table = within(
        screen.getByRole("table", { name: "Verlauf UHSt 3" }),
      );
      expect(table.getByText(strength("F/UF/E/G"))).toBeInTheDocument();
      expect(table.getByText(strength("0/1/6/7"))).toBeInTheDocument();
    });

    it("shows a report arriving live while it is open", async () => {
      const { rerender } = await openHistory([report({ number: 3 })]);

      rerender({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [
              report({ number: 3 }),
              report({
                number: 7,
                reportedAt: "2026-09-26T09:30:00.000Z",
                crew: 9,
              }),
            ],
          },
        ],
      });

      expect(historyRows()).toEqual([
        ["Zeit", "F/UF/E/G", "+", "Pers.", ""],
        ["11:30", "0/1/9/10", "2", "12", "⋯"],
        ["2 einsatzbereite Streifen"],
        ["11:01", "0/1/6/7", "2", "9", "⋯"],
        ["2 einsatzbereite Streifen"],
      ]);
    });

    it("is not shown without a valid report", async () => {
      await openHistory([report({ state: "annulliert" })]);

      expect(screen.queryByRole("table")).toBeNull();
    });
  });
});
