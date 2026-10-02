import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@/test/render";
import { card, report, setup } from "./StrengthPanel.fixtures";

describe("StrengthPanel", () => {
  describe("correcting a report", () => {
    const field = (label: string) =>
      screen.getByRole("textbox", { name: label });

    const stations = () => [
      {
        id: "s1",
        name: "UHSt 3",
        reports: [
          report({ id: "r1", number: 3, crew: 4, note: null }),
          report({
            id: "r2",
            number: 7,
            reportedAt: "2026-09-26T09:30:00.000Z",
            crew: 9,
            note: "Streife unterwegs",
          }),
        ],
      },
      { id: "s2", name: "Ziel", reports: [] },
    ];

    async function openCorrection(row: string) {
      await userEvent.click(within(card("UHSt 3")).getByText("UHSt 3"));
      await userEvent.click(
        screen.getByRole("button", { name: `Aktionen für Meldung ${row}` }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Korrigieren" }),
      );
    }

    it("moves the focus to the correction, which may start above the tapped row", async () => {
      setup({ stations: stations() });

      await openCorrection("11:01 (#3)");

      expect(screen.getByRole("combobox", { name: "Stelle" })).toHaveFocus();
    });

    it("prefills the chosen report and its Stelle", async () => {
      setup({ stations: stations() });

      await openCorrection("11:01 (#3)");

      expect(
        screen.getByRole("heading", {
          name: "UHSt 3 · Meldung 11:01 korrigieren",
        }),
      ).toBeInTheDocument();
      expect(field("EK")).toHaveValue("4");
      expect(field("Zusätzliches Personal")).toHaveValue("2");
      expect(field("Notiz")).toHaveValue("");
      expect(screen.getByRole("combobox", { name: "Stelle" })).toHaveValue(
        "s1",
      );
    });

    it("saves the corrected values and Stelle and goes back to the new report", async () => {
      const { onCorrectStrengthReport } = setup({ stations: stations() });
      await openCorrection("11:30 (#7)");

      await userEvent.clear(field("EK"));
      await userEvent.type(field("EK"), "8");
      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Stelle" }),
        "Ziel",
      );
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      expect(onCorrectStrengthReport).toHaveBeenCalledWith("r2", "s2", {
        leaders: 0,
        subLeaders: 1,
        crew: 8,
        additionalPersonnel: 2,
        note: "Streife unterwegs",
      });
      expect(
        screen.getByRole("heading", { name: "UHSt 3 · neue Meldung" }),
      ).toBeInTheDocument();
    });

    it("cancels without saving", async () => {
      const { onCorrectStrengthReport } = setup({ stations: stations() });
      await openCorrection("11:01 (#3)");

      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

      expect(onCorrectStrengthReport).not.toHaveBeenCalled();
      expect(
        screen.getByRole("heading", { name: "UHSt 3 · neue Meldung" }),
      ).toBeInTheDocument();
    });

    it("keeps a started new report while correcting", async () => {
      setup({ stations: stations() });
      await userEvent.click(within(card("UHSt 3")).getByText("UHSt 3"));
      await userEvent.clear(field("EK"));
      await userEvent.type(field("EK"), "3");

      await userEvent.click(
        screen.getByRole("button", { name: "Aktionen für Meldung 11:01 (#3)" }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Korrigieren" }),
      );
      expect(field("EK")).toHaveValue("4");
      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

      expect(field("EK")).toHaveValue("3");
    });

    it("prefills the new report afresh after a correction", async () => {
      const corrected = stations();
      corrected[0].reports[1] = { ...corrected[0].reports[1], crew: 8 };
      const { rerender } = setup({ stations: stations() });
      await openCorrection("11:30 (#7)");
      await userEvent.clear(field("EK"));
      await userEvent.type(field("EK"), "8");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      rerender({ stations: corrected });

      expect(
        screen.getByRole("heading", { name: "UHSt 3 · neue Meldung" }),
      ).toBeInTheDocument();
      expect(field("EK")).toHaveValue("8");
    });

    it("keeps a started new report when an older report is corrected", async () => {
      const corrected = stations();
      corrected[0].reports[0] = { ...corrected[0].reports[0], crew: 5 };
      const { rerender } = setup({ stations: stations() });
      await userEvent.click(within(card("UHSt 3")).getByText("UHSt 3"));
      await userEvent.clear(field("EK"));
      await userEvent.type(field("EK"), "3");
      await userEvent.click(
        screen.getByRole("button", { name: "Aktionen für Meldung 11:01 (#3)" }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Korrigieren" }),
      );
      await userEvent.clear(field("EK"));
      await userEvent.type(field("EK"), "5");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      rerender({ stations: corrected });

      expect(field("EK")).toHaveValue("3");
    });

    it("tells apart two reports of the same minute", async () => {
      setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [
              report({ id: "r1", number: 3 }),
              report({ id: "r2", number: 4 }),
            ],
          },
        ],
      });
      await userEvent.click(within(card("UHSt 3")).getByText("UHSt 3"));

      expect(
        screen.getByRole("button", { name: "Aktionen für Meldung 11:01 (#3)" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Aktionen für Meldung 11:01 (#4)" }),
      ).toBeInTheDocument();
    });

    it("shows a returned error and keeps the correction open", async () => {
      setup({
        stations: stations(),
        onCorrectStrengthReport: vi.fn(async () => ({
          error: "Annullierte Einträge können nicht geändert werden.",
        })),
      });
      await openCorrection("11:01 (#3)");
      await userEvent.clear(field("EK"));
      await userEvent.type(field("EK"), "8");

      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Annullierte Einträge können nicht geändert werden.",
      );
      expect(field("EK")).toHaveValue("8");
    });
  });
});
