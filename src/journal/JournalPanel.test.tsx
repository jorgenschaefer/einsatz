import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { buttonColor } from "@/test/button-color";
import { act, cleanup, render, screen, within } from "@/test/render";
import type { JournalEntryType } from "./entry-type";
import { entry } from "./JournalEntry.fixtures";
import { JournalPanel, type JournalPanelProps } from "./JournalPanel";
import {
  addButton,
  chooseAction,
  correctionField,
  correctionForm,
  newEntry,
  newEntryField,
  panelProps,
  setup,
} from "./JournalPanel.fixtures";

const SAVE_ERROR = "Speichern fehlgeschlagen. Bitte erneut versuchen.";
const CORRESPONDENTS = ["UHSt 2", "EAL", "Leitstelle", "Deichwache"];
const ROUTED = { sender: "UHSt 2", recipient: "EAL", channel: "Funk" };

const chipRow = (label: "Von" | "An", form = newEntry()) =>
  within(form).getByRole("group", { name: label });
const chipNames = (label: "Von" | "An", form = newEntry(), checked?: true) =>
  within(chipRow(label, form))
    .queryAllByRole("checkbox", { checked })
    .map((c) => (c as HTMLInputElement).labels?.[0]?.textContent);
const chooseChip = (label: "Von" | "An", name: string, form = newEntry()) =>
  userEvent.click(within(chipRow(label, form)).getByRole("checkbox", { name }));
const channelSelect = (form = newEntry()) =>
  within(form).getByRole("combobox", { name: "Weg" });
const saveButton = () =>
  within(correctionForm()).getByRole("button", { name: "Speichern" });
const dismissButton = () =>
  screen.getByRole("button", { name: "Meldung schließen" });

async function openAnnulment(number: number) {
  await chooseAction(number, "Annullieren …");
  return screen.findByRole("dialog", {
    name: `Eintrag #${number} annullieren`,
  });
}
const annulButton = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: "Annullieren" });

async function add(
  text: string,
  { sender, recipient }: { sender?: string; recipient?: string } = {},
) {
  if (sender) await chooseChip("Von", sender);
  if (recipient) await chooseChip("An", recipient);
  await userEvent.type(newEntryField(), text);
  await userEvent.click(addButton());
}

async function correct(text: string) {
  await chooseAction(1, "Korrigieren");
  await userEvent.clear(correctionField());
  await userEvent.type(correctionField(), text);
  await userEvent.click(saveButton());
}

/** Wie ein Neuladen der Seite: ein neues Panel, der Browser-Speicher bleibt. */
function reload(over: Partial<JournalPanelProps> = {}) {
  cleanup();
  return setup({ correspondents: CORRESPONDENTS, ...over });
}

const failing = () =>
  vi.fn(async () => {
    throw new Error("offline");
  });
const rejecting = (error: string) => vi.fn(async () => ({ error }));

const twoEntries = [
  entry({ id: "e1", number: 1, text: "Deich hält" }),
  entry({ id: "e2", number: 2, text: "Pegel steigt" }),
];

