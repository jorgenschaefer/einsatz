import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { EntryChannelSelect } from "./EntryRouteFields";

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
  it("offers Funk, Telefon, Persönlich and ohne", () => {
    render(<ChannelHarness initial="Funk" />);

    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Funk", "Telefon", "Persönlich", "ohne"]);
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
