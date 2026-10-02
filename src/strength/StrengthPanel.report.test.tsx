import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { act, screen, within } from "@/test/render";
import { card, openRenameField, report, setup } from "./StrengthPanel.fixtures";

describe("StrengthPanel", () => {
  describe("reporting", () => {
    const field = (label: string) =>
      screen.getByRole("textbox", { name: label });

    async function openReport(name: string) {
      await userEvent.click(within(card(name)).getByText(name));
    }

    it("opens the form of a Stelle from its card and goes back", async () => {
      setup();

      await openReport("UHSt 3");

      expect(
        screen.getByRole("heading", { name: "UHSt 3 · neue Meldung" }),
      ).toBeInTheDocument();
      expect(document.querySelector("[data-station]")).toBeNull();

      await userEvent.click(screen.getByRole("button", { name: "Zurück" }));

      expect(card("UHSt 3")).toBeInTheDocument();
    });

    it("opens the form from anywhere on the card, but not from the pencil", async () => {
      setup({
        stations: [{ id: "s1", name: "UHSt 3", reports: [report()] }],
      });

      await openRenameField("UHSt 3");
      expect(screen.queryByText("UHSt 3 · neue Meldung")).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

      await userEvent.click(within(card("UHSt 3")).getByText("9 Personen"));
      expect(screen.getByText("UHSt 3 · neue Meldung")).toBeInTheDocument();
    });

    it("does not look clickable while the Stelle is being renamed", async () => {
      setup();
      const item = card("UHSt 3");
      expect(item.style.cursor).toBe("pointer");

      await openRenameField("UHSt 3");

      expect(item.style.cursor).toBe("");
    });

    it("starts at zero for the first report and has no „Unverändert melden“", async () => {
      setup();

      await openReport("UHSt 3");

      for (const label of [
        "Führer",
        "Unterführer",
        "EK",
        "Zusätzliches Personal",
      ]) {
        expect(field(label)).toHaveValue("0");
        expect(field(label)).toHaveAttribute("inputmode", "numeric");
      }
      expect(field("Notiz")).toHaveValue("");
      expect(
        screen.queryByRole("button", { name: "Unverändert melden" }),
      ).toBeNull();
    });

    it("prefills the latest valid report, note included", async () => {
      setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [
              report({ crew: 4, number: 3, note: "vorher" }),
              report({ crew: 9, number: 4, state: "annulliert" }),
            ],
          },
        ],
      });

      await openReport("UHSt 3");

      expect(field("Führer")).toHaveValue("0");
      expect(field("Unterführer")).toHaveValue("1");
      expect(field("EK")).toHaveValue("4");
      expect(field("Zusätzliches Personal")).toHaveValue("2");
      expect(field("Notiz")).toHaveValue("vorher");
    });

    it("shows G and Gesamtpersonen computed as you type", async () => {
      setup({
        stations: [{ id: "s1", name: "UHSt 3", reports: [report()] }],
      });
      await openReport("UHSt 3");

      expect(screen.getByLabelText("G")).toHaveTextContent("7");
      expect(screen.getByLabelText("Personen")).toHaveTextContent("9");

      await userEvent.clear(field("EK"));
      await userEvent.type(field("EK"), "12");

      expect(screen.getByLabelText("G")).toHaveTextContent("13");
      expect(screen.getByLabelText("Personen")).toHaveTextContent("15");
    });

    it("replaces a prefilled number when typing into it", async () => {
      setup({
        stations: [{ id: "s1", name: "UHSt 3", reports: [report()] }],
      });
      await openReport("UHSt 3");

      await userEvent.type(field("EK"), "5");

      expect(field("EK")).toHaveValue("5");
    });

    it("takes at most four digits", async () => {
      setup();
      await openReport("UHSt 3");

      await userEvent.type(field("EK"), "123456");

      expect(field("EK")).toHaveValue("1234");
    });

    it("accepts neither negatives nor decimals", async () => {
      setup();
      await openReport("UHSt 3");

      await userEvent.clear(field("EK"));
      await userEvent.type(field("EK"), "-3.5");

      expect(field("EK")).toHaveValue("35");
    });

    it("reports the typed values and returns to the Stellen", async () => {
      const { onRecordStrengthReport } = setup();
      await openReport("UHSt 3");

      await userEvent.clear(field("Unterführer"));
      await userEvent.type(field("Unterführer"), "1");
      await userEvent.clear(field("EK"));
      await userEvent.type(field("EK"), "6");
      await userEvent.clear(field("Zusätzliches Personal"));
      await userEvent.type(field("Zusätzliches Personal"), "2");
      await userEvent.type(field("Notiz"), "2 einsatzbereite Streifen");
      await userEvent.click(screen.getByRole("button", { name: "Melden" }));

      expect(onRecordStrengthReport).toHaveBeenCalledWith("s1", {
        leaders: 0,
        subLeaders: 1,
        crew: 6,
        additionalPersonnel: 2,
        note: "2 einsatzbereite Streifen",
      });
      expect(card("UHSt 3")).toBeInTheDocument();
    });

    it("reports an emptied number as 0 and an empty note as none", async () => {
      const { onRecordStrengthReport } = setup({
        stations: [
          { id: "s1", name: "UHSt 3", reports: [report({ note: "alt" })] },
        ],
      });
      await openReport("UHSt 3");

      await userEvent.clear(field("EK"));
      await userEvent.clear(field("Notiz"));
      await userEvent.click(screen.getByRole("button", { name: "Melden" }));

      expect(onRecordStrengthReport).toHaveBeenCalledWith("s1", {
        leaders: 0,
        subLeaders: 1,
        crew: 0,
        additionalPersonnel: 2,
        note: null,
      });
    });

    it("„Unverändert melden“ reports the latest valid report in one tap, whatever was typed", async () => {
      const { onRecordStrengthReport } = setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [
              report({ number: 3 }),
              report({ crew: 9, number: 4, state: "annulliert" }),
            ],
          },
        ],
      });
      await openReport("UHSt 3");
      await userEvent.type(field("EK"), "5");

      await userEvent.click(
        screen.getByRole("button", { name: "Unverändert melden" }),
      );

      expect(onRecordStrengthReport).toHaveBeenCalledTimes(1);
      expect(onRecordStrengthReport).toHaveBeenCalledWith("s1", {
        leaders: 0,
        subLeaders: 1,
        crew: 6,
        additionalPersonnel: 2,
        note: "2 einsatzbereite Streifen",
      });
      expect(card("UHSt 3")).toBeInTheDocument();
    });

    it("shows a returned error and keeps the typed values", async () => {
      setup({
        onRecordStrengthReport: vi.fn(async () => ({
          error: "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.",
        })),
      });
      await openReport("UHSt 3");
      await userEvent.clear(field("EK"));
      await userEvent.type(field("EK"), "6");

      await userEvent.click(screen.getByRole("button", { name: "Melden" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.",
      );
      expect(field("EK")).toHaveValue("6");
    });

    it("shows a failed save as an error", async () => {
      setup({
        onRecordStrengthReport: vi.fn(async () => {
          throw new Error("offline");
        }),
      });
      await openReport("UHSt 3");

      await userEvent.click(screen.getByRole("button", { name: "Melden" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Speichern fehlgeschlagen. Bitte erneut versuchen.",
      );
      expect(
        screen.getByRole("heading", { name: "UHSt 3 · neue Meldung" }),
      ).toBeInTheDocument();
    });

    it("closes the error with its ×", async () => {
      setup({
        onRecordStrengthReport: vi.fn(async () => {
          throw new Error("offline");
        }),
      });
      await openReport("UHSt 3");
      await userEvent.click(screen.getByRole("button", { name: "Melden" }));

      await userEvent.click(
        screen.getByRole("button", { name: "Meldung schließen" }),
      );

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("keeps another Stelle's form open when an earlier report finishes saving", async () => {
      let finish = (_: ActionResult) => {};
      const { onRecordStrengthReport } = setup({
        onRecordStrengthReport: vi.fn(
          () =>
            new Promise<ActionResult>((resolve) => {
              finish = resolve;
            }),
        ),
      });
      await openReport("UHSt 3");
      await userEvent.click(screen.getByRole("button", { name: "Melden" }));
      await userEvent.click(screen.getByRole("button", { name: "Zurück" }));
      await openReport("Ziel");
      await userEvent.type(field("EK"), "4");

      await act(async () => finish({}));

      expect(onRecordStrengthReport).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Ziel · neue Meldung")).toBeInTheDocument();
      expect(field("EK")).toHaveValue("4");
    });

    it("keeps a report form open when a rename finishes saving", async () => {
      let finish = (_: ActionResult) => {};
      setup({
        onRenameStation: vi.fn(
          () =>
            new Promise<ActionResult>((resolve) => {
              finish = resolve;
            }),
        ),
      });
      await userEvent.type(await openRenameField("Ziel"), " Nord{Enter}");
      await openReport("UHSt 3");

      await act(async () => finish({}));

      expect(screen.getByText("UHSt 3 · neue Meldung")).toBeInTheDocument();
    });

    it("prefills afresh when a new report arrives live", async () => {
      const { rerender } = setup({
        stations: [{ id: "s1", name: "UHSt 3", reports: [report()] }],
      });
      await openReport("UHSt 3");
      await userEvent.clear(field("EK"));
      await userEvent.type(field("EK"), "3");

      rerender({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [
              report(),
              report({
                id: "r9",
                number: 9,
                reportedAt: "2026-09-26T09:30:00.000Z",
                crew: 8,
              }),
            ],
          },
        ],
      });

      expect(field("EK")).toHaveValue("8");
    });

    it("keeps typed values when the data refreshes without a new latest report", async () => {
      const { rerender } = setup({
        stations: [
          { id: "s1", name: "UHSt 3", reports: [report()] },
          { id: "s2", name: "Ziel", reports: [] },
        ],
      });
      await openReport("UHSt 3");
      await userEvent.clear(field("EK"));
      await userEvent.type(field("EK"), "3");

      rerender({
        stations: [
          { id: "s1", name: "UHSt 3", reports: [report()] },
          {
            id: "s2",
            name: "Ziel",
            reports: [report({ id: "r9", number: 9, crew: 8 })],
          },
        ],
      });

      expect(field("EK")).toHaveValue("3");
    });

    it("prefills afresh when the form is opened again", async () => {
      setup({
        stations: [{ id: "s1", name: "UHSt 3", reports: [report()] }],
      });
      await openReport("UHSt 3");
      await userEvent.clear(field("EK"));
      await userEvent.type(field("EK"), "3");
      await userEvent.click(screen.getByRole("button", { name: "Zurück" }));

      await openReport("UHSt 3");

      expect(field("EK")).toHaveValue("6");
    });
  });
});