describe("JournalPanel", () => {
  it("adds Neuer Eintrag, starting without Von and An and with Weg Funk, and empties it", async () => {
    const props = setup({ correspondents: CORRESPONDENTS });

    expect(chipNames("Von", newEntry(), true)).toEqual([]);
    expect(chipNames("An", newEntry(), true)).toEqual([]);
    expect(channelSelect()).toHaveDisplayValue("Funk");
    await add("Neue Lage");

    expect(props.onAdd).toHaveBeenCalledWith({
      text: "Neue Lage",
      sender: null,
      recipient: null,
      channel: "Funk",
    });
    expect(newEntryField()).toHaveValue("");
  });

  it("hides the automatic entries when the filter is enabled, keeping the others", async () => {
    const types: JournalEntryType[] = [
      "manuell",
      "einsatz-eröffnet",
      "einsatz-geschlossen",
      "stelle-angelegt",
      "stelle-umbenannt",
      "stärkemeldung",
      "gesamtstärke-gemeldet",
    ];
    setup({
      entries: types.map((type, i) =>
        entry({ id: type, number: i + 1, type, text: type }),
      ),
    });

    const shownTypes = () => types.filter((t) => screen.queryByText(t));
    expect(shownTypes()).toEqual(types);

    await userEvent.click(screen.getByLabelText(/automatische ausblenden/i));

    expect(shownTypes()).toEqual([
      "manuell",
      "stelle-umbenannt",
      "stärkemeldung",
      "gesamtstärke-gemeldet",
    ]);
  });

  it("hands out the Neuer Eintrag field through newEntryRef", () => {
    const newEntryRef = createRef<HTMLTextAreaElement>();
    setup({ newEntryRef });
    expect(newEntryRef.current).toBe(newEntryField());
  });

  // Am Desktop scrollt nur die Liste; das Feld steht fest darunter
  // (situation-workspace.css).
  it("keeps Neuer Eintrag and its button outside the scrolling list", () => {
    setup();
    const list = screen
      .getByText("Deich hält")
      .closest(".journal-entries") as HTMLElement | null;
    expect(list).not.toBeNull();
    expect(list).not.toContainElement(newEntryField());
    expect(list).not.toContainElement(addButton());
  });

  it("shows an entry and a correspondent from another device without reloading", () => {
    const props = panelProps({ correspondents: ["EAL"] });
    const { rerender } = render(<JournalPanel {...props} />);

    rerender(
      <JournalPanel
        {...props}
        entries={[
          ...props.entries,
          entry({ id: "e2", number: 2, text: "RTW unterwegs" }),
        ]}
        correspondents={["EAL", "Leitstelle"]}
      />,
    );

    expect(screen.getByText("RTW unterwegs")).toBeInTheDocument();
    expect(chipNames("Von")).toEqual(["EAL", "Leitstelle"]);
    expect(chipNames("An")).toEqual(["EAL", "Leitstelle"]);
  });

  describe("scrolling", () => {
    let scrollIntoView: MockInstance<Element["scrollIntoView"]>;

    beforeEach(() => {
      scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    });

    afterEach(() => scrollIntoView.mockRestore());

    const listEnd = () =>
      document.querySelector(".journal-entries")?.lastElementChild;

    it("brings the end of the list and Neuer Eintrag into view once it becomes visible", () => {
      const { rerender } = render(
        <JournalPanel {...panelProps({ visible: false })} />,
      );
      expect(scrollIntoView).not.toHaveBeenCalled();

      rerender(<JournalPanel {...panelProps({ visible: true })} />);

      expect(scrollIntoView.mock.contexts).toEqual([listEnd(), newEntry()]);
    });

    it("scrolls to the end after adding an entry, and follows it when it arrives", async () => {
      const props = panelProps();
      const { rerender } = render(<JournalPanel {...props} />);
      scrollIntoView.mockClear();

      await add("Pegel steigt");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
      scrollIntoView.mockClear();

      rerender(
        <JournalPanel
          {...props}
          entries={[...props.entries, entry({ id: "e2", number: 2 })]}
        />,
      );

      expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
    });

    it("brings the error and Eintrag hinzufügen into view when adding fails", async () => {
      setup({ onAdd: failing() });
      await userEvent.type(newEntryField(), "Neue Lage");
      scrollIntoView.mockClear();

      await userEvent.click(addButton());
      await screen.findByRole("alert");

      expect(scrollIntoView.mock.contexts.at(-1)).toBe(newEntry());
      expect(scrollIntoView.mock.calls.at(-1)).toEqual([{ block: "end" }]);
    });
  });
});

