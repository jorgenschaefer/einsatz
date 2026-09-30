import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import { fireEvent, screen, within } from "@/test/render";
import type { JournalPanelProps } from "./JournalPanel";
import { chooseAction, entry, setup } from "./JournalPanel.fixtures";

/** Das Korrekturformular im Eintrag, getrennt vom Eingabebereich darunter. */
const correction = () => {
  const form = screen.getByLabelText("Korrektur").closest("[data-entry]");
  if (!(form instanceof HTMLElement)) throw new Error("no correction form");
  return within(form);
};
const chipRow = (label: "Von" | "An") =>
  correction().getByRole("group", { name: label });
const chipNames = (label: "Von" | "An") =>
  within(chipRow(label))
    .getAllByRole("checkbox")
    .map((c) => (c as HTMLInputElement).labels?.[0]?.textContent);
const chosenChips = (label: "Von" | "An") =>
  within(chipRow(label))
    .queryAllByRole("checkbox", { checked: true })
    .map((c) => (c as HTMLInputElement).labels?.[0]?.textContent);
const channelSelect = () => correction().getByRole("combobox", { name: "Weg" });
const channelField = () => correction().getByRole("textbox", { name: "Weg" });
const save = () =>
  userEvent.click(correction().getByRole("button", { name: "Speichern" }));

const CORRESPONDENTS = ["Abschnitt Nord", "BHP", "EAL", "UHSt 1", "UHSt 2"];
const ROUTED = { sender: "UHSt 2", recipient: "EAL", channel: "Funk" };

