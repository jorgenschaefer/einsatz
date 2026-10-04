import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NO_ROUTE } from "@/journal/entry-route";
import { fireEvent, screen, within } from "@/test/render";
import {
  chooseAction,
  correctionForm,
  entry,
  setup,
} from "./JournalPanel.fixtures";

const correction = () => within(correctionForm());
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

  it("corrects a manual entry through an inline edit prefilled with the current text", async () => {
    const props = setup();
    await chooseAction(1, "Korrigieren");
    const field = screen.getByLabelText(/Korrektur/);
    expect(field).toHaveValue("Deich hält");
    expect(props.onCorrect).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "Deich hält nicht" } });
    await userEvent.click(screen.getByRole("button", { name: /Speichern/ }));
    expect(props.onCorrect).toHaveBeenCalledWith("e1", {
      text: "Deich hält nicht",
      ...NO_ROUTE,
    });
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
});
