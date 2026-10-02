import { MantineProvider } from "@mantine/core";
import { render as rtlRender } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { screen, waitFor, within } from "@/test/render";
import { StrengthPanel } from "./StrengthPanel";
import {
  card,
  report,
  setup,
  setupProps,
  strength,
} from "./StrengthPanel.fixtures";

describe("StrengthPanel", () => {
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
            crew: 10,
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
            crew: 15,
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

      expect(
        within(sum()).getByText(strength("2/6/25/33")),
      ).toBeInTheDocument();
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
                crew: 0,
                additionalPersonnel: 0,
              }),
            ],
          },
        ],
      });

      expect(within(sum()).getByText(strength("0/0/0/0"))).toBeInTheDocument();
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

      expect(within(sum()).getByText(strength("0/0/0/0"))).toBeInTheDocument();
      expect(reportTotal()).toBeDisabled();
    });

    it("asks for confirmation and reports the Gesamtstärke only once confirmed", async () => {
      const { onReportTotalStrength } = setup({ stations: threeStations() });

      await userEvent.click(reportTotal());

      const dialog = await screen.findByRole("dialog", {
        name: "Gesamtstärke melden",
      });
      expect(onReportTotalStrength).not.toHaveBeenCalled();
      const melden = within(dialog).getByRole("button", { name: "Melden" });
      expect(buttonColor(melden)).toBe("blue");
      await userEvent.click(melden);

      expect(onReportTotalStrength).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("names the sum to be entered into the ETB in the confirmation", async () => {
      setup({ stations: threeStations() });

      await userEvent.click(reportTotal());

      const dialog = await screen.findByRole("dialog");
      expect(
        within(dialog).getByText(strength("2/6/25/33")),
      ).toBeInTheDocument();
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
        "Das hat nicht geklappt. Bitte erneut versuchen.",
      );
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
        ],
      });

      await openTotalHistory();

      expect(totalHistoryRows()).toEqual([
        ["Zeit", "F/UF/E/G", "+", "Pers."],
        ["09:04", "1/2/16/19", "2", "21"],
        ["08:02", "0/1/6/7", "2", "9"],
      ]);
      const table = within(
        screen.getByRole("table", { name: "Summenverlauf" }),
      );
      expect(table.getByText(strength("F/UF/E/G"))).toBeInTheDocument();
      expect(table.getByText(strength("1/2/16/19"))).toBeInTheDocument();
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
                crew: 4,
                additionalPersonnel: 0,
              }),
            ],
          },
        ],
      });

      expect(totalHistoryRows()).toEqual([
        ["Zeit", "F/UF/E/G", "+", "Pers."],
        ["11:30", "0/2/10/12", "2", "14"],
        ["11:01", "0/1/6/7", "2", "9"],
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
