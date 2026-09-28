import { MantineProvider } from "@mantine/core";
import { render as rtlRender } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/operations/[id]/action-result";
import { act, render, screen, waitFor, within } from "@/test/render";
import {
  StrengthPanel,
  type StrengthPanelProps,
  type StrengthReportView,
} from "./StrengthPanel";

function setup(over: Partial<StrengthPanelProps> = {}) {
  const props = setupProps(over);
  const { rerender } = render(<StrengthPanel {...props} />);
  return {
    ...props,
    rerender: (next: Partial<StrengthPanelProps>) =>
      rerender(<StrengthPanel {...props} {...next} />),
  };
}

function setupProps(over: Partial<StrengthPanelProps>): StrengthPanelProps {
  return {
    stations: [
      { id: "s1", name: "UHSt 3", reports: [] },
      { id: "s2", name: "Ziel", reports: [] },
    ],
    onCreateStation: vi.fn(async () => ({})),
    onRenameStation: vi.fn(async () => ({})),
    onRecordStrengthReport: vi.fn(async () => ({})),
    onReportTotalStrength: vi.fn(async () => ({})),
    onCorrectStrengthReport: vi.fn(async () => ({})),
    onAnnulStrengthReport: vi.fn(async () => ({})),
    now: minutesAfterReport(5),
    ...over,
  };
}

const report = (
  over: Partial<StrengthReportView> = {},
): StrengthReportView => ({
  id: "r1",
  leaders: 0,
  subLeaders: 1,
  helpers: 6,
  additionalPersonnel: 2,
  note: "2 einsatzbereite Streifen",
  // 11:01 in Berlin (Sommerzeit)
  reportedAt: "2026-09-26T09:01:00.000Z",
  state: "gueltig",
  number: 5,
  ...over,
});

/** Zeitpunkt `minutes` Minuten nach dem Standard-Meldezeitpunkt von {@link report}. */
function minutesAfterReport(minutes: number) {
  return new Date("2026-09-26T09:01:00.000Z").getTime() + minutes * 60_000;
}

const card = (name: string) =>
  screen.getByText(name).closest("[data-station]") as HTMLElement;

async function openCreateField() {
  await userEvent.click(screen.getByRole("button", { name: "+ Stelle" }));
  return screen.getByRole("textbox", { name: "Name der Stelle" });
}

async function openRenameField(name: string) {
  await userEvent.click(
    within(card(name)).getByRole("button", { name: `${name} umbenennen` }),
  );
  return screen.getByRole("textbox", { name: "Neuer Name" });
}

