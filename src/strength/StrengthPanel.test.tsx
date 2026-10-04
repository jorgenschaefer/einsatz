import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { act, screen, within } from "@/test/render";
import type { StrengthReportView } from "./StrengthPanel";
import {
  card,
  minutesAfterReport,
  openCreateField,
  openRenameField,
  report,
  setup,
} from "./StrengthPanel.fixtures";

const field = (label: string) => screen.getByRole("textbox", { name: label });

async function retype(label: string, text: string) {
  await userEvent.clear(field(label));
  await userEvent.type(field(label), text);
}

const openReport = (name: string) =>
  userEvent.click(within(card(name)).getByText(name));

async function chooseAction(row: string, action: string) {
  await userEvent.click(
    screen.getByRole("button", { name: `Aktionen für Meldung ${row}` }),
  );
  await userEvent.click(await screen.findByRole("menuitem", { name: action }));
}

const uhst3 = (...reports: StrengthReportView[]) => ({
  id: "s1",
  name: "UHSt 3",
  reports,
});

const heading = (name: string | RegExp) =>
  screen.queryByRole("heading", { name });

/** Wartet auf das Ergebnis, bis der Test `finish` aufruft. */
function pending() {
  const call = { finish: (_: ActionResult) => {} };
  const action = vi.fn(
    () =>
      new Promise<ActionResult>((resolve) => {
        call.finish = resolve;
      }),
  );
  return { action, finish: (result: ActionResult) => call.finish(result) };
}

/** Scheitert beim ersten Mal mit „Gibt es schon.“, danach gelingt es. */
const failingOnce = () =>
  vi
    .fn<(...args: string[]) => Promise<ActionResult>>()
    .mockResolvedValueOnce({ error: "Gibt es schon." })
    .mockResolvedValue({});

