import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/app/action-result";
import { buttonColor } from "@/test/button-color";
import { render, screen, within } from "@/test/render";
import { StationCard, TotalCard } from "./StrengthCards";
import type { StationView, StrengthReportView } from "./StrengthPanel";
import { minutesAfterReport, report, strength } from "./StrengthPanel.fixtures";

const zero = { leaders: 0, subLeaders: 0, crew: 0, additionalPersonnel: 0 };

describe("StationCard", () => {
  function setup(reports: StrengthReportView[], now = minutesAfterReport(5)) {
    const onRename = vi.fn();
    const station = (): StationView => ({ id: "s1", name: "UHSt 3", reports });
    const { rerender } = render(
      <StationCard station={station()} now={now} onRename={onRename} />,
    );
    return {
      onRename,
      rerender: (next: number) =>
        rerender(
          <StationCard station={station()} now={next} onRename={onRename} />,
        ),
    };
  }

  it("shows its name and its latest valid report with time and note", () => {
    setup([
      report(),
      report({ crew: 9, number: 3, reportedAt: "2026-09-26T08:00:00.000Z" }),
    ]);

    expect(screen.getByRole("heading")).toHaveTextContent("UHSt 3");
    expect(screen.getByText(strength("0/1/6/7"))).toBeInTheDocument();
    expect(screen.getByText("+2 zusätzlich")).toBeInTheDocument();
    expect(screen.getByText("9 Personen")).toBeInTheDocument();
    expect(screen.getByText("2 einsatzbereite Streifen")).toBeInTheDocument();
    expect(screen.getByText("11:01")).toBeInTheDocument();
  });

  it("skips an annulled latest report", () => {
    setup([
      report({ crew: 4, number: 3 }),
      report({ crew: 9, number: 4, state: "annulliert" }),
    ]);

    expect(screen.getByText(strength("0/1/4/5"))).toBeInTheDocument();
  });

  it("highlights its time once the report is older than 60 minutes", () => {
    const { rerender } = setup([report()], minutesAfterReport(60));
    const time = () => screen.getByText("11:01");
    expect(time()).not.toHaveAttribute("data-stale");

    rerender(minutesAfterReport(60) + 1);

    expect(time()).toHaveAttribute("data-stale");
  });

  it("never highlights the time of a report of 0 Personen", () => {
    setup([report(zero)], minutesAfterReport(600));

    expect(screen.getByText("11:01")).not.toHaveAttribute("data-stale");
  });

  it.each([
    ["only an annulled report", [report({ state: "annulliert" })]],
    ["no report", []],
  ])("shows „noch keine Meldung“ with %s", (_, reports) => {
    setup(reports);

    expect(screen.getByText("noch keine Meldung")).toBeInTheDocument();
    expect(screen.queryByText("11:01")).toBeNull();
  });

  it("asks to rename the Stelle on its pencil", async () => {
    const { onRename } = setup([]);

    await userEvent.click(
      screen.getByRole("button", { name: "UHSt 3 umbenennen" }),
    );

    expect(onRename).toHaveBeenCalledTimes(1);
  });
});

describe("TotalCard", () => {
  function setup(
    stations: StationView[],
    now = minutesAfterReport(5),
    onReport = vi.fn(async (): Promise<ActionResult> => ({})),
  ) {
    const onShowHistory = vi.fn();
    const card = (at: number) => (
      <TotalCard
        stations={stations}
        now={at}
        onReport={onReport}
        onShowHistory={onShowHistory}
      />
    );
    const { rerender } = render(card(now));
    return {
      onReport,
      onShowHistory,
      rerender: (next: number) => rerender(card(next)),
    };
  }

  const sum = () => screen.getByRole("region", { name: "Summe" });
  const oldest = () => within(sum()).getByText(/^älteste Meldung/);
  const button = (name: string) => within(sum()).getByRole("button", { name });

  const threeStations = () => [
    {
      id: "s1",
      name: "UHSt 3",
      reports: [
        report({ leaders: 1, subLeaders: 2, crew: 10, additionalPersonnel: 4 }),
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

  const onlyAnnulled = () => [
    { id: "s1", name: "UHSt 3", reports: [report({ state: "annulliert" })] },
  ];

  it("adds up the latest valid reports and names the oldest of them", () => {
    setup(threeStations());

    expect(within(sum()).getByText(strength("2/6/25/33"))).toBeInTheDocument();
    expect(within(sum()).getByText("+6 zusätzlich")).toBeInTheDocument();
    expect(within(sum()).getByText("39 Personen")).toBeInTheDocument();
    expect(oldest()).toHaveTextContent("älteste Meldung 10:10");
  });

  it("shows 0 without an oldest report when every Stelle reports 0", () => {
    setup([{ id: "s1", name: "UHSt 3", reports: [report(zero)] }]);

    expect(within(sum()).getByText(strength("0/0/0/0"))).toBeInTheDocument();
    expect(within(sum()).queryByText(/^älteste Meldung/)).toBeNull();
    expect(button("Gesamtstärke melden")).toBeEnabled();
    expect(button("Verlauf")).toBeEnabled();
  });

  it("highlights the oldest report once it is older than 60 minutes", () => {
    const { rerender } = setup(
      threeStations(),
      new Date("2026-09-26T09:10:00.000Z").getTime(),
    );
    expect(oldest()).not.toHaveAttribute("data-stale");

    rerender(new Date("2026-09-26T09:10:00.001Z").getTime());

    expect(oldest()).toHaveAttribute("data-stale");
  });

  it("can neither be reported nor show its Verlauf without a valid report", () => {
    setup(onlyAnnulled());

    expect(within(sum()).getByText(strength("0/0/0/0"))).toBeInTheDocument();
    expect(button("Gesamtstärke melden")).toBeDisabled();
    expect(button("Verlauf")).toBeDisabled();
  });

  it("asks to show its Verlauf", async () => {
    const { onShowHistory } = setup(threeStations());

    await userEvent.click(button("Verlauf"));

    expect(onShowHistory).toHaveBeenCalledTimes(1);
  });

  it("asks for confirmation, naming the sum for the ETB, and reports the Gesamtstärke only once confirmed", async () => {
    const { onReport } = setup(threeStations());

    await userEvent.click(button("Gesamtstärke melden"));

    const dialog = await screen.findByRole("dialog", {
      name: "Gesamtstärke melden",
    });
    expect(within(dialog).getByText(strength("2/6/25/33"))).toBeInTheDocument();
    expect(within(dialog).getByText("+6 zusätzlich")).toBeInTheDocument();
    expect(within(dialog).getByText("39 Personen")).toBeInTheDocument();
    expect(within(dialog).getByText(/Einsatztagebuch/)).toBeInTheDocument();
    expect(onReport).not.toHaveBeenCalled();
    const melden = within(dialog).getByRole("button", { name: "Melden" });
    expect(buttonColor(melden)).toBe("blue");
    await userEvent.click(melden);

    expect(onReport).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows an error returned on reporting in the confirmation", async () => {
    setup(
      threeStations(),
      minutesAfterReport(5),
      vi.fn(async () => ({ error: "Keine gültige Stärkemeldung." })),
    );

    await userEvent.click(button("Gesamtstärke melden"));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Melden" }));

    expect(dialog.getByRole("alert")).toHaveTextContent(
      "Keine gültige Stärkemeldung.",
    );
  });
});