describe("JournalPanel – Korrigieren", () => {
  it("corrects an entry in place, prefilled with it, and closes once saved", async () => {
    const props = setup({
      entries: [entry(ROUTED)],
      correspondents: CORRESPONDENTS,
    });
    await chooseAction(1, "Korrigieren");

    expect(correctionField()).toHaveValue("Deich hält");
    expect(chipNames("Von", correctionForm(), true)).toEqual(["UHSt 2"]);
    expect(chipNames("An", correctionForm(), true)).toEqual(["EAL"]);
    expect(props.onCorrect).not.toHaveBeenCalled();

    await userEvent.clear(correctionField());
    await userEvent.type(correctionField(), "Deich hält nicht");
    await userEvent.selectOptions(channelSelect(correctionForm()), "Telefon");
    await userEvent.click(saveButton());

    expect(props.onCorrect).toHaveBeenCalledWith("e1", {
      text: "Deich hält nicht",
      ...ROUTED,
      channel: "Telefon",
    });
    expect(screen.queryByLabelText("Korrektur")).toBeNull();
  });

  it("orders the chips of a correction like Neuer Eintrag, its own Von first", async () => {
    setup({ correspondents: CORRESPONDENTS });
    await add("benötigen RTW", { sender: "UHSt 2" });

    reload({ entries: [entry({ sender: "Leitstelle", recipient: null })] });
    await chooseAction(1, "Korrigieren");

    expect(chipNames("Von", correctionForm())).toEqual([
      "Leitstelle",
      "UHSt 2",
      "Deichwache",
      "EAL",
    ]);
  });
});

describe("JournalPanel – Annullieren", () => {
  it("asks for confirmation before annulling and annuls only once confirmed", async () => {
    const props = setup();
    const dialog = await openAnnulment(1);
    expect(props.onAnnul).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/nicht rückgängig/)).toBeInTheDocument();
    const annullieren = annulButton(dialog);
    expect(buttonColor(annullieren)).toBe("red");
    await userEvent.click(annullieren);
    expect(props.onAnnul).toHaveBeenCalledWith("e1");
  });

  it("keeps the entry valid when the confirmation is cancelled", async () => {
    const props = setup();
    await openAnnulment(1);
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(props.onAnnul).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("annuls the entry whose menu was used, also one after another", async () => {
    const props = setup({ entries: twoEntries });
    await userEvent.click(annulButton(await openAnnulment(2)));
    await userEvent.click(annulButton(await openAnnulment(1)));
    expect(vi.mocked(props.onAnnul).mock.calls).toEqual([["e2"], ["e1"]]);
  });

  it("shows the reason in the still open confirmation when annulling is rejected", async () => {
    setup({ onAnnul: rejecting("Eintrag nicht gefunden.") });
    const dialog = await openAnnulment(1);
    await userEvent.click(annulButton(dialog));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Eintrag nicht gefunden.",
    );
  });
});

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

  it("does not count a correction as a use", async () => {
    const props = setup({
      correspondents: CORRESPONDENTS,
      entries: [entry({ sender: "EAL", channel: "Funk" })],
    });
    await add("benötigen RTW", { sender: "UHSt 2", recipient: "EAL" });
    await chooseAction(1, "Korrigieren");

    await chooseChip("Von", "Leitstelle", correctionForm());
    await userEvent.selectOptions(
      channelSelect(correctionForm()),
      "Persönlich",
    );
    await userEvent.click(saveButton());
    expect(props.onCorrect).toHaveBeenCalled();

    reload();

    expect(chipNames("Von")[0]).toBe("UHSt 2");
    expect(chipNames("An")[0]).toBe("EAL");
    expect(channelSelect()).toHaveDisplayValue("Funk");
  });

  it("opens a correction with the entry's own Weg, not the remembered one", async () => {
    setup({ entries: [entry({ channel: "Funk" })] });
    await userEvent.selectOptions(channelSelect(), "Telefon");
    await add("Pegel steigt");

    await chooseAction(1, "Korrigieren");

    expect(channelSelect(correctionForm())).toHaveDisplayValue("Funk");
  });

  it.each(["Telefon", "ohne"])(
    "presets the Weg %s of the last new entry after reloading",
    async (option) => {
      setup();
      await userEvent.selectOptions(channelSelect(), option);
      await add("Deich hält");

      reload();

      expect(channelSelect()).toHaveDisplayValue(option);
    },
  );

  it("changes neither order nor remembered Weg when adding fails", async () => {
    setup({
      correspondents: CORRESPONDENTS,
      onAdd: rejecting("Der Einsatz ist geschlossen."),
    });

    await userEvent.selectOptions(channelSelect(), "Telefon");
    await add("benötigen RTW", { sender: "UHSt 2" });
    await screen.findByRole("alert");

    expect(chipNames("Von")[0]).toBe("Deichwache");
    reload();
    expect(chipNames("Von")[0]).toBe("Deichwache");
    expect(channelSelect()).toHaveDisplayValue("Funk");
  });
});

