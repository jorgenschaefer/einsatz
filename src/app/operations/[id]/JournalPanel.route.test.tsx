import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import { JournalPanel, type JournalPanelProps } from "./JournalPanel";
import { entry, panelProps, setup } from "./JournalPanel.fixtures";

const newEntryField = () => screen.getByLabelText("Neuer Eintrag");
const channelSelect = () => screen.getByRole("combobox", { name: "Weg" });
const addButton = () =>
  screen.getByRole("button", { name: "Eintrag hinzufügen" });
const chipRow = (label: "Von" | "An") =>
  screen.getByRole("group", { name: label });
const chip = (label: "Von" | "An", name: string) =>
  within(chipRow(label)).getByRole("checkbox", { name });
const chipNames = (label: "Von" | "An") =>
  within(chipRow(label))
    .getAllByRole("checkbox")
    .map((c) => (c as HTMLInputElement).labels?.[0]?.textContent);

const CORRESPONDENTS = ["UHSt 2", "EAL", "Leitstelle"];

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

  it("offers the correspondents as Von and An chips above the text field", () => {
    setup({ correspondents: CORRESPONDENTS });

    for (const label of ["Von", "An"] as const) {
      expect(chipNames(label)).toEqual(["EAL", "Leitstelle", "UHSt 2"]);
      expect(
        chipRow(label).compareDocumentPosition(newEntryField()) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("starts a new entry without Von and An", () => {
    setup({ correspondents: CORRESPONDENTS });

    expect(
      within(chipRow("Von")).queryByRole("checkbox", { checked: true }),
    ).toBeNull();
    expect(
      within(chipRow("An")).queryByRole("checkbox", { checked: true }),
    ).toBeNull();
  });

  it("adds a new entry with the chosen Von and An", async () => {
    const props = setup({ correspondents: CORRESPONDENTS });

    await userEvent.click(chip("Von", "UHSt 2"));
    await userEvent.click(chip("An", "EAL"));
    await userEvent.type(newEntryField(), "benötigen RTW");
    await userEvent.click(addButton());

    expect(props.onAdd).toHaveBeenCalledWith({
      text: "benötigen RTW",
      sender: "UHSt 2",
      recipient: "EAL",
      channel: "Funk",
    });
  });

  it("adds without the Von that was tapped again", async () => {
    const props = setup({ correspondents: CORRESPONDENTS });

    await userEvent.click(chip("Von", "UHSt 2"));
    await userEvent.click(chip("Von", "UHSt 2"));
    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.click(addButton());

    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ sender: null }),
    );
  });

  it.each([
    [
      "only Von",
      ["Von"],
      "Funk",
      { sender: "EAL", recipient: null, channel: "Funk" },
    ],
    [
      "only An",
      ["An"],
      "ohne",
      { sender: null, recipient: "EAL", channel: null },
    ],
    [
      "only Weg",
      [],
      "Telefon",
      { sender: null, recipient: null, channel: "Telefon" },
    ],
    [
      "none of them",
      [],
      "ohne",
      { sender: null, recipient: null, channel: null },
    ],
  ] as const)("adds a new entry with %s", async (_, labels, channel, route) => {
    const props = setup({ correspondents: CORRESPONDENTS });

    for (const label of labels) await userEvent.click(chip(label, "EAL"));
    await writeEntry("Deich hält", channel);
    await userEvent.click(addButton());

    expect(props.onAdd).toHaveBeenCalledWith({ text: "Deich hält", ...route });
  });

  it("adds nothing without text, even with Von and An", async () => {
    const props = setup({ correspondents: CORRESPONDENTS });

    await userEvent.click(chip("Von", "UHSt 2"));
    await userEvent.click(chip("An", "EAL"));
    await userEvent.click(addButton());

    expect(props.onAdd).not.toHaveBeenCalled();
    expect(chip("Von", "UHSt 2")).toBeChecked();
  });

  it("unchooses Von and An and keeps the Weg after adding", async () => {
    setup({ correspondents: CORRESPONDENTS });

    await userEvent.click(chip("Von", "UHSt 2"));
    await userEvent.click(chip("An", "EAL"));
    await writeEntry("Deich hält", "Telefon");
    await userEvent.click(addButton());

    expect(chip("Von", "UHSt 2")).not.toBeChecked();
    expect(chip("An", "EAL")).not.toBeChecked();
    expect(channelSelect()).toHaveDisplayValue("Telefon");
  });

  it("keeps Von and An chosen when adding fails", async () => {
    setup({
      correspondents: CORRESPONDENTS,
      onAdd: vi.fn<JournalPanelProps["onAdd"]>(async () => ({
        error: "Der Einsatz ist geschlossen.",
      })),
    });

    await userEvent.click(chip("Von", "UHSt 2"));
    await userEvent.click(chip("An", "EAL"));
    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.click(addButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Der Einsatz ist geschlossen.",
    );
    expect(chip("Von", "UHSt 2")).toBeChecked();
    expect(chip("An", "EAL")).toBeChecked();
  });

  it("adds the entry with Von and An on Strg+Enter in the text field", async () => {
    const props = setup({ correspondents: CORRESPONDENTS });

    await userEvent.click(chip("Von", "UHSt 2"));
    await userEvent.click(chip("An", "EAL"));
    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.type(newEntryField(), "{Control>}{Enter}{/Control}");

    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ sender: "UHSt 2", recipient: "EAL" }),
    );
  });

  it("shows an entry and a correspondent from another device without reloading", () => {
    const props = panelProps({ correspondents: ["EAL"] });
    const { rerender } = render(<JournalPanel {...props} />);

    rerender(
      <JournalPanel
        {...props}
        entries={[
          ...props.entries,
          entry({
            id: "e2",
            number: 2,
            text: "RTW unterwegs",
            sender: "Leitstelle",
            recipient: "EAL",
            channel: "Telefon",
          }),
        ]}
        correspondents={["EAL", "Leitstelle"]}
      />,
    );

    expect(lineAbove("RTW unterwegs")).toBe("Von Leitstelle an EAL · Telefon");
    expect(chipNames("Von")).toEqual(["EAL", "Leitstelle"]);
    expect(chipNames("An")).toEqual(["EAL", "Leitstelle"]);
  });
});
