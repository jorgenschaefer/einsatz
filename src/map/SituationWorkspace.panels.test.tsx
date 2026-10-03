import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { act, fireEvent, screen, waitFor, within } from "@/test/render";
import { stubVisualViewport } from "@/test/visual-viewport";
import type { MarkerSpec } from "./adapter";
import type { fakeMapAdapterFactory } from "./adapter.fixtures";
import { SYMBOL } from "./map-objects.fixtures";
import type { SituationWorkspaceProps } from "./SituationWorkspace";
import {
  anyMapPanel,
  mapPanel,
  openPanel,
  type PanelName,
  renderWorkspace,
  selectMainView,
} from "./SituationWorkspace.fixtures";

const panelSwitch = () => screen.queryByRole("group", { name: "Kartenpanels" });
const shownPanelSwitch = () =>
  within(screen.getByRole("group", { name: "Kartenpanels" }));
const switchEntry = (name: PanelName) =>
  shownPanelSwitch().getByLabelText(name, { selector: "button" });
const pressedEntries = () =>
  shownPanelSwitch()
    .getAllByRole("button")
    .filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.getAttribute("aria-label"));

describe("SituationWorkspace", () => {
  describe.each([
    ["on a phone", false],
    ["on the desktop", true],
  ])("the panel switch %s", (_, desktop) => {
    beforeEach(() => {
      stubMatchMedia(desktop);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("offers Kartenzeichen, Bereiche and Ebenen under Lagekarte", async () => {
      renderWorkspace();
      await selectMainView("Lagekarte");
      expect(
        shownPanelSwitch()
          .getAllByRole("button")
          .map((button) => button.getAttribute("aria-label")),
      ).toEqual(["Kartenzeichen", "Bereiche", "Ebenen"]);
    });

    it("is not shown under the ETB and the Stärke", async () => {
      renderWorkspace();
      expect(panelSwitch()).toBeNull();
      await selectMainView("Stärke");
      expect(panelSwitch()).toBeNull();
    });

    it("leaves no panel button among the Kartenknöpfe", async () => {
      renderWorkspace();
      await selectMainView("Lagekarte");
      const column = within(
        screen.getByRole("group", { name: "Kartenknöpfe" }),
      );
      for (const name of ["Kartenzeichen", "Bereiche", "Ebenen"]) {
        expect(column.queryByLabelText(name)).toBeNull();
      }
    });
  });

  describe("while the on-screen keyboard is open", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /** Zeigt die Lagekarte; die Rückgabe öffnet die Bildschirmtastatur. */
    const renderLagekarteWithKeyboard = async () => {
      const viewport = stubVisualViewport(window.innerHeight);
      renderWorkspace();
      await selectMainView("Lagekarte");
      return () => act(() => viewport.resizeTo(window.innerHeight - 300));
    };

    it("hides the panel switch on a phone", async () => {
      stubMatchMedia(false);
      const openKeyboard = await renderLagekarteWithKeyboard();
      openKeyboard();
      expect(panelSwitch()).toBeNull();
    });

    // Daran endet das Blatt an der Reihe oder reicht ohne sie bis ganz unten.
    it("marks the Lagekarte only while the panel switch is shown on a phone", async () => {
      stubMatchMedia(false);
      const openKeyboard = await renderLagekarteWithKeyboard();
      const map = document.querySelector('[data-view="map"]');
      expect(map).toHaveAttribute("data-panel-switch");

      openKeyboard();
      expect(map).not.toHaveAttribute("data-panel-switch");
    });

    it("keeps the panel switch on the desktop", async () => {
      stubMatchMedia(true);
      const openKeyboard = await renderLagekarteWithKeyboard();
      openKeyboard();
      expect(panelSwitch()).toBeInTheDocument();
    });
  });

  it("opens no map sheet at start on a phone", async () => {
    stubMatchMedia(false);
    try {
      renderWorkspace();
      await selectMainView("Lagekarte");
      expect(anyMapPanel()).toBeNull();
      expect(pressedEntries()).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  describe("the map panel in the sidebar on the desktop", () => {
    beforeEach(() => {
      stubMatchMedia(true);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("shows no map panel beside the ETB", () => {
      renderWorkspace();
      expect(anyMapPanel()).toBeNull();
    });

    it("shows Kartenzeichen under Lagekarte after loading", async () => {
      renderWorkspace();
      await selectMainView("Lagekarte");
      expect(mapPanel("Kartenzeichen")).toBeVisible();
      expect(pressedEntries()).toEqual(["Kartenzeichen"]);
    });

    it("shows the panel of a switch entry, and a second click changes nothing", async () => {
      renderWorkspace();
      await selectMainView("Lagekarte");
      await userEvent.click(switchEntry("Ebenen"));
      expect(mapPanel("Ebenen")).toBeVisible();
      expect(pressedEntries()).toEqual(["Ebenen"]);

      await userEvent.click(switchEntry("Ebenen"));
      expect(mapPanel("Ebenen")).toBeVisible();
      expect(pressedEntries()).toEqual(["Ebenen"]);
    });

    it("switches the sidebar with its own bar", async () => {
      renderWorkspace();
      const sidebarBar = within(screen.getByRole("main"));
      expect(sidebarBar.getByRole("button", { name: "ETB" })).toHaveAttribute(
        "aria-current",
        "page",
      );

      await userEvent.click(sidebarBar.getByRole("button", { name: "Stärke" }));
      expect(
        sidebarBar.getByRole("button", { name: "Stärke" }),
      ).toHaveAttribute("aria-current", "page");
      expect(screen.getByLabelText("Neuer Eintrag")).not.toBeVisible();

      await userEvent.click(
        sidebarBar.getByRole("button", { name: "Lagekarte" }),
      );
      expect(mapPanel("Kartenzeichen")).toBeVisible();
    });

    it("keeps the Lagekarte visible beside the ETB and Stärke", async () => {
      renderWorkspace();
      const mapShown = () =>
        expect(
          screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
            selector: "button",
          }),
        ).toBeVisible();
      mapShown();
      await selectMainView("Stärke");
      mapShown();
    });

    it("offers no Schließen on the panel", async () => {
      renderWorkspace();
      await selectMainView("Lagekarte");
      expect(
        within(mapPanel("Kartenzeichen")).queryByLabelText("Schließen", {
          selector: "button",
        }),
      ).toBeNull();
    });

    it("shows the last chosen panel again after the ETB", async () => {
      renderWorkspace();
      await openPanel("Bereiche");
      await selectMainView("ETB");
      expect(anyMapPanel()).toBeNull();

      await selectMainView("Lagekarte");
      expect(mapPanel("Bereiche")).toBeVisible();
      expect(pressedEntries()).toEqual(["Bereiche"]);
    });
  });

  describe("working beside the Lagekarte on the desktop", () => {
    beforeEach(() => {
      stubMatchMedia(true);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const REPORT = {
      id: "r1",
      leaders: 0,
      subLeaders: 1,
      crew: 6,
      additionalPersonnel: 2,
      note: null,
      reportedAt: new Date().toISOString(),
      state: "gueltig" as const,
      number: 1,
    };

    const renderLoaded = async (over: Partial<SituationWorkspaceProps>) => {
      const built = renderWorkspace({ symbols: [SYMBOL], ...over });
      await waitFor(() => expect(built.adapter.setMarker).toHaveBeenCalled());
      built.adapter.setView.mockClear();
      return built;
    };

    const expectMapUntouchedAndClickable = async (
      adapter: ReturnType<typeof fakeMapAdapterFactory>["adapter"],
    ) => {
      expect(
        screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
          selector: "button",
        }),
      ).toBeVisible();
      expect(adapter.setView).not.toHaveBeenCalled();
      expect(modeBandShown()).toBe(false);
      const spec = adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;
      act(() => spec.onClick!());
      expect(
        await screen.findByRole("dialog", { name: "Kartenzeichen" }),
      ).toBeInTheDocument();
    };
    const modeBandShown = () => screen.queryByRole("toolbar") !== null;

    it.each([
      ["Strg+Enter", () => userEvent.keyboard("{Control>}{Enter}{/Control}")],
      [
        "Eintrag hinzufügen",
        () => userEvent.click(screen.getByText("Eintrag hinzufügen")),
      ],
    ])(
      "adds an ETB entry with %s and keeps the ETB and the map",
      async (_, submit) => {
        const onAddJournalEntry = vi.fn(async () => ({}));
        const { adapter } = await renderLoaded({ onAddJournalEntry });

        await userEvent.click(screen.getByLabelText("Neuer Eintrag"));
        await userEvent.keyboard("Deich gesichert");
        await submit();

        expect(onAddJournalEntry).toHaveBeenCalledWith(
          expect.objectContaining({ text: "Deich gesichert" }),
        );
        expect(screen.getByLabelText("Neuer Eintrag")).toBeVisible();
        await expectMapUntouchedAndClickable(adapter);
      },
    );

    it.each(["Melden", "Unverändert melden"])(
      "returns to the Stellen after %s and keeps the map",
      async (button) => {
        const onRecordStrengthReport = vi.fn(async () => ({}));
        const { adapter } = await renderLoaded({
          onRecordStrengthReport,
          stations: [{ id: "st1", name: "UHSt 3", reports: [REPORT] }],
        });
        await selectMainView("Stärke");

        await userEvent.click(screen.getByRole("button", { name: "UHSt 3" }));
        await userEvent.click(screen.getByRole("button", { name: button }));

        expect(onRecordStrengthReport).toHaveBeenCalledTimes(1);
        expect(
          await screen.findByRole("button", { name: "UHSt 3" }),
        ).toBeVisible();
        await expectMapUntouchedAndClickable(adapter);
      },
    );

    it("keeps a started ETB entry across the Lagekarte and a map button", async () => {
      renderWorkspace();
      fireEvent.change(screen.getByLabelText("Neuer Eintrag"), {
        target: { value: "Deich gesichert" },
      });

      await selectMainView("Lagekarte");
      await userEvent.click(
        screen.getByLabelText("Bereiche", { selector: "button" }),
      );
      await selectMainView("ETB");

      expect(screen.getByLabelText("Neuer Eintrag")).toHaveValue(
        "Deich gesichert",
      );
    });

    it("keeps a half-filled Stärkemeldung across the Lagekarte", async () => {
      renderWorkspace({
        stations: [{ id: "st1", name: "UHSt 3", reports: [] }],
      });
      await selectMainView("Stärke");
      await userEvent.click(screen.getByRole("button", { name: "UHSt 3" }));
      await userEvent.type(screen.getByRole("textbox", { name: "EK" }), "6");

      await openPanel("Ebenen");
      await selectMainView("Stärke");

      expect(screen.getByRole("textbox", { name: "EK" })).toHaveValue("6");
    });
  });

  it("switches and closes map sheets via the panel switch and ✕ on a phone", async () => {
    renderWorkspace();
    await selectMainView("Lagekarte");
    await userEvent.click(switchEntry("Kartenzeichen"));
    expect(mapPanel("Kartenzeichen")).toBeVisible();
    expect(pressedEntries()).toEqual(["Kartenzeichen"]);

    await userEvent.click(switchEntry("Bereiche"));
    expect(mapPanel("Bereiche")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Kartenzeichen" })).toBeNull();
    expect(pressedEntries()).toEqual(["Bereiche"]);

    await userEvent.click(switchEntry("Bereiche"));
    expect(anyMapPanel()).toBeNull();
    expect(pressedEntries()).toEqual([]);

    await userEvent.click(switchEntry("Ebenen"));
    await userEvent.click(
      within(mapPanel("Ebenen")).getByLabelText("Schließen", {
        selector: "button",
      }),
    );
    expect(anyMapPanel()).toBeNull();
    expect(pressedEntries()).toEqual([]);
  });

  it("marks the Lagekarte while a map panel is open", async () => {
    renderWorkspace();
    await selectMainView("Lagekarte");
    const map = document.querySelector('[data-view="map"]');
    expect(map).not.toHaveAttribute("data-panel-open");

    await openPanel("Ebenen");
    expect(map).toHaveAttribute("data-panel-open");
  });

  it.each(["ETB", "Stärke"] as const)(
    "keeps the open map sheet when switching to the %s and back on a phone",
    async (view) => {
      renderWorkspace();
      await openPanel("Ebenen");
      await selectMainView(view);
      await selectMainView("Lagekarte");
      expect(mapPanel("Ebenen")).toBeVisible();
      expect(pressedEntries()).toEqual(["Ebenen"]);
    },
  );

  describe("crossing 768 px", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("keeps an open sheet as the sidebar panel and back", async () => {
      const { fireChange } = stubMatchMedia(false);
      renderWorkspace();
      await openPanel("Bereiche");

      act(() => fireChange(true));
      expect(mapPanel("Bereiche")).toBeVisible();
      // Jetzt Desktop-Form: Zeichnen lässt das Panel stehen.
      await userEvent.click(screen.getByText("Polygon"));
      expect(mapPanel("Bereiche")).toBeVisible();

      act(() => fireChange(false));
      expect(mapPanel("Bereiche")).toBeVisible();
      expect(
        within(mapPanel("Bereiche")).getByLabelText("Schließen", {
          selector: "button",
        }),
      ).toBeInTheDocument();
    });

    it("shows Kartenzeichen on the desktop when the sheet was closed", async () => {
      const { fireChange } = stubMatchMedia(false);
      renderWorkspace();
      await selectMainView("Lagekarte");

      act(() => fireChange(true));
      expect(mapPanel("Kartenzeichen")).toBeVisible();
    });

    it("opens the sheet of the switch entry pressed on the desktop on a phone", async () => {
      const { fireChange } = stubMatchMedia(true);
      renderWorkspace();
      await openPanel("Ebenen");

      act(() => fireChange(false));
      expect(
        within(mapPanel("Ebenen")).getByLabelText("Schließen", {
          selector: "button",
        }),
      ).toBeVisible();
    });

    it("shows the Lagekarte without a sheet on a phone when no map button was pressed", async () => {
      const { fireChange } = stubMatchMedia(true);
      renderWorkspace();
      await selectMainView("Lagekarte");

      act(() => fireChange(false));
      expect(
        screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
          selector: "button",
        }),
      ).toBeVisible();
      expect(anyMapPanel()).toBeNull();
    });

    it("shows the Lagekarte on a phone only while it is the main view", async () => {
      const { fireChange } = stubMatchMedia(true);
      renderWorkspace();

      act(() => fireChange(false));
      expect(screen.getByLabelText("Neuer Eintrag")).toBeVisible();
      expect(
        screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
          selector: "button",
        }),
      ).not.toBeVisible();
    });

    it("does not recreate the map", () => {
      const { fireChange } = stubMatchMedia(true);
      const { factory, adapter } = renderWorkspace();

      act(() => fireChange(false));
      act(() => fireChange(true));

      expect(factory.create).toHaveBeenCalledTimes(1);
      expect(adapter.destroy).not.toHaveBeenCalled();
    });
  });
});
