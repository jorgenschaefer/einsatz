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
import { act, fireEvent, render, screen, within } from "@/test/render";
import { JournalPanel, type JournalPanelProps } from "./JournalPanel";
import { entry, panelProps, setup } from "./JournalPanel.fixtures";

describe("JournalPanel", () => {
  it("shows each entry with its number, text and author", () => {
    setup();
    expect(screen.getByText("Deich hält")).toBeInTheDocument();
    expect(screen.getByText(/anna/)).toBeInTheDocument();
    expect(screen.getByText(/^#?\s*1\b/)).toBeInTheDocument();
  });

  it("marks automatic entries and offers no correct/annul actions for them", () => {
    setup({
      entries: [
        entry({
          id: "a",
          number: 1,
          type: "einsatz-eröffnet",
          text: "Einsatz eröffnet",
          author: null,
        }),
      ],
    });
    const item = screen
      .getByText("Einsatz eröffnet")
      .closest("[data-entry]") as HTMLElement;
    expect(within(item).getByText(/automatisch/i)).toBeInTheDocument();
    expect(
      within(item).queryByRole("button", { name: /Aktionen für Eintrag/ }),
    ).toBeNull();
  });

  it("shows a stelle-angelegt entry as automatic, unchangeable and hidden with the automatic ones", async () => {
    const text = "Stelle angelegt: UHSt 3";
    setup({
      entries: [
        entry({ id: "s", number: 1, type: "stelle-angelegt", text }),
        entry({ id: "m", number: 2 }),
      ],
    });
    const item = screen.getByText(text).closest("[data-entry]") as HTMLElement;

    expect(within(item).getByText(/automatisch/i)).toBeInTheDocument();
    expect(
      within(item).queryByRole("button", { name: /Aktionen für Eintrag/ }),
    ).toBeNull();
    await userEvent.click(screen.getByLabelText(/automatische ausblenden/i));
    expect(screen.queryByText(text)).toBeNull();
    expect(screen.getByText("Deich hält")).toBeInTheDocument();
  });

  it.each([
    ["stelle-umbenannt", "Stelle umbenannt: UHSt 3 → UHSt 3 Nord"],
    [
      "stärkemeldung",
      "Stärkemeldung UHSt 3: 0/1/6//7, +2 zusätzlich, 9 Personen",
    ],
  ] as const)(
    "shows a %s entry as neither automatic nor changeable, and keeps it when automatic ones are hidden",
    async (type, text) => {
      setup({ entries: [entry({ id: "s", number: 1, type, text })] });
      const item = screen
        .getByText(text)
        .closest("[data-entry]") as HTMLElement;

      expect(within(item).queryByText(/automatisch/i)).toBeNull();
      expect(
        within(item).queryByRole("button", { name: /Aktionen für Eintrag/ }),
      ).toBeNull();
      await userEvent.click(screen.getByLabelText(/automatische ausblenden/i));
      expect(screen.getByText(text)).toBeInTheDocument();
    },
  );

  it("offers only „Annullieren …“ for a gesamtstärke-gemeldet entry, which is neither automatic nor hidden", async () => {
    const text =
      "Gesamtstärke gemeldet: 2/6/25//33, +6 zusätzlich, 39 Personen (4 Stellen, älteste Meldung 10:10)";
    const props = setup({
      entries: [
        entry({ id: "g", number: 1, type: "gesamtstärke-gemeldet", text }),
      ],
    });
    const item = screen.getByText(text).closest("[data-entry]") as HTMLElement;
    expect(within(item).queryByText(/automatisch/i)).toBeNull();

    await userEvent.click(
      within(item).getByRole("button", { name: "Aktionen für Eintrag #1" }),
    );
    expect(
      (await screen.findAllByRole("menuitem")).map((i) => i.textContent),
    ).toEqual(["Annullieren …"]);
    await userEvent.click(screen.getByRole("menuitem"));
    await screen.findByRole("dialog", { name: "Eintrag #1 annullieren" });
    await userEvent.click(screen.getByRole("button", { name: "Annullieren" }));
    expect(props.onAnnul).toHaveBeenCalledWith("g");

    await userEvent.click(screen.getByLabelText(/automatische ausblenden/i));
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("offers no actions for an annulled gesamtstärke-gemeldet entry", () => {
    setup({
      entries: [
        entry({
          type: "gesamtstärke-gemeldet",
          state: "annulliert",
          text: "Gesamtstärke gemeldet: 0/0/0//0, +0 zusätzlich, 0 Personen (0 Stellen)",
        }),
      ],
    });

    expect(
      screen.queryByRole("button", { name: /Aktionen für Eintrag/ }),
    ).toBeNull();
  });

  it("adds a new manual entry from the input row", async () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText(/Neuer Eintrag/), {
      target: { value: "Neue Lage" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Eintrag hinzufügen/ }),
    );
    expect(props.onAdd).toHaveBeenCalledWith("Neue Lage");
  });

  it("adds a new manual entry with Strg+Enter in the input field", async () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText(/Neuer Eintrag/), {
      target: { value: "Neue Lage" },
    });
    await userEvent.type(
      screen.getByLabelText(/Neuer Eintrag/),
      "{Control>}{Enter}{/Control}",
    );
    expect(props.onAdd).toHaveBeenCalledWith("Neue Lage");
  });

  it("does not add an empty entry", async () => {
    const props = setup();
    await userEvent.click(
      screen.getByRole("button", { name: /Eintrag hinzufügen/ }),
    );
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it("shows no correct/annul buttons on an entry until its menu is opened", () => {
    setup();
    expect(screen.queryByRole("button", { name: /Korrigieren/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Annullieren/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Aktionen für Eintrag #1" }),
    ).toBeInTheDocument();
  });

  it("renders an annulled entry struck through while keeping its number", () => {
    setup({
      entries: [entry({ number: 4, state: "annulliert", text: "Fehleintrag" })],
    });
    expect(screen.getByText("Fehleintrag").closest("del")).toBeInTheDocument();
    expect(screen.getByText(/^#?\s*4\b/)).toBeInTheDocument();
  });

  it("offers no correct/annul actions on an annulled entry", () => {
    setup({ entries: [entry({ state: "annulliert", text: "Fehleintrag" })] });
    expect(
      screen.queryByRole("button", { name: /Aktionen für Eintrag/ }),
    ).toBeNull();
  });

  it("surfaces a save error and keeps the draft when adding fails", async () => {
    const onAdd = vi
      .fn<JournalPanelProps["onAdd"]>()
      .mockRejectedValue(new Error("boom"));
    setup({ onAdd });
    fireEvent.change(screen.getByLabelText(/Neuer Eintrag/), {
      target: { value: "Neue Lage" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: /Eintrag hinzufügen/ }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText(/Neuer Eintrag/)).toHaveValue("Neue Lage");
  });

  it("hides automatic entries when the filter is enabled, keeping manual ones", async () => {
    setup({
      entries: [
        entry({
          id: "a",
          number: 1,
          type: "einsatz-eröffnet",
          text: "Einsatz eröffnet",
          author: null,
        }),
        entry({
          id: "m",
          number: 2,
          type: "manuell",
          text: "Deich hält",
          author: "anna",
        }),
      ],
    });
    await userEvent.click(screen.getByLabelText(/automatische ausblenden/i));
    expect(screen.queryByText("Einsatz eröffnet")).toBeNull();
    expect(screen.getByText("Deich hält")).toBeInTheDocument();
  });

  it("hands out the Neuer Eintrag field through newEntryRef", () => {
    const newEntryRef = createRef<HTMLTextAreaElement>();
    setup({ newEntryRef });
    expect(newEntryRef.current).toBe(screen.getByLabelText("Neuer Eintrag"));
  });

  // Am Desktop scrollt nur die Liste; das Feld steht fest darunter
  // (situation-workspace.css).
  it("keeps Neuer Eintrag and its button outside the scrolling list", () => {
    setup();
    const list = screen
      .getByText("Deich hält")
      .closest(".journal-entries") as HTMLElement | null;
    expect(list).not.toBeNull();
    expect(list).not.toContainElement(screen.getByLabelText("Neuer Eintrag"));
    expect(list).not.toContainElement(
      screen.getByRole("button", { name: "Eintrag hinzufügen" }),
    );
  });

  describe("scrolling to the latest entry", () => {
    let scrollIntoView: MockInstance<Element["scrollIntoView"]>;
    /** Meldet Beobachtungen des Listenendes, älteste zuerst, in einem Aufruf. */
    let reportEndVisible: (...visible: boolean[]) => void;

    beforeEach(() => {
      scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
      vi.stubGlobal(
        "IntersectionObserver",
        class {
          constructor(callback: IntersectionObserverCallback) {
            reportEndVisible = (...visible) =>
              act(() =>
                callback(
                  visible.map(
                    (isIntersecting) =>
                      ({ isIntersecting }) as IntersectionObserverEntry,
                  ),
                  this as unknown as IntersectionObserver,
                ),
              );
          }
          observe() {}
          disconnect() {}
        },
      );
    });

    afterEach(() => {
      scrollIntoView.mockRestore();
      vi.unstubAllGlobals();
    });

    const withLiveEntry = [
      entry(),
      entry({ id: "e2", number: 2, text: "Pegel steigt", author: "ben" }),
    ];

    it("shows the latest entry when it opens", () => {
      render(<JournalPanel {...panelProps()} />);

      expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
    });

    // Am Handy scrollt das ganze ETB; unter der Liste steht Neuer Eintrag.
    it("brings Neuer Eintrag into view below the latest entry", () => {
      render(<JournalPanel {...panelProps()} />);

      const newEntry = screen
        .getByLabelText("Neuer Eintrag")
        .closest(".journal-new-entry");
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(newEntry);
    });

    it("shows the latest entry once it becomes visible", () => {
      const { rerender } = render(
        <JournalPanel {...panelProps({ visible: false })} />,
      );
      expect(scrollIntoView).not.toHaveBeenCalled();

      rerender(<JournalPanel {...panelProps({ visible: true })} />);

      expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
    });

    it("scrolls to the end after adding an entry, even when scrolled up", async () => {
      render(<JournalPanel {...panelProps()} />);
      reportEndVisible(false);
      scrollIntoView.mockClear();

      await userEvent.type(
        screen.getByLabelText("Neuer Eintrag"),
        "Pegel steigt",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Eintrag hinzufügen" }),
      );

      expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
    });

    it("follows its own entry arriving after the add, before the end is reported in view", async () => {
      const props = panelProps();
      const { rerender } = render(<JournalPanel {...props} />);
      reportEndVisible(false);
      await userEvent.type(
        screen.getByLabelText("Neuer Eintrag"),
        "Pegel steigt",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Eintrag hinzufügen" }),
      );
      scrollIntoView.mockClear();

      rerender(<JournalPanel {...props} entries={withLiveEntry} />);

      expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
    });

    it("follows a live entry while the end of the list is in view", () => {
      const { rerender } = render(<JournalPanel {...panelProps()} />);
      reportEndVisible(true);
      scrollIntoView.mockClear();

      rerender(<JournalPanel {...panelProps({ entries: withLiveEntry })} />);

      expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
    });

    it("goes by the newest of several observations of the end", () => {
      const { rerender } = render(<JournalPanel {...panelProps()} />);
      reportEndVisible(false, true);
      scrollIntoView.mockClear();

      rerender(<JournalPanel {...panelProps({ entries: withLiveEntry })} />);

      expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
    });

    it("stays put for a live entry while scrolled up", () => {
      const { rerender } = render(<JournalPanel {...panelProps()} />);
      reportEndVisible(false);
      scrollIntoView.mockClear();

      rerender(<JournalPanel {...panelProps({ entries: withLiveEntry })} />);

      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });
});
