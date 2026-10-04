import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@/test/render";
import { JournalPanel, type JournalPanelProps } from "./JournalPanel";
import {
  addButton,
  chooseAction,
  correctionForm,
  entry,
  newEntry,
  newEntryField,
  panelProps,
  setup,
} from "./JournalPanel.fixtures";

/** Die Weg-Auswahl, oder nach „Andere …" das Freitextfeld. */
const channelField = () =>
  within(newEntry()).queryByRole("combobox", { name: "Weg" }) ??
  within(newEntry()).getByRole("textbox", { name: "Weg" });
const chipNames = (label: "Von" | "An", container = newEntry()) =>
  within(within(container).getByRole("group", { name: label }))
    .getAllByRole("checkbox")
    .map((c) => (c as HTMLInputElement).labels?.[0]?.textContent);

const CORRESPONDENTS = ["UHSt 2", "EAL", "Leitstelle", "Deichwache"];

async function add(
  text: string,
  { sender, recipient }: { sender?: string; recipient?: string } = {},
) {
  const chip = (label: "Von" | "An", name: string) =>
    within(within(newEntry()).getByRole("group", { name: label })).getByRole(
      "checkbox",
      { name },
    );
  if (sender) await userEvent.click(chip("Von", sender));
  if (recipient) await userEvent.click(chip("An", recipient));
  await userEvent.type(newEntryField(), text);
  await userEvent.click(addButton());
}

/** Wie ein Neuladen der Seite: ein neues Panel, der Browser-Speicher bleibt. */
function reload(over: Partial<JournalPanelProps> = {}) {
  cleanup();
  return setup({ correspondents: CORRESPONDENTS, ...over });
}

describe("JournalPanel – Reihenfolge und Weg je Gerät", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps its own order in each Gesamteinsatz", async () => {
    setup({ correspondents: CORRESPONDENTS });
    await add("benötigen RTW", { sender: "UHSt 2" });

    reload({ operationId: "op-2" });

    expect(chipNames("Von")).toEqual([
      "Deichwache",
      "EAL",
      "Leitstelle",
      "UHSt 2",
    ]);
  });

  it("orders the chips of a correction the same way, its own Von first", async () => {
    setup({ correspondents: CORRESPONDENTS });
    await add("benötigen RTW", { sender: "UHSt 2" });

    reload({
      entries: [entry({ sender: "Leitstelle", recipient: null })],
    });
    await chooseAction(1, "Korrigieren");

    expect(chipNames("Von", correctionForm())).toEqual([
      "Leitstelle",
      "UHSt 2",
      "Deichwache",
      "EAL",
    ]);
  });

  it("does not count a correction as a use", async () => {
    const props = setup({
      correspondents: CORRESPONDENTS,
      entries: [entry({ sender: "EAL", channel: "Funk" })],
    });
    await add("benötigen RTW", { sender: "UHSt 2", recipient: "EAL" });
    await chooseAction(1, "Korrigieren");

    await userEvent.click(
      within(
        within(correctionForm()).getByRole("group", { name: "Von" }),
      ).getByRole("checkbox", { name: "Leitstelle" }),
    );
    await userEvent.selectOptions(
      within(correctionForm()).getByRole("combobox", { name: "Weg" }),
      "Persönlich",
    );
    await userEvent.click(
      within(correctionForm()).getByRole("button", { name: "Speichern" }),
    );
    expect(props.onCorrect).toHaveBeenCalled();

    reload();

    expect(chipNames("Von")[0]).toBe("UHSt 2");
    expect(chipNames("An")[0]).toBe("EAL");
    expect(channelField()).toHaveDisplayValue("Funk");
  });

  it("presets Funk on a device that remembers no Weg", () => {
    setup();

    expect(channelField()).toHaveDisplayValue("Funk");
  });

  it.each([
    ["Telefon", "Telefon"],
    ["ohne", "ohne"],
  ])(
    "presets the Weg %s of the last new entry after reloading",
    async (option, shown) => {
      setup();
      await userEvent.selectOptions(channelField(), option);
      await add("Deich hält");

      reload();

      expect(channelField()).toHaveDisplayValue(shown);
    },
  );

  it("keeps the field for a remembered free-text Weg when it is emptied", async () => {
    setup();
    await userEvent.selectOptions(channelField(), "Andere …");
    await userEvent.type(channelField(), "Melder");
    await add("Deich hält");
    reload();

    await userEvent.clear(channelField());
    await userEvent.type(channelField(), "Kurier");

    expect(channelField()).toHaveRole("textbox");
    expect(channelField()).toHaveValue("Kurier");
  });

  it("goes back to Funk on × at a remembered free-text Weg", async () => {
    setup();
    await userEvent.selectOptions(channelField(), "Andere …");
    await userEvent.type(channelField(), "Melder");
    await add("Deich hält");
    reload();

    await userEvent.click(
      within(newEntry()).getByRole("button", { name: "Zurück zur Auswahl" }),
    );

    expect(channelField()).toHaveDisplayValue("Funk");
  });

  it("keeps a Weg chosen before the remembered one arrives", async () => {
    const props = panelProps();
    const { rerender } = render(<JournalPanel {...props} />);
    await userEvent.selectOptions(channelField(), "Persönlich");
    localStorage.setItem(
      "einsatz:entryRoute:op-2",
      JSON.stringify({
        sender: { zentrale: 1 },
        recipient: {},
        channel: "Telefon",
      }),
    );

    rerender(
      <JournalPanel
        {...props}
        operationId="op-2"
        correspondents={["Leitstelle", "Zentrale", "EAL"]}
      />,
    );

    expect(channelField()).toHaveDisplayValue("Persönlich");
    expect(chipNames("Von")).toEqual(["Zentrale", "EAL", "Leitstelle"]);
  });

  it("changes neither order nor remembered Weg when adding fails", async () => {
    setup({
      correspondents: CORRESPONDENTS,
      onAdd: vi.fn<JournalPanelProps["onAdd"]>(async () => ({
        error: "Der Einsatz ist geschlossen.",
      })),
    });

    await userEvent.selectOptions(channelField(), "Telefon");
    await add("benötigen RTW", { sender: "UHSt 2" });
    await screen.findByRole("alert");

    expect(chipNames("Von")[0]).toBe("Deichwache");
    reload();
    expect(chipNames("Von")[0]).toBe("Deichwache");
    expect(channelField()).toHaveDisplayValue("Funk");
  });
});
