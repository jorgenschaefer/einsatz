import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { screen } from "@/test/render";
import type { JournalPanelProps } from "./JournalPanel";
import { entry, setup } from "./JournalPanel.fixtures";

const newEntryField = () => screen.getByLabelText("Neuer Eintrag");
const channelSelect = () => screen.getByRole("combobox", { name: "Weg" });
const addButton = () =>
  screen.getByRole("button", { name: "Eintrag hinzufügen" });

async function writeEntry(text: string, channel: string) {
  await userEvent.type(newEntryField(), text);
  await userEvent.selectOptions(channelSelect(), channel);
}

/** Die Zeile im Eintrag direkt über seinem Text. */
const lineAbove = (text: string) =>
  screen.getByText(text).previousElementSibling?.textContent;

describe("JournalPanel – Von, An und Weg", () => {
  it.each([
    ["UHSt 2", "EAL", "Funk", "Von UHSt 2 an EAL · Funk"],
    [null, "EAL", "Telefon", "An EAL · Telefon"],
    ["UHSt 2", null, null, "Von UHSt 2"],
    [null, null, "Funk", "Funk"],
  ])(
    "shows Von %s, An %s, Weg %s as a header above the text",
    (sender, recipient, channel, header) => {
      setup({ entries: [entry({ sender, recipient, channel })] });

      expect(lineAbove("Deich hält")).toBe(header);
    },
  );

  it("shows no header on an entry without Von, An and Weg", () => {
    setup({ entries: [entry({ number: 7 })] });

    expect(lineAbove("Deich hält")).toContain("#7");
  });

  it("shows no header on an automatic entry", () => {
    setup({
      entries: [
        entry({
          number: 1,
          type: "einsatz-eröffnet",
          text: "Einsatz eröffnet",
          author: null,
        }),
      ],
    });

    expect(lineAbove("Einsatz eröffnet")).toContain("#1");
  });

  it("presets the Weg of a new entry to Funk", () => {
    setup();

    expect(channelSelect()).toHaveDisplayValue("Funk");
  });

  it.each([
    ["Telefon", "Telefon"],
    ["ohne", null],
  ])("adds a new entry with Weg %s", async (option, channel) => {
    const props = setup();

    await writeEntry("Deich hält", option);
    await userEvent.click(addButton());

    expect(props.onAdd).toHaveBeenCalledWith({
      text: "Deich hält",
      sender: null,
      recipient: null,
      channel,
    });
  });

  it("empties the text and keeps the Weg after adding", async () => {
    setup();

    await writeEntry("Deich hält", "Telefon");
    await userEvent.click(addButton());

    expect(newEntryField()).toHaveValue("");
    expect(channelSelect()).toHaveDisplayValue("Telefon");
  });

  it("keeps text and Weg and shows the error when adding fails", async () => {
    setup({
      onAdd: vi.fn<JournalPanelProps["onAdd"]>(async () => ({
        error: "Der Einsatz ist geschlossen.",
      })),
    });

    await writeEntry("Deich hält", "Persönlich");
    await userEvent.click(addButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Der Einsatz ist geschlossen.",
    );
    expect(newEntryField()).toHaveValue("Deich hält");
    expect(channelSelect()).toHaveDisplayValue("Persönlich");
  });

  it.each([
    ["the text field", newEntryField],
    ["the Weg", channelSelect],
  ])("adds the entry with its Weg on Strg+Enter in %s", async (_, field) => {
    const props = setup();

    await writeEntry("Deich hält", "Telefon");
    await userEvent.type(field(), "{Control>}{Enter}{/Control}");

    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Deich hält", channel: "Telefon" }),
    );
  });
});
