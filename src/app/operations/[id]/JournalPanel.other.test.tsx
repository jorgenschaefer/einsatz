import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@/test/render";
import type { JournalPanelProps } from "./JournalPanel";
import { setup } from "./JournalPanel.fixtures";

const newEntryField = () => screen.getByLabelText("Neuer Eintrag");
const addButton = () =>
  screen.getByRole("button", { name: "Eintrag hinzufügen" });
const chipRow = (label: "Von" | "An") =>
  screen.getByRole("group", { name: label });
const chip = (label: "Von" | "An", name: string) =>
  within(chipRow(label)).getByRole("checkbox", { name });
const otherButton = (label: "Von" | "An") =>
  within(chipRow(label)).getByRole("button", { name: "andere …" });
const backButton = (label: "Von" | "An") =>
  within(chipRow(label)).getByRole("button", { name: "Zurück zur Auswahl" });
const otherField = (label: "Von" | "An") =>
  screen.getByRole("combobox", { name: label });
const suggestions = () =>
  within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .map((option) => option.textContent);

const channelSelect = () => screen.getByRole("combobox", { name: "Weg" });
const channelField = () => screen.getByRole("textbox", { name: "Weg" });

const CORRESPONDENTS = ["UHSt 1", "UHSt 2", "EAL"];

describe("JournalPanel – andere Von und An", () => {
  it("replaces the chips with a field and unchooses the chosen chip", async () => {
    const props = setup({ correspondents: CORRESPONDENTS });

    await userEvent.click(chip("Von", "UHSt 2"));
    await userEvent.click(otherButton("Von"));

    expect(within(chipRow("Von")).queryAllByRole("checkbox")).toEqual([]);
    expect(otherField("Von")).toHaveValue("");
    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.click(addButton());
    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ sender: null }),
    );
  });

  it("suggests nothing before anything is typed", async () => {
    setup({ correspondents: CORRESPONDENTS });

    await userEvent.click(otherButton("Von"));

    expect(otherField("Von")).toHaveFocus();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it.each([
    ["2", ["UHSt 2"]],
    ["uh", ["UHSt 1", "UHSt 2"]],
  ])(
    "suggests the correspondents containing %s in any case",
    async (typed, expected) => {
      setup({ correspondents: CORRESPONDENTS });

      await userEvent.click(otherButton("Von"));
      await userEvent.type(otherField("Von"), typed);

      expect(suggestions()).toEqual(expected);
    },
  );

  it("takes the marked suggestion on Enter, without adding", async () => {
    const props = setup({ correspondents: CORRESPONDENTS });

    await userEvent.click(otherButton("Von"));
    await userEvent.type(otherField("Von"), "2{ArrowDown}{Enter}");

    expect(otherField("Von")).toHaveValue("UHSt 2");
    expect(props.onAdd).not.toHaveBeenCalled();
    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.click(addButton());
    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ sender: "UHSt 2" }),
    );
  });

  it("adds the typed value as An", async () => {
    const props = setup({ correspondents: CORRESPONDENTS });

    await userEvent.click(otherButton("An"));
    await userEvent.type(otherField("An"), "Bürgermeister");
    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.click(addButton());

    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: "Bürgermeister" }),
    );
  });

  it("drops the typed value and brings the chips back on ×", async () => {
    const props = setup({ correspondents: CORRESPONDENTS });

    await userEvent.click(otherButton("Von"));
    await userEvent.type(otherField("Von"), "Neu");
    await userEvent.click(backButton("Von"));

    expect(chip("Von", "EAL")).not.toBeChecked();
    expect(screen.queryByRole("combobox", { name: "Von" })).toBeNull();
    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.click(addButton());
    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ sender: null }),
    );
  });

  it("closes the fields after adding", async () => {
    setup({ correspondents: CORRESPONDENTS });

    await userEvent.click(otherButton("Von"));
    await userEvent.type(otherField("Von"), "Neu");
    await userEvent.click(otherButton("An"));
    await userEvent.type(otherField("An"), "EAL");
    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.click(addButton());

    expect(screen.queryByRole("combobox", { name: "Von" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "An" })).toBeNull();
    expect(otherButton("Von")).toBeVisible();
  });

  it("keeps the fields open with their input when adding fails", async () => {
    setup({
      correspondents: CORRESPONDENTS,
      onAdd: vi.fn<JournalPanelProps["onAdd"]>(async () => ({
        error: "Der Einsatz ist geschlossen.",
      })),
    });

    await userEvent.click(otherButton("Von"));
    await userEvent.type(otherField("Von"), "Neu");
    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.click(addButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Der Einsatz ist geschlossen.",
    );
    expect(otherField("Von")).toHaveValue("Neu");
  });

  it("adds the entry with Von, An and Weg on Strg+Enter in the Von field", async () => {
    const props = setup({ correspondents: CORRESPONDENTS });

    await userEvent.click(chip("An", "EAL"));
    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.click(otherButton("Von"));
    await userEvent.type(otherField("Von"), "Neu{Control>}{Enter}{/Control}");

    expect(props.onAdd).toHaveBeenCalledWith({
      text: "Deich hält",
      sender: "Neu",
      recipient: "EAL",
      channel: "Funk",
    });
  });

  it("adds the marked suggestion on Strg+Enter", async () => {
    const props = setup({ correspondents: CORRESPONDENTS });

    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.click(otherButton("Von"));
    await userEvent.type(
      otherField("Von"),
      "2{ArrowDown}{Control>}{Enter}{/Control}",
    );

    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ sender: "UHSt 2" }),
    );
  });

  it("adds the entry on Strg+Enter in the An field", async () => {
    const props = setup({ correspondents: CORRESPONDENTS });

    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.click(otherButton("An"));
    await userEvent.type(otherField("An"), "Neu{Control>}{Enter}{/Control}");

    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: "Neu" }),
    );
  });
});

describe("JournalPanel – anderer Weg", () => {
  it("adds the typed Weg", async () => {
    const props = setup();

    await userEvent.selectOptions(channelSelect(), "Andere …");
    await userEvent.type(channelField(), "Melder");
    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.click(addButton());

    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "Melder" }),
    );
  });

  it("brings back the Weg chosen before on ×", async () => {
    setup();

    await userEvent.selectOptions(channelSelect(), "Telefon");
    await userEvent.selectOptions(channelSelect(), "Andere …");
    await userEvent.type(channelField(), "Melder");
    await userEvent.click(
      screen.getByRole("button", { name: "Zurück zur Auswahl" }),
    );

    expect(channelSelect()).toHaveDisplayValue("Telefon");
    expect(channelSelect()).toHaveFocus();
  });

  it("keeps the typed Weg after adding", async () => {
    setup();

    await userEvent.selectOptions(channelSelect(), "Andere …");
    await userEvent.type(channelField(), "Melder");
    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.click(addButton());

    expect(newEntryField()).toHaveValue("");
    expect(channelField()).toHaveValue("Melder");
  });

  it("adds the entry with Von, An and Weg on Strg+Enter in the Weg field", async () => {
    const props = setup({ correspondents: CORRESPONDENTS });

    await userEvent.click(chip("Von", "UHSt 2"));
    await userEvent.click(chip("An", "EAL"));
    await userEvent.type(newEntryField(), "Deich hält");
    await userEvent.selectOptions(channelSelect(), "Andere …");
    await userEvent.type(channelField(), "Melder{Control>}{Enter}{/Control}");

    expect(props.onAdd).toHaveBeenCalledWith({
      text: "Deich hält",
      sender: "UHSt 2",
      recipient: "EAL",
      channel: "Melder",
    });
  });
});
