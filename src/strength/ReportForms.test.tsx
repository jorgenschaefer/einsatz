import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@/test/render";
import { CorrectionForm, ReportForm } from "./ReportForms";
import type { StationView, StrengthReportView } from "./StrengthPanel";
import { report } from "./StrengthPanel.fixtures";

const field = (label: string) => screen.getByRole("textbox", { name: label });

async function retype(label: string, text: string) {
  await userEvent.clear(field(label));
  await userEvent.type(field(label), text);
}

describe("ReportForm", () => {
  function setup(
    reports: StrengthReportView[] = [],
    onReport = vi.fn(async () => {}),
  ) {
    const onBack = vi.fn();
    render(
      <ReportForm
        station={{ id: "s1", name: "UHSt 3", reports }}
        onReport={onReport}
        onBack={onBack}
      />,
    );
    return { onReport, onBack };
  }

  it("starts at zero for the first report and has no „Unverändert melden“", () => {
    setup();

    expect(
      screen.getByRole("heading", { name: "UHSt 3 · neue Meldung" }),
    ).toBeInTheDocument();
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

  it("prefills the latest valid report, note included", () => {
    setup([
      report({ leaders: 1, crew: 4, number: 3, note: "vorher" }),
      report({ crew: 9, number: 4, state: "annulliert" }),
    ]);

    expect(field("Führer")).toHaveValue("1");
    expect(field("Unterführer")).toHaveValue("1");
    expect(field("EK")).toHaveValue("4");
    expect(field("Zusätzliches Personal")).toHaveValue("2");
    expect(field("Notiz")).toHaveValue("vorher");
  });

  it("shows G and Gesamtpersonen computed as you type", async () => {
    setup([report()]);

    expect(screen.getByLabelText("G")).toHaveTextContent("7");
    expect(screen.getByLabelText("Personen")).toHaveTextContent("9");

    await retype("EK", "12");

    expect(screen.getByLabelText("G")).toHaveTextContent("13");
    expect(screen.getByLabelText("Personen")).toHaveTextContent("15");
  });

  it("replaces a prefilled number when typing into it", async () => {
    setup([report()]);

    await userEvent.type(field("EK"), "5");

    expect(field("EK")).toHaveValue("5");
  });

  it.each([
    ["at most four digits", "123456", "1234"],
    ["neither negatives nor decimals", "-3.5", "35"],
  ])("takes %s", async (_, typed, kept) => {
    setup();

    await retype("EK", typed);

    expect(field("EK")).toHaveValue(kept);
  });

  it("reports the typed values", async () => {
    const { onReport } = setup();

    await retype("Führer", "1");
    await retype("Unterführer", "2");
    await retype("EK", "6");
    await retype("Zusätzliches Personal", "3");
    await userEvent.type(field("Notiz"), " 2 einsatzbereite Streifen ");
    await userEvent.click(screen.getByRole("button", { name: "Melden" }));

    expect(onReport).toHaveBeenCalledWith({
      leaders: 1,
      subLeaders: 2,
      crew: 6,
      additionalPersonnel: 3,
      note: "2 einsatzbereite Streifen",
    });
  });

  it("reports an emptied number as 0 and an empty note as none", async () => {
    const { onReport } = setup([report({ note: "alt" })]);

    await userEvent.clear(field("EK"));
    await userEvent.clear(field("Notiz"));
    await userEvent.click(screen.getByRole("button", { name: "Melden" }));

    expect(onReport).toHaveBeenCalledWith({
      leaders: 0,
      subLeaders: 1,
      crew: 0,
      additionalPersonnel: 2,
      note: null,
    });
  });

  it("„Unverändert melden“ reports the latest valid report in one tap, whatever was typed", async () => {
    const { onReport } = setup([
      report({ leaders: 1, number: 3 }),
      report({ crew: 9, number: 4, state: "annulliert" }),
    ]);
    await userEvent.type(field("EK"), "5");

    await userEvent.click(
      screen.getByRole("button", { name: "Unverändert melden" }),
    );

    expect(onReport).toHaveBeenCalledTimes(1);
    expect(onReport).toHaveBeenCalledWith({
      leaders: 1,
      subLeaders: 1,
      crew: 6,
      additionalPersonnel: 2,
      note: "2 einsatzbereite Streifen",
    });
  });

  it("locks reporting until the report is saved", async () => {
    let saved = () => {};
    setup(
      [report()],
      vi.fn(() => new Promise<void>((resolve) => (saved = resolve))),
    );
    const melden = screen.getByRole("button", { name: "Melden" });
    const unchanged = screen.getByRole("button", {
      name: "Unverändert melden",
    });

    await userEvent.click(melden);

    expect(melden).toBeDisabled();
    expect(unchanged).toBeDisabled();
    await act(async () => saved());
    expect(melden).toBeEnabled();
    expect(unchanged).toBeEnabled();
  });

  it("goes back on Zurück without reporting", async () => {
    const { onReport, onBack } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Zurück" }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onReport).not.toHaveBeenCalled();
  });
});

describe("CorrectionForm", () => {
  const stations: StationView[] = [
    { id: "s1", name: "UHSt 3", reports: [] },
    { id: "s2", name: "Ziel", reports: [] },
  ];

  function setup(onCorrect = vi.fn(async () => {})) {
    const onCancel = vi.fn();
    render(
      <CorrectionForm
        station={stations[0]}
        report={report({ id: "r1", number: 3, crew: 4, note: null })}
        stations={stations}
        onCorrect={onCorrect}
        onCancel={onCancel}
      />,
    );
    return { onCorrect, onCancel };
  }

  const stationSelect = () => screen.getByRole("combobox", { name: "Stelle" });

  it("prefills the report and its Stelle, focused, offering every Stelle", () => {
    setup();

    expect(
      screen.getByRole("heading", {
        name: "UHSt 3 · Meldung 11:01 korrigieren",
      }),
    ).toBeInTheDocument();
    expect(field("EK")).toHaveValue("4");
    expect(field("Zusätzliches Personal")).toHaveValue("2");
    expect(field("Notiz")).toHaveValue("");
    expect(stationSelect()).toHaveValue("s1");
    expect(stationSelect()).toHaveFocus();
    expect(
      Array.from(stationSelect().querySelectorAll("option")).map(
        (o) => o.textContent,
      ),
    ).toEqual(["UHSt 3", "Ziel"]);
  });

  it("saves the corrected values and Stelle", async () => {
    const { onCorrect } = setup();

    await retype("EK", "8");
    await userEvent.type(field("Notiz"), "Streife unterwegs");
    await userEvent.selectOptions(stationSelect(), "Ziel");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(onCorrect).toHaveBeenCalledWith("s2", {
      leaders: 0,
      subLeaders: 1,
      crew: 8,
      additionalPersonnel: 2,
      note: "Streife unterwegs",
    });
  });

  it("locks Speichern until the correction is saved", async () => {
    let saved = () => {};
    setup(vi.fn(() => new Promise<void>((resolve) => (saved = resolve))));
    const speichern = screen.getByRole("button", { name: "Speichern" });

    await userEvent.click(speichern);

    expect(speichern).toBeDisabled();
    await act(async () => saved());
    expect(speichern).toBeEnabled();
  });

  it("cancels without saving", async () => {
    const { onCorrect, onCancel } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCorrect).not.toHaveBeenCalled();
  });
});
