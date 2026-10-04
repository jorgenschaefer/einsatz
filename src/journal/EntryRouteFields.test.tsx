import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/test/render";
import { EntryChannelSelect, EntryRouteChips } from "./EntryRouteFields";
import type { LastUsed } from "./entry-route";

/** Hält den Weg, wie es der Eingabebereich tut, und zeigt ihn zum Prüfen. */
function ChannelHarness({ initial }: { initial: string | null }) {
  const [channel, setChannel] = useState(initial);
  return (
    <>
      <EntryChannelSelect value={channel} onChange={setChannel} />
      <output>{JSON.stringify(channel)}</output>
    </>
  );
}

const channelSelect = () => screen.getByRole("combobox", { name: "Weg" });
const channelField = () => screen.getByRole("textbox", { name: "Weg" });
const backToChoice = () =>
  screen.getByRole("button", { name: "Zurück zur Auswahl" });
const chosenChannel = () => screen.getByRole("status").textContent;

describe("EntryChannelSelect", () => {
  it("offers Funk, Telefon, Persönlich, Andere … and ohne", () => {
    render(<ChannelHarness initial="Funk" />);

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Funk", "Telefon", "Persönlich", "Andere …", "ohne"]);
  });

  it("shows the current Weg", () => {
    render(<ChannelHarness initial="Persönlich" />);

    expect(channelSelect()).toHaveDisplayValue("Persönlich");
  });

  it("shows ohne for no Weg", () => {
    render(<ChannelHarness initial={null} />);

    expect(channelSelect()).toHaveDisplayValue("ohne");
  });

  it("gives the chosen Weg", async () => {
    render(<ChannelHarness initial="Funk" />);

    await userEvent.selectOptions(channelSelect(), "Telefon");

    expect(chosenChannel()).toBe('"Telefon"');
  });

  it("gives no Weg for ohne", async () => {
    render(<ChannelHarness initial="Funk" />);

    await userEvent.selectOptions(channelSelect(), "ohne");

    expect(chosenChannel()).toBe("null");
  });

  it("shows a Weg it does not offer in the text field, leaving the focus alone", () => {
    render(<ChannelHarness initial="Melder" />);

    expect(channelField()).toHaveValue("Melder");
    expect(channelField()).not.toHaveFocus();
  });

  it("keeps the text field for a Weg given later once it is emptied", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <EntryChannelSelect value="Funk" onChange={onChange} />,
    );
    rerender(<EntryChannelSelect value="Melder" onChange={onChange} />);

    await userEvent.clear(channelField());
    expect(onChange).toHaveBeenLastCalledWith(null);
    rerender(<EntryChannelSelect value={null} onChange={onChange} />);

    expect(channelField()).toHaveValue("");
  });

  it("goes back from a Weg it does not offer to the choice with Funk on ×", async () => {
    render(<ChannelHarness initial="Melder" />);

    await userEvent.click(backToChoice());

    expect(channelSelect()).toHaveDisplayValue("Funk");
    expect(chosenChannel()).toBe('"Funk"');
  });

  it("opens an empty text field with the focus on Andere …", async () => {
    render(<ChannelHarness initial="Funk" />);

    await userEvent.selectOptions(channelSelect(), "Andere …");

    expect(channelField()).toHaveValue("");
    expect(channelField()).toHaveFocus();
    expect(chosenChannel()).toBe("null");
    await userEvent.type(channelField(), "Melder");
    expect(chosenChannel()).toBe('"Melder"');
  });

  it("brings back the Weg chosen before Andere … on ×, with the focus", async () => {
    render(<ChannelHarness initial="Funk" />);

    await userEvent.selectOptions(channelSelect(), "Telefon");
    await userEvent.selectOptions(channelSelect(), "Andere …");
    await userEvent.type(channelField(), "Melder");
    await userEvent.click(backToChoice());

    expect(channelSelect()).toHaveDisplayValue("Telefon");
    expect(channelSelect()).toHaveFocus();
    expect(chosenChannel()).toBe('"Telefon"');
  });

  it("turns into the text field once given a Weg it does not offer", () => {
    const { rerender } = render(
      <EntryChannelSelect value="Funk" onChange={() => {}} />,
    );

    rerender(<EntryChannelSelect value="Melder" onChange={() => {}} />);

    expect(channelField()).toHaveValue("Melder");
  });

  it("goes back to the Weg it had before on × at a Weg given later", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <EntryChannelSelect value="Telefon" onChange={onChange} />,
    );
    rerender(<EntryChannelSelect value="Melder" onChange={onChange} />);

    await userEvent.click(backToChoice());

    expect(onChange).toHaveBeenCalledWith("Telefon");
  });
});

