import { afterEach, describe, expect, it, vi } from "vitest";
import type { JournalEntryView } from "@/journal/JournalEntry";
import { entry } from "@/journal/JournalEntry.fixtures";
import { stubMatchMedia } from "@/test/match-media";
import { act, renderHook } from "@/test/render";
import { stubVisualViewport } from "@/test/visual-viewport";
import { useMainView } from "./useMainView";

afterEach(() => {
  vi.unstubAllGlobals();
});

const journalEntry = (number: number, author: string | null) =>
  entry({ id: `e${number}`, number, author });

/** Rendert den Hook als angemeldete „anna" am Handy oder am Desktop. */
function renderMainView(
  desktop: boolean,
  journalEntries: JournalEntryView[] = [journalEntry(1, null)],
) {
  const width = stubMatchMedia(desktop);
  const hook = renderHook(
    ({ entries }) =>
      useMainView({ journalEntries: entries, currentUsername: "anna" }),
    { initialProps: { entries: journalEntries } },
  );
  return {
    ...hook,
    view: () => hook.result.current,
    select: (view: "etb" | "map" | "strength") =>
      act(() => hook.result.current.selectMainView(view)),
    selectPanel: (panel: "symbols" | "areas" | "layers") =>
      act(() => hook.result.current.selectMapPanel(panel)),
    receive: (...entries: JournalEntryView[]) => hook.rerender({ entries }),
    crossTo: (desktop: boolean) => act(() => width.fireChange(desktop)),
  };
}

