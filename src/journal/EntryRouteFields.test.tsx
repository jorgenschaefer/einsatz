import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/test/render";
import { EntryChannelSelect, EntryRouteChips } from "./EntryRouteFields";

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
});

/** Hält Von, wie es der Eingabebereich tut, und zeigt es zum Prüfen. */
function ChipsHarness({
  initial = null,
  options,
  pinned,
}: {
  initial?: string | null;
  options: string[];
  pinned?: string;
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
        pinned={pinned}
        otherOpen={otherOpen}
        onOtherOpenChange={setOtherOpen}
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
        otherOpen={false}
        onOtherOpenChange={() => {}}
      />,
    );

    expect(chipNames()).toEqual(["EAL", "ELW 1", "ELW 2"]);
    expect(chip("ELW 1")).toBeChecked();
  });

  it("opens a field for another value in place of the chips", async () => {
    render(<ChipsHarness initial="EAL" options={["EAL", "UHSt 2"]} />);

    await userEvent.click(
      within(chipRow()).getByRole("button", { name: "andere …" }),
    );
    await userEvent.type(
      within(chipRow()).getByRole("combobox", { name: "Von" }),
      "Neu",
    );

    expect(within(chipRow()).queryAllByRole("checkbox")).toEqual([]);
    expect(chosenSender()).toBe('"Neu"');
  });

  it("drops the other value and shows the chips again on ×", async () => {
    render(<ChipsHarness options={["EAL", "UHSt 2"]} />);

    await userEvent.click(
      within(chipRow()).getByRole("button", { name: "andere …" }),
    );
    await userEvent.type(
      within(chipRow()).getByRole("combobox", { name: "Von" }),
      "Neu",
    );
    await userEvent.click(
      within(chipRow()).getByRole("button", { name: "Zurück zur Auswahl" }),
    );

    expect(chipNames()).toEqual(["EAL", "UHSt 2"]);
    expect(chosenSender()).toBe("null");
  });
});