/** Hält Von, wie es der Eingabebereich tut, und zeigt es zum Prüfen. */
function ChipsHarness({
  initial = null,
  options,
  lastUsed = {},
  pinned,
  onSubmit,
}: {
  initial?: string | null;
  options: string[];
  lastUsed?: LastUsed;
  pinned?: string;
  onSubmit?: (value: string | null) => void;
}) {
  const [sender, setSender] = useState(initial);
  const [otherOpen, setOtherOpen] = useState(false);
  return (
    <>
      <EntryRouteChips
        label="Von"
        value={sender}
        onChange={setSender}
        options={options}
        lastUsed={lastUsed}
        pinned={pinned}
        otherOpen={otherOpen}
        onOtherOpenChange={setOtherOpen}
        onSubmit={onSubmit}
      />
      <output>{JSON.stringify(sender)}</output>
    </>
  );
}

const chipRow = () => screen.getByRole("group", { name: "Von" });
const chip = (name: string) =>
  within(chipRow()).getByRole("checkbox", { name });
const chipNames = () =>
  within(chipRow())
    .getAllByRole("checkbox")
    .map((c) => (c as HTMLInputElement).labels?.[0]?.textContent);
const chosenSender = () => screen.getByRole("status").textContent;
const otherButton = () =>
  within(chipRow()).getByRole("button", { name: "andere …" });
const otherField = () =>
  within(chipRow()).getByRole("combobox", { name: "Von" });
const suggestions = () =>
  within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .map((option) => option.textContent);

const CORRESPONDENTS = ["UHSt 1", "UHSt 2", "EAL"];