describe("useMainView", () => {
  describe.each([
    ["on a phone", false],
    ["on the desktop", true],
  ])("counting new ETB entries %s", (_, desktop) => {
    it.each(["map", "strength"] as const)(
      "counts entries from others, not own ones, arriving under %s",
      (view) => {
        const mainView = renderMainView(desktop);
        mainView.select(view);

        mainView.receive(
          journalEntry(1, null),
          journalEntry(2, "ben"),
          journalEntry(3, "anna"),
          journalEntry(4, null),
        );

        expect(mainView.view().newEtbEntries).toBe(2);
      },
    );

    it.each([
      ["map", "strength"],
      ["strength", "map"],
    ] as const)("keeps the count when switching from %s to %s", (from, to) => {
      const mainView = renderMainView(desktop);
      mainView.select(from);
      mainView.receive(journalEntry(1, null), journalEntry(2, "ben"));

      mainView.select(to);

      expect(mainView.view().newEtbEntries).toBe(1);
    });

    it("resets when switching to the ETB, and counts from there", () => {
      const mainView = renderMainView(desktop);
      mainView.select("map");
      mainView.receive(journalEntry(1, null), journalEntry(2, "ben"));

      mainView.select("etb");
      expect(mainView.view().newEtbEntries).toBe(0);
      mainView.select("map");
      expect(mainView.view().newEtbEntries).toBe(0);
    });

    it("treats entries arriving while the ETB is shown as seen", () => {
      const mainView = renderMainView(desktop);
      mainView.receive(journalEntry(1, null), journalEntry(2, "ben"));
      expect(mainView.view().newEtbEntries).toBe(0);

      mainView.select("map");

      expect(mainView.view().newEtbEntries).toBe(0);
    });
  });

  describe("which main view shows the map", () => {
    it.each([
      ["hidden", "a phone", "etb", false],
      ["hidden", "a phone", "strength", false],
      ["shown", "a phone", "map", false],
      ["shown", "the desktop", "etb", true],
      ["shown", "the desktop", "strength", true],
      ["shown", "the desktop", "map", true],
    ] as const)("is %s on %s under %s", (state, _, view, desktop) => {
      const mainView = renderMainView(desktop);
      mainView.select(view);
      expect(mainView.view().mapShown).toBe(state === "shown");
    });

    it("stays shown on a phone when Lagekarte is chosen again", () => {
      const mainView = renderMainView(false);
      mainView.select("map");

      mainView.select("map");

      expect(mainView.view().mapShown).toBe(true);
    });

    it("starts on the ETB", () => {
      expect(renderMainView(false).view().mainView).toBe("etb");
      expect(renderMainView(true).view().mainView).toBe("etb");
    });

    it("keeps the main view and shows the map only under Lagekarte on a phone when the width crosses 768 px", () => {
      const mainView = renderMainView(true);
      mainView.select("strength");

      mainView.crossTo(false);
      expect(mainView.view().mainView).toBe("strength");
      expect(mainView.view().mapShown).toBe(false);

      mainView.crossTo(true);
      expect(mainView.view().mainView).toBe("strength");
      expect(mainView.view().mapShown).toBe(true);
    });
  });

  describe("the cursor in Neuer Eintrag", () => {
    let field: HTMLTextAreaElement;
    afterEach(() => field.remove());

    function renderWithField(desktop: boolean) {
      const mainView = renderMainView(desktop);
      field = document.createElement("textarea");
      document.body.append(field);
      mainView.view().newEntryRef.current = field;
      return mainView;
    }

    it.each(["map", "strength"] as const)(
      "goes there on the desktop when ETB is chosen from %s",
      (from) => {
        const mainView = renderWithField(true);
        mainView.select(from);

        mainView.select("etb");

        expect(field).toHaveFocus();
      },
    );

    it("goes back there on the desktop when ETB is chosen while the ETB is shown", () => {
      const mainView = renderWithField(true);
      mainView.select("etb");
      act(() => field.blur());

      mainView.select("etb");

      expect(field).toHaveFocus();
    });

    it("stays where it is when ETB is chosen on a phone", () => {
      const mainView = renderWithField(false);
      mainView.select("map");

      mainView.select("etb");

      expect(field).not.toHaveFocus();
    });
  });

  describe("the map panel on a phone", () => {
    it("is a closed sheet at start", () => {
      const mainView = renderMainView(false);
      mainView.select("map");
      expect(mainView.view().shownPanel).toBeNull();
    });

    it("opens, switches and closes with the panel switch, and closes with Schließen", () => {
      const mainView = renderMainView(false);
      mainView.select("map");

      mainView.selectPanel("symbols");
      expect(mainView.view().shownPanel).toBe("symbols");
      expect(mainView.view().mapShown).toBe(true);
      mainView.selectPanel("areas");
      expect(mainView.view().shownPanel).toBe("areas");
      mainView.selectPanel("areas");
      expect(mainView.view().shownPanel).toBeNull();

      mainView.selectPanel("layers");
      act(() => mainView.view().closeSheet());
      expect(mainView.view().shownPanel).toBeNull();
    });

    it("closes when work on the map needs the space", () => {
      const mainView = renderMainView(false);
      mainView.select("map");
      mainView.selectPanel("layers");

      act(() => mainView.view().closeSheetOnPhone());

      expect(mainView.view().shownPanel).toBeNull();
    });

    it.each(["etb", "strength"] as const)(
      "stays open across switching to %s and back",
      (view) => {
        const mainView = renderMainView(false);
        mainView.select("map");
        mainView.selectPanel("layers");

        mainView.select(view);
        expect(mainView.view().shownPanel).toBe("layers");
        mainView.select("map");

        expect(mainView.view().shownPanel).toBe("layers");
      },
    );
  });

  describe("the map panel in the sidebar on the desktop", () => {
    it.each(["etb", "strength"] as const)("is not shown beside %s", (view) => {
      const mainView = renderMainView(true);
      mainView.select("map");
      mainView.selectPanel("layers");

      mainView.select(view);

      expect(mainView.view().shownPanel).toBeNull();
    });

    it("is Kartenzeichen under Lagekarte after loading", () => {
      const mainView = renderMainView(true);
      mainView.select("map");
      expect(mainView.view().shownPanel).toBe("symbols");
    });

    it("shows the chosen panel, and a second click changes nothing", () => {
      const mainView = renderMainView(true);
      mainView.select("map");

      mainView.selectPanel("layers");
      expect(mainView.view().shownPanel).toBe("layers");
      mainView.selectPanel("layers");
      expect(mainView.view().shownPanel).toBe("layers");
    });

    it("shows the last chosen panel again after the ETB", () => {
      const mainView = renderMainView(true);
      mainView.select("map");
      mainView.selectPanel("areas");

      mainView.select("etb");
      mainView.select("map");

      expect(mainView.view().shownPanel).toBe("areas");
    });

    it("stays when work on the map would close a sheet", () => {
      const mainView = renderMainView(true);
      mainView.select("map");
      mainView.selectPanel("layers");

      act(() => mainView.view().closeSheetOnPhone());

      expect(mainView.view().shownPanel).toBe("layers");
    });
  });

  describe("crossing 768 px", () => {
    it("keeps an open sheet as the sidebar panel and back", () => {
      const mainView = renderMainView(false);
      mainView.select("map");
      mainView.selectPanel("areas");

      mainView.crossTo(true);
      expect(mainView.view().shownPanel).toBe("areas");
      act(() => mainView.view().closeSheetOnPhone());
      expect(mainView.view().shownPanel).toBe("areas");

      mainView.crossTo(false);
      expect(mainView.view().shownPanel).toBe("areas");
    });

    it("opens the sheet of the panel chosen on the desktop on a phone", () => {
      const mainView = renderMainView(true);
      mainView.select("map");
      mainView.selectPanel("layers");

      mainView.crossTo(false);

      expect(mainView.view().shownPanel).toBe("layers");
    });

    it("shows Kartenzeichen on the desktop when the sheet was closed", () => {
      const mainView = renderMainView(false);
      mainView.select("map");

      mainView.crossTo(true);

      expect(mainView.view().shownPanel).toBe("symbols");
    });

    it("opens no sheet on a phone when no panel was chosen on the desktop", () => {
      const mainView = renderMainView(true);
      mainView.select("map");

      mainView.crossTo(false);

      expect(mainView.view().shownPanel).toBeNull();
      expect(mainView.view().mapShown).toBe(true);
    });
  });

  describe("the panel switch", () => {
    it.each([
      ["a phone", false],
      ["the desktop", true],
    ])("is shown on %s only under Lagekarte", (_, desktop) => {
      const mainView = renderMainView(desktop);
      expect(mainView.view().panelSwitchShown).toBe(false);
      mainView.select("strength");
      expect(mainView.view().panelSwitchShown).toBe(false);
      mainView.select("map");
      expect(mainView.view().panelSwitchShown).toBe(true);
    });

    it.each([
      ["gives way on a phone", false, false],
      ["stays on the desktop", true, true],
    ])(
      "%s while the on-screen keyboard is open",
      (_, desktop, shownWithKeyboard) => {
        const viewport = stubVisualViewport(window.innerHeight);
        const mainView = renderMainView(desktop);
        mainView.select("map");

        act(() => viewport.resizeTo(window.innerHeight - 300));
        expect(mainView.view().panelSwitchShown).toBe(shownWithKeyboard);

        act(() => viewport.resizeTo(window.innerHeight));
        expect(mainView.view().panelSwitchShown).toBe(true);
      },
    );
  });
});