describe("JournalPanel – Meldung, wenn das Speichern scheitert", () => {
  const failures = [
    ["a thrown failure as Speichern fehlgeschlagen", failing, SAVE_ERROR],
    [
      "a returned error word for word",
      () => rejecting("Der Einsatz ist geschlossen."),
      "Der Einsatz ist geschlossen.",
    ],
  ] as const;

  describe("in Neuer Eintrag", () => {
    it.each(failures)(
      "shows %s there alone, keeping the input",
      async (_, onAdd, message) => {
        setup({ onAdd: onAdd() });

        await chooseAction(1, "Korrigieren");
        await add("Neue Lage");

        const alert = await screen.findByRole("alert");
        expect(screen.getAllByRole("alert")).toHaveLength(1);
        expect(alert).toHaveTextContent(message);
        expect(newEntry()).toContainElement(alert);
        expect(newEntryField()).toHaveValue("Neue Lage");
      },
    );

    it.each([
      ["after the next successful save", () => userEvent.click(addButton())],
      ["on its ×", () => userEvent.click(dismissButton())],
    ])("drops the error %s", async (_, drop) => {
      setup({
        onAdd: vi
          .fn<JournalPanelProps["onAdd"]>()
          .mockRejectedValueOnce(new Error("offline"))
          .mockResolvedValue({}),
      });

      await add("Neue Lage");
      await screen.findByRole("alert");
      await drop();

      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("in a correction", () => {
    it.each(failures)(
      "shows %s inside the corrected entry alone, keeping both inputs",
      async (_, onCorrect, message) => {
        setup({ onCorrect: onCorrect() });

        await userEvent.type(newEntryField(), "Entwurf");
        await correct("Neuer Text");

        const alert = await screen.findByRole("alert");
        expect(screen.getAllByRole("alert")).toHaveLength(1);
        expect(alert).toHaveTextContent(message);
        expect(correctionForm()).toContainElement(alert);
        expect(correctionField()).toHaveValue("Neuer Text");
        expect(newEntryField()).toHaveValue("Entwurf");
      },
    );

    it.each([
      [
        "on Abbrechen",
        async () => {
          await userEvent.click(
            within(correctionForm()).getByRole("button", { name: "Abbrechen" }),
          );
          await chooseAction(1, "Korrigieren");
        },
      ],
      ["on its ×", () => userEvent.click(dismissButton())],
    ])("drops the error %s", async (_, drop) => {
      setup({ onCorrect: failing() });

      await correct("Neuer Text");
      await screen.findByRole("alert");
      await drop();

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it.each([
      ["fails", false],
      ["succeeds", true],
    ])(
      "leaves another correction opened meanwhile alone when the save %s",
      async (_, succeeds) => {
        const save = Promise.withResolvers<object>();
        setup({ entries: twoEntries, onCorrect: vi.fn(() => save.promise) });

        await correct("Neuer Text");
        await chooseAction(2, "Korrigieren");
        await act(async () =>
          succeeds ? save.resolve({}) : save.reject(new Error("offline")),
        );

        expect(correctionField()).toHaveValue("Pegel steigt");
        expect(screen.queryByRole("alert")).toBeNull();
      },
    );
  });
});
