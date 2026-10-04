import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import { EntryForm } from "./EntryForm";
import { type EntryContent, NO_ROUTE } from "./entry-route";

type EntryFormProps = ComponentProps<typeof EntryForm>;

const CORRESPONDENTS = ["UHSt 2", "EAL", "Leitstelle"];
const NEW_ENTRY: EntryContent = { text: "", ...NO_ROUTE, channel: "Funk" };
const ROUTED = { sender: "UHSt 2", recipient: "EAL", channel: "Funk" };

function formProps(over: Partial<EntryFormProps> = {}): EntryFormProps {
  return {
    label: "Neuer Eintrag",
    initial: NEW_ENTRY,
    correspondents: CORRESPONDENTS,
    lastUsed: { sender: {}, recipient: {} },
    submitLabel: "Eintrag hinzufügen",
    onSubmit: vi.fn(async () => true),
    error: null,
    onDismissError: vi.fn(),
    ...over,
  };
}

function setup(over: Partial<EntryFormProps> = {}) {
  const props = formProps(over);
  const { rerender } = render(<EntryForm {...props} />);
  return {
    props,
    rerender: (more: Partial<EntryFormProps>) =>
      rerender(<EntryForm {...props} {...more} />),
  };
}

/** Wie eine Korrektur: der Eintrag vorbelegt, Von und An vorne. */
const correcting = (initial: Partial<EntryContent> = {}) => ({
  label: "Korrektur",
  initial: { text: "Deich hält", ...ROUTED, ...initial },
  pinned: true,
  submitLabel: "Speichern",
});

const textField = () =>
  screen.getByRole("textbox", { name: /Eintrag|Korrektur/ });
const submitButton = () =>
  screen.getByRole("button", { name: /Eintrag hinzufügen|Speichern/ });
const channelSelect = () => screen.getByRole("combobox", { name: "Weg" });
const channelField = () => screen.getByRole("textbox", { name: "Weg" });
const chipRow = (label: "Von" | "An") =>
  screen.getByRole("group", { name: label });
const chip = (label: "Von" | "An", name: string) =>
  within(chipRow(label)).getByRole("checkbox", { name });
const chipNames = (label: "Von" | "An") =>
  within(chipRow(label))
    .getAllByRole("checkbox")
    .map((c) => (c as HTMLInputElement).labels?.[0]?.textContent);
const chosenChips = (label: "Von" | "An") =>
  within(chipRow(label))
    .queryAllByRole("checkbox", { checked: true })
    .map((c) => (c as HTMLInputElement).labels?.[0]?.textContent);
const otherButton = (label: "Von" | "An") =>
  within(chipRow(label)).getByRole("button", { name: "andere …" });
const otherField = (label: "Von" | "An") =>
  screen.getByRole("combobox", { name: label });

const chipRowScrollable = (label: "Von" | "An") =>
  chipRow(label).querySelector(".entry-route-chips-row") as HTMLElement;
/** jsdom misst kein Layout, merkt sich aber, wohin gescrollt wurde. */
const scrollChipRows = (left: number) => {
  chipRowScrollable("Von").scrollLeft = left;
  chipRowScrollable("An").scrollLeft = left;
};

const STRG_ENTER = "{Control>}{Enter}{/Control}";

/** Von UHSt 2, An EAL, Weg Telefon und der Text. */
async function fillIn(text = "Deich hält") {
  await userEvent.click(chip("Von", "UHSt 2"));
  await userEvent.click(chip("An", "EAL"));
  await userEvent.selectOptions(channelSelect(), "Telefon");
  await userEvent.type(textField(), text);
}

const isBefore = (first: Node, second: Node) =>
  Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