describe("StrengthPanel", () => {
  it("shows a card for each Stelle, in the given order", () => {
    setup();

    expect(
      Array.from(document.querySelectorAll("[data-station]")).map(
        (el) => within(el as HTMLElement).getByRole("heading").textContent,
      ),
    ).toEqual(["UHSt 3", "Ziel"]);
  });

  describe("creating a Stelle", () => {
    it("creates it with the typed name and closes the field", async () => {
      const { onCreateStation } = setup();

      await userEvent.type(await openCreateField(), "UHSt 4");
      await userEvent.click(screen.getByRole("button", { name: "Anlegen" }));

      expect(onCreateStation).toHaveBeenCalledWith("UHSt 4");
      expect(
        screen.queryByRole("textbox", { name: "Name der Stelle" }),
      ).toBeNull();
    });

    it("creates it on Enter", async () => {
      const { onCreateStation } = setup();

      await userEvent.type(await openCreateField(), "UHSt 4{Enter}");

      expect(onCreateStation).toHaveBeenCalledWith("UHSt 4");
    });

    it("shows a returned error at the field and keeps the typed name", async () => {
      setup({
        onCreateStation: vi.fn(async () => ({
          error: "Eine Stelle mit diesem Namen gibt es schon.",
        })),
      });

      await userEvent.type(await openCreateField(), "uhst 3");
      await userEvent.click(screen.getByRole("button", { name: "Anlegen" }));

      const field = screen.getByRole("textbox", { name: "Name der Stelle" });
      expect(field).toHaveAccessibleDescription(
        "Eine Stelle mit diesem Namen gibt es schon.",
      );
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Eine Stelle mit diesem Namen gibt es schon.",
      );
      expect(field).toHaveValue("uhst 3");
    });

    it("shows a failed save as an error at the field", async () => {
      setup({
        onCreateStation: vi.fn(async () => {
          throw new Error("offline");
        }),
      });

      await userEvent.type(await openCreateField(), "UHSt 4");
      await userEvent.click(screen.getByRole("button", { name: "Anlegen" }));

      expect(
        screen.getByRole("textbox", { name: "Name der Stelle" }),
      ).toHaveAccessibleDescription(
        "Speichern fehlgeschlagen. Bitte erneut versuchen.",
      );
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
    it("starts from the current name and saves the new one", async () => {
      const { onRenameStation } = setup();

      const field = await openRenameField("UHSt 3");
      expect(field).toHaveValue("UHSt 3");
      await userEvent.type(field, " Nord");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      expect(onRenameStation).toHaveBeenCalledWith("s1", "UHSt 3 Nord");
      expect(screen.queryByRole("textbox", { name: "Neuer Name" })).toBeNull();
    });

    it("shows a returned error at the field and keeps it open", async () => {
      setup({
        onRenameStation: vi.fn(async () => ({
          error: "Eine Stelle mit diesem Namen gibt es schon.",
        })),
      });

      const field = await openRenameField("UHSt 3");
      await userEvent.clear(field);
      await userEvent.type(field, "Ziel");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      expect(field).toHaveAccessibleDescription(
        "Eine Stelle mit diesem Namen gibt es schon.",
      );
      expect(field).toHaveValue("Ziel");
    });

    it("keeps the name on Abbrechen", async () => {
      const { onRenameStation } = setup();

      const field = await openRenameField("UHSt 3");
      await userEvent.type(field, " Nord");
      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

      expect(onRenameStation).not.toHaveBeenCalled();
      expect(screen.queryByRole("textbox", { name: "Neuer Name" })).toBeNull();
      expect(card("UHSt 3")).toBeInTheDocument();
    });
  });

  describe("the card of a Stelle", () => {
    it("shows its latest valid report with time and note", () => {
      setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [
              report(),
              report({
                helpers: 9,
                number: 3,
                reportedAt: "2026-09-26T08:00:00.000Z",
              }),
            ],
          },
        ],
      });

      const item = card("UHSt 3");
      expect(within(item).getByText("0/1/6//7")).toBeInTheDocument();
      expect(within(item).getByText("+2 zusätzlich")).toBeInTheDocument();
      expect(within(item).getByText("9 Personen")).toBeInTheDocument();
      expect(
        within(item).getByText("2 einsatzbereite Streifen"),
      ).toBeInTheDocument();
      expect(within(item).getByText("11:01")).toBeInTheDocument();
    });

    it("skips an annulled latest report", () => {
      setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [
              report({ helpers: 4, number: 3 }),
              report({ helpers: 9, number: 4, state: "annulliert" }),
            ],
          },
        ],
      });

      expect(within(card("UHSt 3")).getByText("0/1/4//5")).toBeInTheDocument();
    });

    it("highlights its time once the report is older than 60 minutes", () => {
      const { rerender } = setup({
        stations: [{ id: "s1", name: "UHSt 3", reports: [report()] }],
        now: minutesAfterReport(60),
      });
      const time = () => within(card("UHSt 3")).getByText("11:01");
      expect(time()).not.toHaveAttribute("data-stale");

      rerender({ now: minutesAfterReport(60) + 1 });

      expect(time()).toHaveAttribute("data-stale");
    });

    it("never highlights the time of a report of 0 Personen", () => {
      setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [
              report({
                leaders: 0,
                subLeaders: 0,
                helpers: 0,
                additionalPersonnel: 0,
              }),
            ],
          },
        ],
        now: minutesAfterReport(600),
      });

      expect(within(card("UHSt 3")).getByText("11:01")).not.toHaveAttribute(
        "data-stale",
      );
    });

    it("shows „noch keine Meldung“ without a valid report", () => {
      setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [report({ state: "annulliert" })],
          },
          { id: "s2", name: "Ziel", reports: [] },
        ],
      });

      expect(
        within(card("UHSt 3")).getByText("noch keine Meldung"),
      ).toBeInTheDocument();
      expect(
        within(card("Ziel")).getByText("noch keine Meldung"),
      ).toBeInTheDocument();
    });
  });

  describe("the sum", () => {
    const sum = () => screen.getByRole("region", { name: "Summe" });
    const oldest = () => within(sum()).getByText(/^älteste Meldung/);
    const reportTotal = () =>
      within(sum()).getByRole("button", { name: "Gesamtstärke melden" });

    async function confirmReportTotal() {
      await userEvent.click(reportTotal());
      const dialog = await screen.findByRole("dialog", {
        name: "Gesamtstärke melden",
      });
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Melden" }),
      );
      return dialog;
    }

    const threeStations = () => [
      {
        id: "s1",
        name: "UHSt 3",
        reports: [
          report({
            leaders: 1,
            subLeaders: 2,
            helpers: 10,
            additionalPersonnel: 4,
          }),
        ],
      },
      {
        id: "s2",
        name: "Ziel",
        reports: [
          report({
            leaders: 1,
            subLeaders: 4,
            helpers: 15,
            additionalPersonnel: 2,
            // 10:10 in Berlin
            reportedAt: "2026-09-26T08:10:00.000Z",
          }),
        ],
      },
      { id: "s3", name: "Start", reports: [] },
    ];

    it("is not shown without Stellen", () => {
      setup({ stations: [] });

      expect(screen.queryByRole("region", { name: "Summe" })).toBeNull();
      expect(screen.getByRole("button", { name: "+ Stelle" })).toBeVisible();
    });

    it("adds up the latest valid reports and names the oldest of them", () => {
      setup({ stations: threeStations() });

      expect(within(sum()).getByText("2/6/25//33")).toBeInTheDocument();
      expect(within(sum()).getByText("+6 zusätzlich")).toBeInTheDocument();
      expect(within(sum()).getByText("39 Personen")).toBeInTheDocument();
      expect(oldest()).toHaveTextContent("älteste Meldung 10:10");
    });

    it("shows 0 without an oldest report when every Stelle reports 0", () => {
      setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [
              report({
                leaders: 0,
                subLeaders: 0,
                helpers: 0,
                additionalPersonnel: 0,
              }),
            ],
          },
        ],
      });

      expect(within(sum()).getByText("0/0/0//0")).toBeInTheDocument();
      expect(within(sum()).queryByText(/^älteste Meldung/)).toBeNull();
      expect(reportTotal()).toBeEnabled();
    });

    it("highlights the oldest report once it is older than 60 minutes", () => {
      const { rerender } = setup({
        stations: threeStations(),
        now: new Date("2026-09-26T09:10:00.000Z").getTime(),
      });
      expect(oldest()).not.toHaveAttribute("data-stale");

      rerender({ now: new Date("2026-09-26T09:10:00.001Z").getTime() });

      expect(oldest()).toHaveAttribute("data-stale");
    });

    it("is not shown while a Stelle's form is open", async () => {
      setup({ stations: threeStations() });

      await userEvent.click(within(card("Ziel")).getByText("Ziel"));

      expect(screen.queryByRole("region", { name: "Summe" })).toBeNull();
    });

    it("cannot be reported without a valid report", () => {
      setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [report({ state: "annulliert" })],
          },
        ],
      });

      expect(within(sum()).getByText("0/0/0//0")).toBeInTheDocument();
      expect(reportTotal()).toBeDisabled();
    });

    it("asks for confirmation and reports the Gesamtstärke only once confirmed", async () => {
      const { onReportTotalStrength } = setup({ stations: threeStations() });

      await userEvent.click(reportTotal());

      const dialog = await screen.findByRole("dialog", {
        name: "Gesamtstärke melden",
      });
      expect(onReportTotalStrength).not.toHaveBeenCalled();
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Melden" }),
      );

      expect(onReportTotalStrength).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("names the sum to be entered into the ETB in the confirmation", async () => {
      setup({ stations: threeStations() });

      await userEvent.click(reportTotal());

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("2/6/25//33")).toBeInTheDocument();
      expect(within(dialog).getByText("+6 zusätzlich")).toBeInTheDocument();
      expect(within(dialog).getByText("39 Personen")).toBeInTheDocument();
      expect(within(dialog).getByText(/Einsatztagebuch/)).toBeInTheDocument();
    });

    it("reports nothing when the confirmation is cancelled", async () => {
      const { onReportTotalStrength } = setup({ stations: threeStations() });
      await userEvent.click(reportTotal());

      await userEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Abbrechen",
        }),
      );

      expect(onReportTotalStrength).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("reports only once on a double click", async () => {
      const { onReportTotalStrength } = setup({
        stations: threeStations(),
        onReportTotalStrength: vi.fn(() => new Promise<ActionResult>(() => {})),
      });
      await userEvent.click(reportTotal());

      await userEvent.dblClick(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Melden",
        }),
      );

      expect(onReportTotalStrength).toHaveBeenCalledTimes(1);
    });

    it("reports only once when the second click lands on the closing dialog", async () => {
      const onReportTotalStrength = vi.fn(async () => ({}));
      // Ohne env="test": der Dialog blendet sich wie in der App erst aus.
      rtlRender(
        <MantineProvider>
          <StrengthPanel
            {...setupProps({
              stations: threeStations(),
              onReportTotalStrength,
            })}
          />
        </MantineProvider>,
      );
      await userEvent.click(reportTotal());
      const melden = within(await screen.findByRole("dialog")).getByRole(
        "button",
        { name: "Melden" },
      );

      await userEvent.click(melden);
      await userEvent.click(melden);

      expect(onReportTotalStrength).toHaveBeenCalledTimes(1);
    });

    it("stays open while the report is being sent", async () => {
      setup({
        stations: threeStations(),
        onReportTotalStrength: vi.fn(() => new Promise<ActionResult>(() => {})),
      });

      const dialog = await confirmReportTotal();
      await userEvent.keyboard("{Escape}");

      expect(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      ).toBeDisabled();
      expect(screen.getByRole("dialog")).toBe(dialog);
    });

    it("shows a returned error", async () => {
      setup({
        stations: threeStations(),
        onReportTotalStrength: vi.fn(async () => ({
          error: "Es gibt noch keine gültige Stärkemeldung.",
        })),
      });

      const dialog = await confirmReportTotal();

      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Es gibt noch keine gültige Stärkemeldung.",
      );
      expect(screen.getByRole("dialog")).toBe(dialog);
    });

    it("opens the next confirmation without the previous error", async () => {
      setup({
        stations: threeStations(),
        onReportTotalStrength: vi.fn(async () => ({
          error: "Es gibt noch keine gültige Stärkemeldung.",
        })),
      });
      const dialog = await confirmReportTotal();
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Abbrechen" }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      await userEvent.click(reportTotal());

      expect(
        within(await screen.findByRole("dialog")).queryByRole("alert"),
      ).toBeNull();
    });

    it("shows a failed report as an error", async () => {
      setup({
        stations: threeStations(),
        onReportTotalStrength: vi.fn(async () => {
          throw new Error("offline");
        }),
      });

      const dialog = await confirmReportTotal();

      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Speichern fehlgeschlagen. Bitte erneut versuchen.",
      );
    });
  });

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
        "Helfer",
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
              report({ helpers: 4, number: 3, note: "vorher" }),
              report({ helpers: 9, number: 4, state: "annulliert" }),
            ],
          },
        ],
      });

      await openReport("UHSt 3");

      expect(field("Führer")).toHaveValue("0");
      expect(field("Unterführer")).toHaveValue("1");
      expect(field("Helfer")).toHaveValue("4");
      expect(field("Zusätzliches Personal")).toHaveValue("2");
      expect(field("Notiz")).toHaveValue("vorher");
    });

    it("shows Σ and Gesamtpersonen computed as you type", async () => {
      setup({
        stations: [{ id: "s1", name: "UHSt 3", reports: [report()] }],
      });
      await openReport("UHSt 3");

      expect(screen.getByLabelText("Σ")).toHaveTextContent("7");
      expect(screen.getByLabelText("Personen")).toHaveTextContent("9");

      await userEvent.clear(field("Helfer"));
      await userEvent.type(field("Helfer"), "12");

      expect(screen.getByLabelText("Σ")).toHaveTextContent("13");
      expect(screen.getByLabelText("Personen")).toHaveTextContent("15");
    });

    it("replaces a prefilled number when typing into it", async () => {
      setup({
        stations: [{ id: "s1", name: "UHSt 3", reports: [report()] }],
      });
      await openReport("UHSt 3");

      await userEvent.type(field("Helfer"), "5");

      expect(field("Helfer")).toHaveValue("5");
    });

    it("takes at most four digits", async () => {
      setup();
      await openReport("UHSt 3");

      await userEvent.type(field("Helfer"), "123456");

      expect(field("Helfer")).toHaveValue("1234");
    });

    it("accepts neither negatives nor decimals", async () => {
      setup();
      await openReport("UHSt 3");

      await userEvent.clear(field("Helfer"));
      await userEvent.type(field("Helfer"), "-3.5");

      expect(field("Helfer")).toHaveValue("35");
    });

    it("reports the typed values and returns to the Stellen", async () => {
      const { onRecordStrengthReport } = setup();
      await openReport("UHSt 3");

      await userEvent.clear(field("Unterführer"));
      await userEvent.type(field("Unterführer"), "1");
      await userEvent.clear(field("Helfer"));
      await userEvent.type(field("Helfer"), "6");
      await userEvent.clear(field("Zusätzliches Personal"));
      await userEvent.type(field("Zusätzliches Personal"), "2");
      await userEvent.type(field("Notiz"), "2 einsatzbereite Streifen");
      await userEvent.click(screen.getByRole("button", { name: "Melden" }));

      expect(onRecordStrengthReport).toHaveBeenCalledWith("s1", {
        leaders: 0,
        subLeaders: 1,
        helpers: 6,
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

      await userEvent.clear(field("Helfer"));
      await userEvent.clear(field("Notiz"));
      await userEvent.click(screen.getByRole("button", { name: "Melden" }));

      expect(onRecordStrengthReport).toHaveBeenCalledWith("s1", {
        leaders: 0,
        subLeaders: 1,
        helpers: 0,
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
              report({ helpers: 9, number: 4, state: "annulliert" }),
            ],
          },
        ],
      });
      await openReport("UHSt 3");
      await userEvent.type(field("Helfer"), "5");

      await userEvent.click(
        screen.getByRole("button", { name: "Unverändert melden" }),
      );

      expect(onRecordStrengthReport).toHaveBeenCalledTimes(1);
      expect(onRecordStrengthReport).toHaveBeenCalledWith("s1", {
        leaders: 0,
        subLeaders: 1,
        helpers: 6,
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
      await userEvent.clear(field("Helfer"));
      await userEvent.type(field("Helfer"), "6");

      await userEvent.click(screen.getByRole("button", { name: "Melden" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.",
      );
      expect(field("Helfer")).toHaveValue("6");
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
      await userEvent.type(field("Helfer"), "4");

      await act(async () => finish({}));

      expect(onRecordStrengthReport).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Ziel · neue Meldung")).toBeInTheDocument();
      expect(field("Helfer")).toHaveValue("4");
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
      await userEvent.clear(field("Helfer"));
      await userEvent.type(field("Helfer"), "3");

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
                helpers: 8,
              }),
            ],
          },
        ],
      });

      expect(field("Helfer")).toHaveValue("8");
    });

    it("keeps typed values when the data refreshes without a new latest report", async () => {
      const { rerender } = setup({
        stations: [
          { id: "s1", name: "UHSt 3", reports: [report()] },
          { id: "s2", name: "Ziel", reports: [] },
        ],
      });
      await openReport("UHSt 3");
      await userEvent.clear(field("Helfer"));
      await userEvent.type(field("Helfer"), "3");

      rerender({
        stations: [
          { id: "s1", name: "UHSt 3", reports: [report()] },
          {
            id: "s2",
            name: "Ziel",
            reports: [report({ id: "r9", number: 9, helpers: 8 })],
          },
        ],
      });

      expect(field("Helfer")).toHaveValue("3");
    });

    it("prefills afresh when the form is opened again", async () => {
      setup({
        stations: [{ id: "s1", name: "UHSt 3", reports: [report()] }],
      });
      await openReport("UHSt 3");
      await userEvent.clear(field("Helfer"));
      await userEvent.type(field("Helfer"), "3");
      await userEvent.click(screen.getByRole("button", { name: "Zurück" }));

      await openReport("UHSt 3");

      expect(field("Helfer")).toHaveValue("6");
    });
  });

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
          helpers: 6,
          additionalPersonnel: 2,
          note: null,
        }),
        report({
          number: 17,
          reportedAt: "2026-09-26T08:10:00.000Z",
          leaders: 1,
          subLeaders: 1,
          helpers: 5,
          additionalPersonnel: 3,
          note: "Streife unterwegs",
        }),
        report({
          number: 9,
          reportedAt: "2026-09-26T07:04:00.000Z",
          leaders: 1,
          subLeaders: 1,
          helpers: 5,
          additionalPersonnel: 2,
          note: "Übergabe",
        }),
      ]);

      expect(historyRows()).toEqual([
        ["Zeit", "F/UF/H//Σ", "+", "Pers.", ""],
        ["10:10", "1/1/5//7", "3", "10", "⋯"],
        ["Streife unterwegs"],
        ["09:04", "1/1/5//7", "2", "9", "⋯"],
        ["Übergabe"],
        ["08:02", "1/1/6//8", "2", "10", "⋯"],
      ]);
    });

    it("leaves out annulled reports", async () => {
      await openHistory([
        report({ number: 3, helpers: 4 }),
        report({ number: 7, helpers: 9, state: "annulliert" }),
      ]);

      expect(historyRows()).toEqual([
        ["Zeit", "F/UF/H//Σ", "+", "Pers.", ""],
        ["11:01", "0/1/4//5", "2", "7", "⋯"],
        ["2 einsatzbereite Streifen"],
      ]);
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
                helpers: 9,
              }),
            ],
          },
        ],
      });

      expect(historyRows()).toEqual([
        ["Zeit", "F/UF/H//Σ", "+", "Pers.", ""],
        ["11:30", "0/1/9//10", "2", "12", "⋯"],
        ["2 einsatzbereite Streifen"],
        ["11:01", "0/1/6//7", "2", "9", "⋯"],
        ["2 einsatzbereite Streifen"],
      ]);
    });

    it("is not shown without a valid report", async () => {
      await openHistory([report({ state: "annulliert" })]);

      expect(screen.queryByRole("table")).toBeNull();
    });
  });

  describe("correcting a report", () => {
    const field = (label: string) =>
      screen.getByRole("textbox", { name: label });

    const stations = () => [
      {
        id: "s1",
        name: "UHSt 3",
        reports: [
          report({ id: "r1", number: 3, helpers: 4, note: null }),
          report({
            id: "r2",
            number: 7,
            reportedAt: "2026-09-26T09:30:00.000Z",
            helpers: 9,
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
      expect(field("Helfer")).toHaveValue("4");
      expect(field("Zusätzliches Personal")).toHaveValue("2");
      expect(field("Notiz")).toHaveValue("");
      expect(screen.getByRole("combobox", { name: "Stelle" })).toHaveValue(
        "s1",
      );
    });

    it("saves the corrected values and Stelle and goes back to the new report", async () => {
      const { onCorrectStrengthReport } = setup({ stations: stations() });
      await openCorrection("11:30 (#7)");

      await userEvent.clear(field("Helfer"));
      await userEvent.type(field("Helfer"), "8");
      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Stelle" }),
        "Ziel",
      );
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      expect(onCorrectStrengthReport).toHaveBeenCalledWith("r2", "s2", {
        leaders: 0,
        subLeaders: 1,
        helpers: 8,
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
      await userEvent.clear(field("Helfer"));
      await userEvent.type(field("Helfer"), "3");

      await userEvent.click(
        screen.getByRole("button", { name: "Aktionen für Meldung 11:01 (#3)" }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Korrigieren" }),
      );
      expect(field("Helfer")).toHaveValue("4");
      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

      expect(field("Helfer")).toHaveValue("3");
    });

    it("prefills the new report afresh after a correction", async () => {
      const corrected = stations();
      corrected[0].reports[1] = { ...corrected[0].reports[1], helpers: 8 };
      const { rerender } = setup({ stations: stations() });
      await openCorrection("11:30 (#7)");
      await userEvent.clear(field("Helfer"));
      await userEvent.type(field("Helfer"), "8");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      rerender({ stations: corrected });

      expect(
        screen.getByRole("heading", { name: "UHSt 3 · neue Meldung" }),
      ).toBeInTheDocument();
      expect(field("Helfer")).toHaveValue("8");
    });

    it("keeps a started new report when an older report is corrected", async () => {
      const corrected = stations();
      corrected[0].reports[0] = { ...corrected[0].reports[0], helpers: 5 };
      const { rerender } = setup({ stations: stations() });
      await userEvent.click(within(card("UHSt 3")).getByText("UHSt 3"));
      await userEvent.clear(field("Helfer"));
      await userEvent.type(field("Helfer"), "3");
      await userEvent.click(
        screen.getByRole("button", { name: "Aktionen für Meldung 11:01 (#3)" }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Korrigieren" }),
      );
      await userEvent.clear(field("Helfer"));
      await userEvent.type(field("Helfer"), "5");
      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      rerender({ stations: corrected });

      expect(field("Helfer")).toHaveValue("3");
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
      await userEvent.clear(field("Helfer"));
      await userEvent.type(field("Helfer"), "8");

      await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Annullierte Einträge können nicht geändert werden.",
      );
      expect(field("Helfer")).toHaveValue("8");
    });
  });

  describe("annulling a report", () => {
    const stations = (state: "gueltig" | "annulliert" = "gueltig") => [
      {
        id: "s1",
        name: "UHSt 3",
        reports: [
          report({ id: "r1", number: 3, helpers: 4 }),
          report({
            id: "r2",
            number: 7,
            reportedAt: "2026-09-26T09:30:00.000Z",
            helpers: 9,
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
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Annullieren" }),
      );

      expect(onAnnulStrengthReport).toHaveBeenCalledWith("r2");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("prefills the new report afresh after an annulment", async () => {
      const { rerender } = setup({ stations: stations() });
      await openAnnulment();
      expect(screen.getByRole("textbox", { name: "Helfer" })).toHaveValue("9");
      await userEvent.click(
        within(await screen.findByRole("dialog")).getByRole("button", {
          name: "Annullieren",
        }),
      );

      rerender({ stations: stations("annulliert") });

      expect(screen.getByRole("textbox", { name: "Helfer" })).toHaveValue("4");
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
        "Speichern fehlgeschlagen. Bitte erneut versuchen.",
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

  describe("the Summenverlauf", () => {
    const openTotalHistory = () =>
      userEvent.click(
        within(screen.getByRole("region", { name: "Summe" })).getByRole(
          "button",
          { name: "Verlauf" },
        ),
      );

    const totalHistoryRows = () =>
      within(screen.getByRole("table", { name: "Summenverlauf" }))
        .getAllByRole("row")
        .map((row) =>
          Array.from(row.querySelectorAll("th, td")).map((c) => c.textContent),
        );

    it("lists a row per valid report, newest first, with the sum that applied then", async () => {
      setup({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [
              // 08:02 in Berlin
              report({ number: 1, reportedAt: "2026-09-26T06:02:00.000Z" }),
              report({
                number: 4,
                reportedAt: "2026-09-26T08:10:00.000Z",
                helpers: 3,
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
                helpers: 10,
                additionalPersonnel: 0,
              }),
            ],
          },
        ],
      });

      await openTotalHistory();

      expect(totalHistoryRows()).toEqual([
        ["Zeit", "F/UF/H//Σ", "+", "Pers."],
        ["09:04", "1/2/16//19", "2", "21"],
        ["08:02", "0/1/6//7", "2", "9"],
      ]);
      expect(screen.queryByRole("region", { name: "Summe" })).toBeNull();
    });

    it("goes back to the Stellen", async () => {
      setup({ stations: [{ id: "s1", name: "UHSt 3", reports: [report()] }] });
      await openTotalHistory();

      await userEvent.click(screen.getByRole("button", { name: "Zurück" }));

      expect(screen.queryByRole("table")).toBeNull();
      expect(card("UHSt 3")).toBeInTheDocument();
    });

    it("shows a report arriving live while it is open", async () => {
      const { rerender } = setup({
        stations: [
          { id: "s1", name: "UHSt 3", reports: [report({ number: 1 })] },
          { id: "s2", name: "Ziel", reports: [] },
        ],
      });
      await openTotalHistory();

      rerender({
        stations: [
          { id: "s1", name: "UHSt 3", reports: [report({ number: 1 })] },
          {
            id: "s2",
            name: "Ziel",
            reports: [
              report({
                number: 2,
                reportedAt: "2026-09-26T09:30:00.000Z",
                helpers: 4,
                additionalPersonnel: 0,
              }),
            ],
          },
        ],
      });

      expect(totalHistoryRows()).toEqual([
        ["Zeit", "F/UF/H//Σ", "+", "Pers."],
        ["11:30", "0/2/10//12", "2", "14"],
        ["11:01", "0/1/6//7", "2", "9"],
      ]);
    });

    it("shows no table once its last valid report is annulled", async () => {
      const { rerender } = setup({
        stations: [{ id: "s1", name: "UHSt 3", reports: [report()] }],
      });
      await openTotalHistory();

      rerender({
        stations: [
          {
            id: "s1",
            name: "UHSt 3",
            reports: [report({ state: "annulliert" })],
          },
        ],
      });

      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.getByRole("button", { name: "Zurück" })).toBeVisible();
    });

    it("cannot be opened without a valid report", () => {
      setup();

      expect(
        within(screen.getByRole("region", { name: "Summe" })).getByRole(
          "button",
          { name: "Verlauf" },
        ),
      ).toBeDisabled();
    });
  });
});