describe("EntryRouteChips", () => {
  it("offers the values alphabetically as chips", () => {
    render(
      <ChipsHarness
        options={["UHSt 2", "EAL", "Ärztlicher Leiter", "bürgermeister"]}
      />,
    );

    expect(chipNames()).toEqual([
      "Ärztlicher Leiter",
      "bürgermeister",
      "EAL",
      "UHSt 2",
    ]);
  });

  it("shows the chosen value as the only chosen chip", () => {
    render(<ChipsHarness initial="EAL" options={["EAL", "UHSt 2"]} />);

    expect(chip("EAL")).toBeChecked();
    expect(chip("UHSt 2")).not.toBeChecked();
  });

  it("chooses a value on a tap", async () => {
    render(<ChipsHarness options={["EAL", "UHSt 2"]} />);

    await userEvent.click(chip("EAL"));

    expect(chosenSender()).toBe('"EAL"');
  });

  it("unchooses the value on a second tap", async () => {
    render(<ChipsHarness options={["EAL", "UHSt 2"]} />);

    await userEvent.click(chip("EAL"));
    await userEvent.click(chip("EAL"));

    expect(chosenSender()).toBe("null");
  });

  it("switches to another value on a tap on it", async () => {
    render(<ChipsHarness options={["EAL", "UHSt 2"]} />);

    await userEvent.click(chip("EAL"));
    await userEvent.click(chip("UHSt 2"));

    expect(chosenSender()).toBe('"UHSt 2"');
    expect(chip("EAL")).not.toBeChecked();
  });

  it("puts the values used last first, the others alphabetically", () => {
    render(
      <ChipsHarness
        options={["UHSt 2", "EAL", "Leitstelle", "Deichwache"]}
        lastUsed={{ eal: 1, "uhst 2": 2 }}
      />,
    );

    expect(chipNames()).toEqual(["UHSt 2", "EAL", "Deichwache", "Leitstelle"]);
  });

  it("puts the pinned value before the one used last", () => {
    render(
      <ChipsHarness
        options={["EAL", "UHSt 2", "Leitstelle"]}
        lastUsed={{ eal: 1 }}
        pinned="UHSt 2"
      />,
    );

    expect(chipNames()).toEqual(["UHSt 2", "EAL", "Leitstelle"]);
  });

  it("puts the pinned value first", () => {
    render(<ChipsHarness options={["EAL", "UHSt 2"]} pinned="UHSt 2" />);

    expect(chipNames()).toEqual(["UHSt 2", "EAL"]);
  });

  it("keeps the pinned value as a chip once unchosen, though it is not among the values", async () => {
    render(<ChipsHarness initial="ELW 1" options={["EAL"]} pinned="ELW 1" />);

    await userEvent.click(chip("ELW 1"));

    expect(chosenSender()).toBe("null");
    expect(chipNames()).toEqual(["ELW 1", "EAL"]);
  });

  it("puts the pinned value in another spelling first and chosen, on the chip of the values", () => {
    render(
      <ChipsHarness
        initial="UHST 2"
        options={["EAL", "UHSt 2", "Leitstelle"]}
        pinned="UHST 2"
      />,
    );

    expect(chipNames()).toEqual(["UHSt 2", "EAL", "Leitstelle"]);
    expect(chip("UHSt 2")).toBeChecked();
  });

  it("unchooses a value in another spelling on a tap on its chip", async () => {
    render(<ChipsHarness initial="UHST 2" options={["EAL", "UHSt 2"]} />);

    await userEvent.click(chip("UHSt 2"));

    expect(chosenSender()).toBe("null");
  });

  it("keeps showing the chosen value once it has left the values", async () => {
    const { rerender } = render(
      <EntryRouteChips
        label="Von"
        value="ELW 1"
        onChange={() => {}}
        options={["EAL", "ELW 1"]}
        lastUsed={{}}
        otherOpen={false}
        onOtherOpenChange={() => {}}
      />,
    );

    rerender(
      <EntryRouteChips
        label="Von"
        value="ELW 1"
        onChange={() => {}}
        options={["EAL", "ELW 2"]}
        lastUsed={{}}
        otherOpen={false}
        onOtherOpenChange={() => {}}
      />,
    );

    expect(chipNames()).toEqual(["EAL", "ELW 1", "ELW 2"]);
    expect(chip("ELW 1")).toBeChecked();
  });

  it("opens an empty field for another value in place of the chips, unchoosing the chosen one", async () => {
    render(<ChipsHarness initial="EAL" options={["EAL", "UHSt 2"]} />);

    await userEvent.click(otherButton());

    expect(within(chipRow()).queryAllByRole("checkbox")).toEqual([]);
    expect(otherField()).toHaveValue("");
    expect(otherField()).toHaveFocus();
    expect(chosenSender()).toBe("null");
    await userEvent.type(otherField(), "Neu");
    expect(chosenSender()).toBe('"Neu"');
  });

  it("suggests nothing before anything is typed", async () => {
    render(<ChipsHarness options={CORRESPONDENTS} />);

    await userEvent.click(otherButton());

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it.each([
    ["2", ["UHSt 2"]],
    ["uh", ["UHSt 1", "UHSt 2"]],
  ])(
    "suggests the values containing %s in any case",
    async (typed, expected) => {
      render(<ChipsHarness options={CORRESPONDENTS} />);

      await userEvent.click(otherButton());
      await userEvent.type(otherField(), typed);

      expect(suggestions()).toEqual(expected);
    },
  );

  it("takes the marked suggestion on Enter, without submitting", async () => {
    const onSubmit = vi.fn();
    render(<ChipsHarness options={CORRESPONDENTS} onSubmit={onSubmit} />);

    await userEvent.click(otherButton());
    await userEvent.type(otherField(), "2{ArrowDown}{Enter}");

    expect(otherField()).toHaveValue("UHSt 2");
    expect(chosenSender()).toBe('"UHSt 2"');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    ["the typed value", "Neu", "Neu"],
    ["the marked suggestion", "2{ArrowDown}", "UHSt 2"],
  ])("submits %s on Strg+Enter", async (_, typed, submitted) => {
    const onSubmit = vi.fn();
    render(<ChipsHarness options={CORRESPONDENTS} onSubmit={onSubmit} />);

    await userEvent.click(otherButton());
    await userEvent.type(otherField(), `${typed}{Control>}{Enter}{/Control}`);

    expect(onSubmit).toHaveBeenCalledWith(submitted);
  });

  it("drops the other value and shows the chips again on ×", async () => {
    render(<ChipsHarness options={["EAL", "UHSt 2"]} />);

    await userEvent.click(otherButton());
    await userEvent.type(otherField(), "Neu");
    await userEvent.click(
      within(chipRow()).getByRole("button", { name: "Zurück zur Auswahl" }),
    );

    expect(chipNames()).toEqual(["EAL", "UHSt 2"]);
    expect(chosenSender()).toBe("null");
  });
});
