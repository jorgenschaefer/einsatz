import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { screen, waitFor, within } from "@/test/render";
import { card, report, setup } from "./StrengthPanel.fixtures";

describe("StrengthPanel", () => {
  describe("annulling a report", () => {
    const stations = (state: "gueltig" | "annulliert" = "gueltig") => [
      {
        id: "s1",
        name: "UHSt 3",
        reports: [
          report({ id: "r1", number: 3, crew: 4 }),
          report({
            id: "r2",
            number: 7,
            reportedAt: "2026-09-26T09:30:00.000Z",
            crew: 9,
            state,
          }),
        ],
      },
    ];

    async function chooseAction(row: string, action: string) {
      await userEvent.click(
        screen.getByRole("button", { name: `Aktionen für Meldung ${row}` }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: action }),
      );
    }

    async function openAnnulment() {
      await userEvent.click(within(card("UHSt 3")).getByText("UHSt 3"));
      await chooseAction("11:30 (#7)", "Annullieren …");
    }

    it("offers it after Korrigieren in the report's menu", async () => {
      setup({ stations: stations() });
      await userEvent.click(within(card("UHSt 3")).getByText("UHSt 3"));

      await userEvent.click(
        screen.getByRole("button", { name: "Aktionen für Meldung 11:30 (#7)" }),
      );

      expect(
        (await screen.findAllByRole("menuitem")).map((i) => i.textContent),
      ).toEqual(["Korrigieren", "Annullieren …"]);
    });

    it("asks for confirmation and annuls only once confirmed", async () => {
      const { onAnnulStrengthReport } = setup({ stations: stations() });
      await openAnnulment();

      const dialog = await screen.findByRole("dialog", {
        name: "UHSt 3 · Meldung 11:30 (#7) annullieren",
      });
      expect(within(dialog).getByText(/nicht rückgängig/)).toBeInTheDocument();
      expect(onAnnulStrengthReport).not.toHaveBeenCalled();
      const annullieren = within(dialog).getByRole("button", {
        name: "Annullieren",
      });
      expect(buttonColor(annullieren)).toBe("red");
      await userEvent.click(annullieren);

      expect(onAnnulStrengthReport).toHaveBeenCalledWith("r2");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("prefills the new report afresh after an annulment", async () => {
      const { rerender } = setup({ stations: stations() });
      await openAnnulment();
      expect(screen.getByRole("textbox", { name: "EK" })).toHaveValue("9");
      await userEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Annullieren",
        }),
      );

      rerender({ stations: stations("annulliert") });

      expect(screen.getByRole("textbox", { name: "EK" })).toHaveValue("4");
    });

    it("keeps the report when the confirmation is cancelled", async () => {
      const { onAnnulStrengthReport } = setup({ stations: stations() });
      await openAnnulment();

      await userEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Abbrechen",
        }),
      );

      expect(onAnnulStrengthReport).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("annuls only once on a double click", async () => {
      const { onAnnulStrengthReport } = setup({
        stations: stations(),
        onAnnulStrengthReport: vi.fn(() => new Promise<ActionResult>(() => {})),
      });
      await openAnnulment();

      await userEvent.dblClick(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Annullieren",
        }),
      );

      expect(onAnnulStrengthReport).toHaveBeenCalledTimes(1);
    });

    it("shows a returned error in the still open confirmation", async () => {
      setup({
        stations: stations(),
        onAnnulStrengthReport: vi.fn(async () => ({
          error: "Annullierte Einträge können nicht geändert werden.",
        })),
      });
      await openAnnulment();
      const dialog = await screen.findByRole("dialog");

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Annullieren" }),
      );

      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Annullierte Einträge können nicht geändert werden.",
      );
      expect(screen.getByRole("dialog")).toBe(dialog);
    });

    it("shows a failed annulment in the still open confirmation", async () => {
      setup({
        stations: stations(),
        onAnnulStrengthReport: vi.fn(async () => {
          throw new Error("offline");
        }),
      });
      await openAnnulment();
      const dialog = await screen.findByRole("dialog");

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Annullieren" }),
      );

      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      );
    });

    it("opens the next confirmation without the previous error", async () => {
      setup({
        stations: stations(),
        onAnnulStrengthReport: vi.fn(async () => ({
          error: "Annullierte Einträge können nicht geändert werden.",
        })),
      });
      await openAnnulment();
      await userEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Annullieren",
        }),
      );
      await screen.findByText(
        "Annullierte Einträge können nicht geändert werden.",
      );
      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      await chooseAction("11:01 (#3)", "Annullieren …");

      expect(
        within(await screen.findByRole("dialog")).queryByRole("alert"),
      ).toBeNull();
    });

    it("closes the correction of a report once it is annulled", async () => {
      const { rerender } = setup({ stations: stations() });
      await userEvent.click(within(card("UHSt 3")).getByText("UHSt 3"));
      await chooseAction("11:30 (#7)", "Korrigieren");

      rerender({ stations: stations("annulliert") });

      expect(screen.queryByRole("heading", { name: /korrigieren/ })).toBeNull();
      expect(
        screen.getByRole("heading", { name: "UHSt 3 · neue Meldung" }),
      ).toBeInTheDocument();
    });
  });
});
