import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, Providers, render, screen, within } from "@/test/render";
import { JournalPanel, type JournalPanelProps } from "./JournalPanel";
import {
  chooseAction,
  entry,
  panelProps,
  setup,
} from "./JournalPanel.fixtures";

const newEntryField = () => screen.getByLabelText("Neuer Eintrag");
const newEntry = () =>
  newEntryField().closest(".journal-new-entry") as HTMLElement;
/** Die Weg-Auswahl, oder nach „Andere …" das Freitextfeld. */
const channelField = () =>
  within(newEntry()).queryByRole("combobox", { name: "Weg" }) ??
  within(newEntry()).getByRole("textbox", { name: "Weg" });
const addButton = () =>
  screen.getByRole("button", { name: "Eintrag hinzufügen" });
const chipNames = (label: "Von" | "An", container = newEntry()) =>
  within(within(container).getByRole("group", { name: label }))
    .getAllByRole("checkbox")
    .map((c) => (c as HTMLInputElement).labels?.[0]?.textContent);

/** Das Korrekturformular im Eintrag. */
const correctionForm = () =>
  screen.getByLabelText("Korrektur").closest("[data-entry]") as HTMLElement;

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

  it("puts the Von and An used last first, the others alphabetically", async () => {
    setup({ correspondents: CORRESPONDENTS });

    await add("benötigen RTW", { sender: "UHSt 2", recipient: "EAL" });

    expect(chipNames("Von")).toEqual([
      "UHSt 2",
      "Deichwache",
      "EAL",
      "Leitstelle",
    ]);
    expect(chipNames("An")).toEqual([
      "EAL",
      "Deichwache",
      "Leitstelle",
      "UHSt 2",
    ]);

    await add("RTW unterwegs", { sender: "EAL", recipient: "UHSt 2" });

    expect(chipNames("Von")).toEqual([
      "EAL",
      "UHSt 2",
      "Deichwache",
      "Leitstelle",
    ]);
    expect(chipNames("An")).toEqual([
      "UHSt 2",
      "EAL",
      "Deichwache",
      "Leitstelle",
    ]);
  });

  it("renders on the server alphabetically and with Funk, whatever is remembered", async () => {
    setup({ correspondents: CORRESPONDENTS });
    await userEvent.selectOptions(channelField(), "Telefon");
    await add("benötigen RTW", { sender: "UHSt 2" });
    const server = document.createElement("div");
    server.innerHTML = renderToString(
      <Providers>
        <JournalPanel {...panelProps({ correspondents: CORRESPONDENTS })} />
      </Providers>,
    );

    expect(chipNames("Von", server)).toEqual([
      "Deichwache",
      "EAL",
      "Leitstelle",
      "UHSt 2",
    ]);
    expect(
      within(server).getByRole("combobox", { name: "Weg" }),
    ).toHaveDisplayValue("Funk");
  });

  it("keeps the order after reloading the page", async () => {
    setup({ correspondents: CORRESPONDENTS });
    await add("benötigen RTW", { sender: "UHSt 2", recipient: "EAL" });

    reload();

    expect(chipNames("Von")[0]).toBe("UHSt 2");
    expect(chipNames("An")[0]).toBe("EAL");
  });

  it("puts a value used last first in the spelling it has now", async () => {
    setup({ correspondents: CORRESPONDENTS });
    await add("benötigen RTW", { sender: "UHSt 2" });

    reload({ correspondents: ["EAL", "UHST 2", "Leitstelle"] });

    expect(chipNames("Von")).toEqual(["UHST 2", "EAL", "Leitstelle"]);
  });

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
    await add("benötigen RTW", { sender: "UHSt 2" });
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

  it("presets the free-text Weg of the last new entry after reloading", async () => {
    setup();
    await userEvent.selectOptions(channelField(), "Andere …");
    await userEvent.type(channelField(), "Melder");
    await add("Deich hält");

    reload();

    expect(channelField()).toHaveRole("textbox");
    expect(channelField()).toHaveValue("Melder");
  });

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

  it("keeps its own Weg in each Gesamteinsatz", async () => {
    setup();
    await userEvent.selectOptions(channelField(), "Telefon");
    await add("Deich hält");

    reload({ operationId: "op-2" });

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

  it("orders alphabetically, presets Funk and adds without browser storage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const props = setup({ correspondents: CORRESPONDENTS });

    await userEvent.selectOptions(channelField(), "Telefon");
    await add("benötigen RTW", { sender: "UHSt 2" });

    expect(props.onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ sender: "UHSt 2", channel: "Telefon" }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(newEntryField()).toHaveValue("");
    expect(chipNames("Von")).toEqual([
      "Deichwache",
      "EAL",
      "Leitstelle",
      "UHSt 2",
    ]);
    reload();
    expect(channelField()).toHaveDisplayValue("Funk");
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