describe("EntryForm", () => {
  it("offers the correspondents as Von and An chips above the text field, none chosen", () => {
    setup();

    for (const label of ["Von", "An"] as const) {
      expect(chipNames(label)).toEqual(["EAL", "Leitstelle", "UHSt 2"]);
      expect(chosenChips(label)).toEqual([]);
      expect(isBefore(chipRow(label), textField())).toBe(true);
    }
    expect(channelSelect()).toHaveDisplayValue("Funk");
  });

  it("submits the text with the chosen Von, An and Weg", async () => {
    const { props } = setup();

    await fillIn("benötigen RTW");
    await userEvent.click(submitButton());

    expect(props.onSubmit).toHaveBeenCalledWith({
      text: "benötigen RTW",
      sender: "UHSt 2",
      recipient: "EAL",
      channel: "Telefon",
    });
  });

  it.each([
    ["only Von", ["Von"], "Funk", { sender: "EAL", channel: "Funk" }],
    ["only An", ["An"], "ohne", { recipient: "EAL", channel: null }],
    ["only Weg", [], "Telefon", { channel: "Telefon" }],
    ["none of them", [], "ohne", { channel: null }],
  ] as const)("submits with %s", async (_, labels, channel, route) => {
    const { props } = setup();

    for (const label of labels) await userEvent.click(chip(label, "EAL"));
    await userEvent.selectOptions(channelSelect(), channel);
    await userEvent.type(textField(), "Deich hält");
    await userEvent.click(submitButton());

    expect(props.onSubmit).toHaveBeenCalledWith({
      text: "Deich hält",
      ...NO_ROUTE,
      ...route,
    });
  });

  it("submits the text without the spaces around it", async () => {
    const { props } = setup();

    await userEvent.type(textField(), "  Deich hält  ");
    await userEvent.click(submitButton());

    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Deich hält" }),
    );
  });

  it.each([
    ["", "no text"],
    ["   ", "only spaces"],
  ])("submits nothing with %j (%s), keeping Von and An", async (text) => {
    const { props } = setup();

    await userEvent.click(chip("Von", "UHSt 2"));
    await userEvent.click(chip("An", "EAL"));
    if (text) await userEvent.type(textField(), text);
    await userEvent.click(submitButton());

    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(chosenChips("Von")).toEqual(["UHSt 2"]);
    expect(chosenChips("An")).toEqual(["EAL"]);
  });

  it("submits a typed Von and An", async () => {
    const { props } = setup();

    await userEvent.click(otherButton("Von"));
    await userEvent.type(otherField("Von"), "Kreis");
    await userEvent.click(otherButton("An"));
    await userEvent.type(otherField("An"), "Bürgermeister");
    await userEvent.type(textField(), "Deich hält");
    await userEvent.click(submitButton());

    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ sender: "Kreis", recipient: "Bürgermeister" }),
    );
  });

  describe("once submitted", () => {
    it("empties text, Von and An, keeps the Weg and scrolls the chip rows back", async () => {
      setup();

      await fillIn();
      scrollChipRows(200);
      await userEvent.click(submitButton());

      expect(textField()).toHaveValue("");
      expect(chosenChips("Von")).toEqual([]);
      expect(chosenChips("An")).toEqual([]);
      expect(channelSelect()).toHaveDisplayValue("Telefon");
      expect(chipRowScrollable("Von").scrollLeft).toBe(0);
      expect(chipRowScrollable("An").scrollLeft).toBe(0);
    });

    it("closes the fields for another Von and An and keeps a typed Weg", async () => {
      setup();

      await userEvent.click(otherButton("Von"));
      await userEvent.type(otherField("Von"), "Kreis");
      await userEvent.click(otherButton("An"));
      await userEvent.type(otherField("An"), "EAL");
      await userEvent.selectOptions(channelSelect(), "Andere …");
      await userEvent.type(channelField(), "Melder");
      await userEvent.type(textField(), "Deich hält");
      await userEvent.click(submitButton());

      expect(screen.queryByRole("combobox", { name: "Von" })).toBeNull();
      expect(screen.queryByRole("combobox", { name: "An" })).toBeNull();
      expect(otherButton("Von")).toBeVisible();
      expect(channelField()).toHaveValue("Melder");
    });
  });

  describe("when saving fails", () => {
    const failing = () => vi.fn(async () => false);

    it("keeps text, Von, An, Weg and where the chip rows are scrolled", async () => {
      setup({ onSubmit: failing() });

      await fillIn();
      scrollChipRows(200);
      await userEvent.click(submitButton());

      expect(textField()).toHaveValue("Deich hält");
      expect(chosenChips("Von")).toEqual(["UHSt 2"]);
      expect(chosenChips("An")).toEqual(["EAL"]);
      expect(channelSelect()).toHaveDisplayValue("Telefon");
      expect(chipRowScrollable("Von").scrollLeft).toBe(200);
      expect(chipRowScrollable("An").scrollLeft).toBe(200);
    });

    it("keeps the fields for another Von open with their input", async () => {
      setup({ onSubmit: failing() });

      await userEvent.click(otherButton("Von"));
      await userEvent.type(otherField("Von"), "Kreis");
      await userEvent.type(textField(), "Deich hält");
      await userEvent.click(submitButton());

      expect(otherField("Von")).toHaveValue("Kreis");
    });
  });

  describe("on Strg+Enter", () => {
    it.each([
      ["the text field", textField],
      ["the Weg", channelSelect],
    ])("submits text, Von, An and Weg in %s", async (_, field) => {
      const { props } = setup();

      await fillIn();
      await userEvent.type(field(), STRG_ENTER);

      expect(props.onSubmit).toHaveBeenCalledWith({
        text: "Deich hält",
        sender: "UHSt 2",
        recipient: "EAL",
        channel: "Telefon",
      });
    });

    it("submits the free-text Weg being typed", async () => {
      const { props } = setup();

      await userEvent.type(textField(), "Deich hält");
      await userEvent.selectOptions(channelSelect(), "Andere …");
      await userEvent.type(channelField(), `Melder${STRG_ENTER}`);

      expect(props.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ channel: "Melder" }),
      );
    });

    it.each([
      ["Von", "An", { sender: "Kreis", recipient: "EAL" }],
      ["An", "Von", { sender: "EAL", recipient: "Kreis" }],
    ] as const)(
      "submits the %s being typed with the chosen %s",
      async (typed, chosen, route) => {
        const { props } = setup();

        await userEvent.click(chip(chosen, "EAL"));
        await userEvent.type(textField(), "Deich hält");
        await userEvent.click(otherButton(typed));
        await userEvent.type(otherField(typed), `Kreis${STRG_ENTER}`);

        expect(props.onSubmit).toHaveBeenCalledWith({
          text: "Deich hält",
          ...route,
          channel: "Funk",
        });
      },
    );

    it("submits the suggestion marked in the field for another Von", async () => {
      const { props } = setup();

      await userEvent.type(textField(), "Deich hält");
      await userEvent.click(otherButton("Von"));
      await userEvent.type(otherField("Von"), `2{ArrowDown}${STRG_ENTER}`);

      expect(props.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ sender: "UHSt 2" }),
      );
    });

    it("submits nothing without text", async () => {
      const { props } = setup();

      await userEvent.type(textField(), STRG_ENTER);

      expect(props.onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("prefilled, as a correction", () => {
    it("shows the text and Von, An and Weg chosen, their chips first", () => {
      setup(correcting({ sender: "Leitstelle", recipient: "UHSt 2" }));

      expect(textField()).toHaveValue("Deich hält");
      expect(chipNames("Von")[0]).toBe("Leitstelle");
      expect(chosenChips("Von")).toEqual(["Leitstelle"]);
      expect(chipNames("An")[0]).toBe("UHSt 2");
      expect(chosenChips("An")).toEqual(["UHSt 2"]);
      expect(channelSelect()).toHaveDisplayValue("Funk");
    });

    it("keeps the unchosen prefilled chip first in its row", async () => {
      setup(correcting({ sender: "Leitstelle" }));

      await userEvent.click(chip("Von", "Leitstelle"));

      expect(chipNames("Von")[0]).toBe("Leitstelle");
      expect(chosenChips("Von")).toEqual([]);
    });

    it("submits a changed Von, An and Weg", async () => {
      const { props } = setup(correcting());

      await userEvent.click(chip("Von", "UHSt 2"));
      await userEvent.click(chip("An", "Leitstelle"));
      await userEvent.selectOptions(channelSelect(), "Persönlich");
      await userEvent.click(submitButton());

      expect(props.onSubmit).toHaveBeenCalledWith({
        text: "Deich hält",
        sender: null,
        recipient: "Leitstelle",
        channel: "Persönlich",
      });
    });

    it("shows a Von in another spelling on its chip, first and chosen, and submits the entry's spelling", async () => {
      const { props } = setup(correcting({ sender: "UHST 2" }));

      expect(chipNames("Von")).toEqual(["UHSt 2", "EAL", "Leitstelle"]);
      expect(chosenChips("Von")).toEqual(["UHSt 2"]);

      await userEvent.click(submitButton());

      expect(props.onSubmit).toHaveBeenCalledWith({
        text: "Deich hält",
        ...ROUTED,
        sender: "UHST 2",
      });
    });

    it("submits the free-text Weg it was opened with, changed, on Strg+Enter", async () => {
      const { props } = setup(correcting({ channel: "Melder" }));

      await userEvent.type(channelField(), ` 3${STRG_ENTER}`);

      expect(props.onSubmit).toHaveBeenCalledWith({
        text: "Deich hält",
        ...ROUTED,
        channel: "Melder 3",
      });
    });

    it("offers Abbrechen", async () => {
      const onCancel = vi.fn();
      setup({ ...correcting(), onCancel });

      await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

      expect(onCancel).toHaveBeenCalled();
    });
  });

  it("offers no Abbrechen without onCancel", () => {
    setup();

    expect(screen.queryByRole("button", { name: "Abbrechen" })).toBeNull();
  });

  describe("the preset Weg", () => {
    it("replaces the Weg it started with, also when it arrives later", () => {
      const { rerender } = setup({ presetChannel: "Telefon" });
      expect(channelSelect()).toHaveDisplayValue("Telefon");

      rerender({ presetChannel: null });

      expect(channelSelect()).toHaveDisplayValue("ohne");
    });

    it("does not replace a Weg chosen before it arrives", async () => {
      const { rerender } = setup();
      await userEvent.selectOptions(channelSelect(), "Persönlich");

      rerender({ presetChannel: "Telefon" });

      expect(channelSelect()).toHaveDisplayValue("Persönlich");
    });
  });

  describe("the error", () => {
    it("shows between the text field and the submit button", () => {
      setup({ error: "Der Einsatz ist geschlossen." });

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Der Einsatz ist geschlossen.");
      expect(isBefore(textField(), alert)).toBe(true);
      expect(isBefore(alert, submitButton())).toBe(true);
    });

    it("is dismissed on its ×", async () => {
      const { props } = setup({ error: "Der Einsatz ist geschlossen." });

      await userEvent.click(
        screen.getByRole("button", { name: "Meldung schließen" }),
      );

      expect(props.onDismissError).toHaveBeenCalled();
    });

    it("shows nothing without one", () => {
      setup();

      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