describe("JournalPanel – Korrigieren", () => {
  it("prefills Von, An and Weg of the entry, the chosen chips first in their rows", async () => {
    setup({ entries: [entry(ROUTED)], correspondents: CORRESPONDENTS });
    await chooseAction(1, "Korrigieren");

    expect(chipNames("Von")[0]).toBe("UHSt 2");
    expect(chosenChips("Von")).toEqual(["UHSt 2"]);
    expect(chipNames("An")[0]).toBe("EAL");
    expect(chosenChips("An")).toEqual(["EAL"]);
    expect(channelSelect()).toHaveDisplayValue("Funk");
  });

  it("corrects only the Weg of an entry", async () => {
    const props = setup({
      entries: [entry(ROUTED)],
      correspondents: CORRESPONDENTS,
    });
    await chooseAction(1, "Korrigieren");

    await userEvent.selectOptions(channelSelect(), "Telefon");
    await save();

    expect(props.onCorrect).toHaveBeenCalledWith("e1", {
      text: "Deich hält",
      ...ROUTED,
      channel: "Telefon",
    });
  });

  it("closes the correction once it is saved", async () => {
    setup({ entries: [entry(ROUTED)], correspondents: CORRESPONDENTS });
    await chooseAction(1, "Korrigieren");

    await save();

    expect(screen.queryByLabelText("Korrektur")).toBeNull();
  });

  it("corrects Von and An of an entry", async () => {
    const props = setup({
      entries: [entry(ROUTED)],
      correspondents: CORRESPONDENTS,
    });
    await chooseAction(1, "Korrigieren");

    await userEvent.click(
      within(chipRow("Von")).getByRole("checkbox", { name: "UHSt 2" }),
    );
    await userEvent.click(
      within(chipRow("An")).getByRole("checkbox", { name: "BHP" }),
    );
    await save();

    expect(props.onCorrect).toHaveBeenCalledWith("e1", {
      text: "Deich hält",
      sender: null,
      recipient: "BHP",
      channel: "Funk",
    });
  });

  it("keeps the unchosen prefilled chip first in its row", async () => {
    setup({ entries: [entry(ROUTED)], correspondents: CORRESPONDENTS });
    await chooseAction(1, "Korrigieren");

    await userEvent.click(
      within(chipRow("Von")).getByRole("checkbox", { name: "UHSt 2" }),
    );

    expect(chipNames("Von")[0]).toBe("UHSt 2");
    expect(chosenChips("Von")).toEqual([]);
  });

  it("prefills a free-text Weg in its text field", async () => {
    setup({
      entries: [entry({ ...ROUTED, channel: "Melder" })],
      correspondents: CORRESPONDENTS,
    });
    await chooseAction(1, "Korrigieren");

    expect(channelField()).toHaveValue("Melder");
  });

  it("leaves the focus alone when it opens with a free-text Weg", async () => {
    setup({
      entries: [entry({ ...ROUTED, channel: "Melder" })],
      correspondents: CORRESPONDENTS,
    });
    await chooseAction(1, "Korrigieren");

    expect(channelField()).not.toHaveFocus();
  });

  it("goes back from a prefilled free-text Weg to the choice with Funk on ×", async () => {
    setup({
      entries: [entry({ ...ROUTED, channel: "Melder" })],
      correspondents: CORRESPONDENTS,
    });
    await chooseAction(1, "Korrigieren");

    await userEvent.click(
      correction().getByRole("button", { name: "Zurück zur Auswahl" }),
    );

    expect(channelSelect()).toHaveDisplayValue("Funk");
  });

  it("shows the chip of Von in another spelling as chosen and first, and keeps the entry's spelling", async () => {
    const props = setup({
      entries: [entry({ ...ROUTED, sender: "UHST 2" })],
      correspondents: CORRESPONDENTS,
    });
    await chooseAction(1, "Korrigieren");

    expect(chipNames("Von")).toEqual([
      "UHSt 2",
      "Abschnitt Nord",
      "BHP",
      "EAL",
      "UHSt 1",
    ]);
    expect(chosenChips("Von")).toEqual(["UHSt 2"]);

    await save();

    expect(props.onCorrect).toHaveBeenCalledWith("e1", {
      text: "Deich hält",
      ...ROUTED,
      sender: "UHST 2",
    });
  });

  it("saves a correction with Strg+Enter in the Weg choice", async () => {
    const props = setup({
      entries: [entry(ROUTED)],
      correspondents: CORRESPONDENTS,
    });
    await chooseAction(1, "Korrigieren");

    await userEvent.selectOptions(channelSelect(), "Telefon");
    await userEvent.type(channelSelect(), "{Control>}{Enter}{/Control}");

    expect(props.onCorrect).toHaveBeenCalledWith("e1", {
      text: "Deich hält",
      ...ROUTED,
      channel: "Telefon",
    });
  });

  it("saves a correction with Strg+Enter in the free-text Weg", async () => {
    const props = setup({
      entries: [entry({ ...ROUTED, channel: "Melder" })],
      correspondents: CORRESPONDENTS,
    });
    await chooseAction(1, "Korrigieren");

    await userEvent.type(channelField(), " 3{Control>}{Enter}{/Control}");

    expect(props.onCorrect).toHaveBeenCalledWith("e1", {
      text: "Deich hält",
      ...ROUTED,
      channel: "Melder 3",
    });
  });

  it("saves a correction with Strg+Enter in the field for another Von", async () => {
    const props = setup({
      entries: [entry(ROUTED)],
      correspondents: CORRESPONDENTS,
    });
    await chooseAction(1, "Korrigieren");

    await userEvent.click(
      within(chipRow("Von")).getByRole("button", { name: "andere …" }),
    );
    await userEvent.type(
      correction().getByRole("combobox", { name: "Von" }),
      "Neu{Control>}{Enter}{/Control}",
    );

    expect(props.onCorrect).toHaveBeenCalledWith("e1", {
      text: "Deich hält",
      ...ROUTED,
      sender: "Neu",
    });
  });

  it("shows a prior fassung with its header struck through, its author and time", () => {
    setup({
      entries: [
        entry({
          ...ROUTED,
          channel: "Telefon",
          author: "bernd",
          editedAt: "2026-07-03T09:00:00.000Z",
          revisions: [
            {
              text: "Deich hält",
              author: "anna",
              createdAt: "2026-07-03T08:00:00.000Z",
              ...ROUTED,
            },
          ],
        }),
      ],
    });

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "DEL" &&
          element.textContent === "Von UHSt 2 an EAL · Funk",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/–\s*anna, 03\.07\.26, 10:00/)).toBeInTheDocument();
  });

  it("offers correcting from the entry's action menu without correcting yet", async () => {
    const props = setup();
    await chooseAction(1, "Korrigieren");
    expect(screen.getByLabelText(/Korrektur/)).toHaveValue("Deich hält");
    expect(props.onCorrect).not.toHaveBeenCalled();
  });

  it("hides the entry's menu while it is being corrected", async () => {
    setup();
    await chooseAction(1, "Korrigieren");
    expect(
      screen.queryByRole("button", { name: "Aktionen für Eintrag #1" }),
    ).toBeNull();
  });

  it("corrects a manual entry through an inline edit prefilled with the current text", async () => {
    const props = setup();
    await chooseAction(1, "Korrigieren");
    const field = screen.getByLabelText(/Korrektur/);
    fireEvent.change(field, { target: { value: "Deich hält nicht" } });
    await userEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    expect(props.onCorrect).toHaveBeenCalledWith("e1", {
      text: "Deich hält nicht",
      ...NO_ROUTE,
    });
  });

  it("renders prior fassungen struck through with their author", () => {
    setup({
      entries: [
        entry({
          text: "Deich hält nicht",
          author: "bernd",
          editedAt: "2026-07-03T09:00:00.000Z",
          revisions: [
            {
              text: "Deich hält",
              author: "anna",
              createdAt: "2026-07-03T08:00:00.000Z",
              ...NO_ROUTE,
            },
          ],
        }),
      ],
    });
    const prior = screen.getByText("Deich hält");
    expect(prior.closest("del")).toBeInTheDocument();
    // The prior fassung stays visible with its original author.
    expect(screen.getByText(/–\s*anna/)).toBeInTheDocument();
  });

  it("gives revisions with an identical timestamp distinct, collision-free keys", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sameTs = "2026-07-03T08:00:00.000Z";
    setup({
      entries: [
        entry({
          text: "Fassung 3",
          revisions: [
            {
              text: "Fassung 1",
              author: "anna",
              createdAt: sameTs,
              ...NO_ROUTE,
            },
            {
              text: "Fassung 2",
              author: "bernd",
              createdAt: sameTs,
              ...NO_ROUTE,
            },
          ],
        }),
      ],
    });
    expect(screen.getByText("Fassung 1")).toBeInTheDocument();
    expect(screen.getByText("Fassung 2")).toBeInTheDocument();
    expect(
      errorSpy.mock.calls.some((call) => String(call[0]).includes("same key")),
    ).toBe(false);
    errorSpy.mockRestore();
  });

  it("saves a correction with Strg+Enter in the edit field", async () => {
    const props = setup();
    await chooseAction(1, "Korrigieren");
    const field = screen.getByLabelText(/Korrektur/);
    fireEvent.change(field, { target: { value: "Deich hält nicht" } });
    await userEvent.type(field, "{Control>}{Enter}{/Control}");
    expect(props.onCorrect).toHaveBeenCalledWith("e1", {
      text: "Deich hält nicht",
      ...NO_ROUTE,
    });
  });

  it("surfaces a save error when a correction fails", async () => {
    const onCorrect = vi
      .fn<JournalPanelProps["onCorrect"]>()
      .mockRejectedValue(new Error("boom"));
    setup({ onCorrect });
    await chooseAction(1, "Korrigieren");
    const field = screen.getByLabelText(/Korrektur/);
    fireEvent.change(field, { target: { value: "Neuer Text" } });
    await userEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("surfaces a returned {error} from a correction (business ValidationError)", async () => {
    const onCorrect = vi
      .fn<JournalPanelProps["onCorrect"]>()
      .mockResolvedValue({
        error: "Annullierte Einträge können nicht geändert werden.",
      });
    setup({ onCorrect });
    await chooseAction(1, "Korrigieren");
    const field = screen.getByLabelText(/Korrektur/);
    fireEvent.change(field, { target: { value: "Neuer Text" } });
    await userEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    expect(
      await screen.findByText(
        "Annullierte Einträge können nicht geändert werden.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a correction timestamp on a corrected entry", () => {
    setup({ entries: [entry({ editedAt: "2026-07-03T09:30:00.000Z" })] });
    expect(screen.getByText(/korrigiert/i)).toBeInTheDocument();
  });
});