describe("StrengthPanel", () => {
  const sum = () => within(screen.getByRole("region", { name: "Summe" }));

  it("shows the Summe and a card for each Stelle in the given order, both as of now", () => {
    setup({
      stations: [uhst3(report()), { id: "s2", name: "Ziel", reports: [] }],
      now: minutesAfterReport(61),
    });

    expect(
      Array.from(document.querySelectorAll("[data-station]")).map(
        (el) => within(el as HTMLElement).getByRole("heading").textContent,
      ),
    ).toEqual(["UHSt 3", "Ziel"]);
    expect(sum().getByText(/^älteste Meldung/)).toHaveAttribute("data-stale");
    expect(within(card("UHSt 3")).getByText("11:01")).toHaveAttribute(
      "data-stale",
    );
  });

  it("reports the Gesamtstärke from the Summe, its error shown in the confirmation", async () => {
    const { onReportTotalStrength } = setup({
      stations: [uhst3(report())],
      onReportTotalStrength: vi.fn(async () => ({ error: "Keine Meldung." })),
    });

    await userEvent.click(
      sum().getByRole("button", { name: "Gesamtstärke melden" }),
    );
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Melden" }));

    expect(onReportTotalStrength).toHaveBeenCalledTimes(1);
    expect(dialog.getByRole("alert")).toHaveTextContent("Keine Meldung.");
  });

  it("shows no Summe without Stellen", () => {
    setup({ stations: [] });

    expect(screen.queryByRole("region", { name: "Summe" })).toBeNull();
    expect(screen.getByRole("button", { name: "+ Stelle" })).toBeVisible();
  });

  it("shows the Summenverlauf in place of the Stellen and goes back", async () => {
    setup({ stations: [uhst3(report())] });

    await userEvent.click(sum().getByRole("button", { name: "Verlauf" }));

    expect(
      screen.getByRole("table", { name: "Summenverlauf" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Summe" })).toBeNull();
    expect(document.querySelector("[data-station]")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Zurück" }));

    expect(screen.queryByRole("table")).toBeNull();
    expect(card("UHSt 3")).toBeInTheDocument();
  });

  describe("creating a Stelle", () => {
    it("creates it with the typed name, shows a returned error at the field, and closes it once saved", async () => {
      const { onCreateStation } = setup({ onCreateStation: failingOnce() });

      await userEvent.type(await openCreateField(), "UHSt 4");
      await userEvent.click(screen.getByRole("button", { name: "Anlegen" }));
      expect(field("Name der Stelle")).toHaveAccessibleDescription(
        "Gibt es schon.",
      );
      await userEvent.click(screen.getByRole("button", { name: "Anlegen" }));

      expect(onCreateStation).toHaveBeenCalledWith("UHSt 4");
      expect(
        screen.queryByRole("textbox", { name: "Name der Stelle" }),
      ).toBeNull();
    });

    it("discards the typed name on Abbrechen", async () => {
      const { onCreateStation } = setup();

      await userEvent.type(await openCreateField(), "UHSt 4");
      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

      expect(onCreateStation).not.toHaveBeenCalled();
      expect(await openCreateField()).toHaveValue("");
    });
  });

  describe("renaming a Stelle", () => {
    it("starts from the current name, shows a returned error at the field, and closes it once saved", async () => {
      const { onRenameStation } = setup({ onRenameStation: failingOnce() });

      const nameField = await openRenameField("UHSt 3");
      expect(nameField).toHaveValue("UHSt 3");
      await userEvent.type(nameField, " Nord");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
      expect(nameField).toHaveAccessibleDescription("Gibt es schon.");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      expect(onRenameStation).toHaveBeenCalledWith("s1", "UHSt 3 Nord");
      expect(screen.queryByRole("textbox", { name: "Neuer Name" })).toBeNull();
    });

    it("keeps the name on Abbrechen, the card not looking clickable meanwhile", async () => {
      const { onRenameStation } = setup();
      const item = card("UHSt 3");
      expect(item.style.cursor).toBe("pointer");

      await userEvent.type(await openRenameField("UHSt 3"), " Nord");
      expect(item.style.cursor).toBe("");
      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

      expect(onRenameStation).not.toHaveBeenCalled();
      expect(screen.queryByRole("textbox", { name: "Neuer Name" })).toBeNull();
      expect(card("UHSt 3")).toHaveTextContent("UHSt 3");
      expect(card("UHSt 3").style.cursor).toBe("pointer");
    });
  });

  describe("reporting", () => {
    it("opens the form of a Stelle in place of the Summe and the cards, goes back, and prefills afresh when opened again", async () => {
      setup({ stations: [uhst3(report())] });

      await openReport("UHSt 3");

      expect(heading("UHSt 3 · neue Meldung")).toBeInTheDocument();
      expect(document.querySelector("[data-station]")).toBeNull();
      expect(screen.queryByRole("region", { name: "Summe" })).toBeNull();
      await retype("EK", "3");

      await userEvent.click(screen.getByRole("button", { name: "Zurück" }));

      expect(card("UHSt 3")).toBeInTheDocument();
      await openReport("UHSt 3");
      expect(field("EK")).toHaveValue("6");
    });

    it("opens the form from anywhere on the card, but not from the pencil", async () => {
      setup({
        stations: [uhst3(report())],
      });

      await openRenameField("UHSt 3");
      expect(heading("UHSt 3 · neue Meldung")).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

      await userEvent.click(within(card("UHSt 3")).getByText("9 Personen"));
      expect(heading("UHSt 3 · neue Meldung")).toBeInTheDocument();
    });

    it("reports for its Stelle and returns to the Stellen", async () => {
      const { onRecordStrengthReport } = setup();
      await openReport("Ziel");

      await retype("EK", "6");
      await userEvent.click(screen.getByRole("button", { name: "Melden" }));

      expect(onRecordStrengthReport).toHaveBeenCalledWith("s2", {
        leaders: 0,
        subLeaders: 0,
        crew: 6,
        additionalPersonnel: 0,
        note: null,
      });
      expect(card("Ziel")).toBeInTheDocument();
    });

    it("shows a returned error, keeping the typed values, until Zurück", async () => {
      setup({
        onRecordStrengthReport: vi.fn(async () => ({
          error: "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.",
        })),
      });
      await openReport("UHSt 3");
      await retype("EK", "6");

      await userEvent.click(screen.getByRole("button", { name: "Melden" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.",
      );
      expect(field("EK")).toHaveValue("6");
      await userEvent.click(screen.getByRole("button", { name: "Zurück" }));
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows a failed save as an error, which its × closes", async () => {
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
      expect(heading("UHSt 3 · neue Meldung")).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole("button", { name: "Meldung schließen" }),
      );

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("keeps another Stelle's form open when an earlier report finishes saving", async () => {
      const { action, finish } = pending();
      setup({ onRecordStrengthReport: action });
      await openReport("UHSt 3");
      await userEvent.click(screen.getByRole("button", { name: "Melden" }));
      await userEvent.click(screen.getByRole("button", { name: "Zurück" }));
      await openReport("Ziel");
      await userEvent.type(field("EK"), "4");

      await act(async () => finish({}));

      expect(action).toHaveBeenCalledTimes(1);
      expect(heading("Ziel · neue Meldung")).toBeInTheDocument();
      expect(field("EK")).toHaveValue("4");
    });

    it("keeps another rename open when an earlier rename finishes saving", async () => {
      const { action, finish } = pending();
      setup({ onRenameStation: action });
      await userEvent.type(await openRenameField("Ziel"), " Nord{Enter}");
      await openRenameField("UHSt 3");

      await act(async () => finish({}));

      expect(field("Neuer Name")).toHaveValue("UHSt 3");
    });

    it("keeps a report form open when a rename finishes saving", async () => {
      const { action, finish } = pending();
      setup({ onRenameStation: action });
      await userEvent.type(await openRenameField("Ziel"), " Nord{Enter}");
      await openReport("UHSt 3");

      await act(async () => finish({}));

      expect(heading("UHSt 3 · neue Meldung")).toBeInTheDocument();
    });

    it("keeps typed values on a refresh, but prefills afresh when a new latest report arrives live", async () => {
      const ziel = (...reports: StrengthReportView[]) => ({
        id: "s2",
        name: "Ziel",
        reports,
      });
      const { rerender } = setup({ stations: [uhst3(report()), ziel()] });
      await openReport("UHSt 3");
      await retype("EK", "3");

      rerender({ stations: [uhst3(report()), ziel(report({ id: "r8" }))] });
      expect(field("EK")).toHaveValue("3");

      const latest = report({
        id: "r9",
        number: 9,
        reportedAt: "2026-09-26T09:30:00.000Z",
        crew: 8,
      });
      rerender({ stations: [uhst3(report(), latest), ziel()] });

      expect(field("EK")).toHaveValue("8");
      expect(
        screen.getByRole("table", { name: "Verlauf UHSt 3" }),
      ).toHaveTextContent("11:30");
    });
  });

  describe("correcting and annulling a report", () => {
    const stations = (state: "gueltig" | "annulliert" = "gueltig") => [
      uhst3(
        report({ id: "r1", number: 3, crew: 4, note: null }),
        report({
          id: "r2",
          number: 7,
          reportedAt: "2026-09-26T09:30:00.000Z",
          crew: 9,
          note: "Streife unterwegs",
          state,
        }),
      ),
      { id: "s2", name: "Ziel", reports: [] },
    ];

    async function openCorrection(row: string) {
      await openReport("UHSt 3");
      await chooseAction(row, "Korrigieren");
    }

    const startReport = async () => {
      await openReport("UHSt 3");
      await retype("EK", "3");
    };

    it("saves the correction of the chosen report and goes back to the new report", async () => {
      const { onCorrectStrengthReport } = setup({ stations: stations() });
      await openCorrection("11:30 (#7)");

      await retype("EK", "8");
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
      expect(heading("UHSt 3 · neue Meldung")).toBeInTheDocument();
    });

    it("goes back to the started new report on Abbrechen", async () => {
      const { onCorrectStrengthReport } = setup({ stations: stations() });
      await startReport();

      await chooseAction("11:01 (#3)", "Korrigieren");
      expect(field("EK")).toHaveValue("4");
      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

      expect(onCorrectStrengthReport).not.toHaveBeenCalled();
      expect(heading("UHSt 3 · neue Meldung")).toBeInTheDocument();
      expect(field("EK")).toHaveValue("3");
    });

    it("prefills the new report afresh after the latest report is corrected", async () => {
      const corrected = stations();
      corrected[0].reports[1] = { ...corrected[0].reports[1], crew: 8 };
      const { rerender } = setup({ stations: stations() });
      await startReport();
      await chooseAction("11:30 (#7)", "Korrigieren");
      await retype("EK", "8");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      rerender({ stations: corrected });

      expect(heading("UHSt 3 · neue Meldung")).toBeInTheDocument();
      expect(field("EK")).toHaveValue("8");
    });

    it("keeps a started new report when an older report is corrected", async () => {
      const corrected = stations();
      corrected[0].reports[0] = { ...corrected[0].reports[0], crew: 5 };
      const { rerender } = setup({ stations: stations() });
      await startReport();
      await chooseAction("11:01 (#3)", "Korrigieren");
      await retype("EK", "5");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      rerender({ stations: corrected });

      expect(field("EK")).toHaveValue("3");
    });

    it("shows a returned error, keeping the correction open, until its Abbrechen", async () => {
      setup({
        stations: stations(),
        onRecordStrengthReport: vi.fn(async () => ({ error: "Fehler" })),
        onCorrectStrengthReport: vi.fn(async () => ({
          error: "Annullierte Einträge können nicht geändert werden.",
        })),
      });
      await openReport("UHSt 3");
      await userEvent.click(screen.getByRole("button", { name: "Melden" }));

      await chooseAction("11:01 (#3)", "Korrigieren");
      expect(screen.queryByRole("alert")).toBeNull();
      await retype("EK", "8");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Annullierte Einträge können nicht geändert werden.",
      );
      expect(field("EK")).toHaveValue("8");
      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("asks for confirmation, naming the report, and annuls only once confirmed, showing its error there until it succeeds", async () => {
      const { onAnnulStrengthReport } = setup({
        stations: stations(),
        onAnnulStrengthReport: failingOnce(),
      });
      await openReport("UHSt 3");
      await chooseAction("11:30 (#7)", "Annullieren …");

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
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Gibt es schon.",
      );
      await userEvent.click(annullieren);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("prefills the new report afresh after the latest report is annulled", async () => {
      const { rerender } = setup({ stations: stations() });
      await openReport("UHSt 3");
      expect(field("EK")).toHaveValue("9");

      rerender({ stations: stations("annulliert") });

      expect(field("EK")).toHaveValue("4");
    });

    it("closes the correction of a report once it is annulled", async () => {
      const { rerender } = setup({ stations: stations() });
      await openCorrection("11:30 (#7)");

      rerender({ stations: stations("annulliert") });

      expect(heading(/korrigieren/)).toBeNull();
      expect(heading("UHSt 3 · neue Meldung")).toBeInTheDocument();
    });
  });
});
