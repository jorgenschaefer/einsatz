import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { entry } from "@/journal/JournalEntry.fixtures";
import { report } from "@/strength/StrengthPanel.fixtures";
import { stubMatchMedia } from "@/test/match-media";
import {
  act,
  fireEvent,
  Providers,
  render,
  routerRefresh,
  screen,
  waitFor,
  within,
} from "@/test/render";
import type { MarkerSpec } from "./adapter";
import { aKmlUrlOverlay, anImageOverlay, SYMBOL } from "./map-objects.fixtures";
import {
  SituationWorkspace,
  type SituationWorkspaceProps,
} from "./SituationWorkspace";
import {
  addJournalEntry,
  annulJournalEntry,
  annulStrengthReport,
  anyMapPanel,
  buildProps,
  chooseMenuItem,
  correctJournalEntry,
  correctStrengthReport,
  createStation,
  createViewLink,
  defaultViewMenuItem,
  deleteViewLink,
  headerMenu,
  mapPanel,
  openPanel,
  PANEL_CONTENT,
  pane,
  recordStrengthReport,
  renameStation,
  renderWorkspace,
  reportTotalStrength,
  returnButton,
  selectMainView,
  setDefaultView,
} from "./SituationWorkspace.fixtures";
import { aSymbol } from "./symbol.fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SituationWorkspace", () => {
  it("hands the shell the operation, its view links and the live connection", async () => {
    let fire: () => void = () => {};
    const eventsHook = vi.fn((_url: string, onChanged: () => void) => {
      fire = onChanged;
      return { connected: false };
    });
    renderWorkspace({
      operationName: "Cyclassics 2026",
      status: "closed",
      viewLinks: PANEL_CONTENT.viewLinks,
      eventsHook,
    });

    const header = within(screen.getByTestId("desktop-header"));
    expect(
      header.getByRole("heading", { name: "Cyclassics 2026" }),
    ).toBeInTheDocument();
    expect(header.getByText("abgeschlossen")).toBeInTheDocument();
    expect(
      header.getByLabelText(
        "Verbindung getrennt – wird automatisch wiederhergestellt",
        { selector: "button" },
      ),
    ).toBeInTheDocument();
    await headerMenu("desktop-header");
    await chooseMenuItem("Teilen");
    expect(await screen.findByText("Leitstelle")).toBeInTheDocument();

    expect(eventsHook).toHaveBeenCalledWith(
      "/operations/op-x/events",
      expect.any(Function),
    );
    routerRefresh.mockClear();
    fire();
    expect(routerRefresh).toHaveBeenCalled();
  });

  describe("its notifications when the Lageansicht is left", () => {
    const failing = (onReloadKml: SituationWorkspaceProps["onReloadKml"]) =>
      buildProps({
        kmlOverlays: [aKmlUrlOverlay],
        onReloadKml,
      }).props;
    const reloadKml = async () => {
      await openPanel("Ebenen");
      await userEvent.click(
        within(mapPanel("Ebenen")).getByRole("button", { name: "Neu laden" }),
      );
    };

    it("are closed", async () => {
      const props = failing(vi.fn(async () => ({ error: "404" })));
      const { rerender } = render(<SituationWorkspace {...props} />);
      await reloadKml();
      expect(await screen.findByRole("alert")).toHaveTextContent("404");

      rerender(<p>Einsätze</p>);

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });

    it("are not shown for an action that fails afterwards", async () => {
      let fail = (_result: { error: string }) => {};
      const props = failing(
        vi.fn(() => new Promise<{ error: string }>((r) => (fail = r))),
      );
      const { rerender } = render(<SituationWorkspace {...props} />);
      await reloadKml();

      rerender(<p>Einsätze</p>);
      fail({ error: "404" });

      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("the main views", () => {
    it("shows only the pane of the chosen main view, starting on the ETB", async () => {
      renderWorkspace();
      expect(pane("etb").style.display).toBe("");
      expect(pane("strength").style.display).toBe("none");

      await selectMainView("Stärke");

      expect(pane("strength").style.display).toBe("");
      expect(pane("etb").style.display).toBe("none");
      expect(pane("map").style.display).toBe("none");
    });

    it("shows the ETB and leaves the Lagekarte to CSS in the server-rendered markup", () => {
      const container = document.createElement("div");
      container.innerHTML = renderToString(
        <Providers>
          <SituationWorkspace {...buildProps().props} />
        </Providers>,
      );
      const serverPane = (view: string) =>
        container.querySelector(`[data-view="${view}"]`) as HTMLElement;
      expect(serverPane("etb").style.display).toBe("");
      expect(serverPane("map").style.display).toBe("");
      expect(serverPane("strength").style.display).toBe("none");
      // Hides the map on a phone until the width is known (situation-workspace.css).
      expect(
        serverPane("map").closest('[data-layout="unknown"]'),
      ).not.toBeNull();
    });

    it("keeps a started ETB entry and a half-filled Stärkemeldung across the Lagekarte", async () => {
      renderWorkspace({
        stations: [{ id: "st1", name: "UHSt 3", reports: [] }],
      });
      fireEvent.change(screen.getByLabelText("Neuer Eintrag"), {
        target: { value: "Deich gesichert" },
      });
      await selectMainView("Stärke");
      await userEvent.click(screen.getByRole("button", { name: "UHSt 3" }));
      await userEvent.type(screen.getByRole("textbox", { name: "EK" }), "6");

      await selectMainView("Lagekarte");
      await selectMainView("Stärke");
      expect(screen.getByRole("textbox", { name: "EK" })).toHaveValue("6");
      await selectMainView("ETB");
      expect(screen.getByLabelText("Neuer Eintrag")).toHaveValue(
        "Deich gesichert",
      );
    });

    it("does not recreate the map when switching views or crossing 768 px", async () => {
      const { fireChange } = stubMatchMedia(true);
      const { factory, adapter } = renderWorkspace();

      await selectMainView("Lagekarte");
      await selectMainView("ETB");
      act(() => fireChange(false));
      act(() => fireChange(true));

      expect(factory.create).toHaveBeenCalledTimes(1);
      expect(adapter.destroy).not.toHaveBeenCalled();
    });

    it("switches from the phone bar and the sidebar, each counting new ETB entries", async () => {
      const { props } = buildProps({ journalEntries: [entry()] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      const phoneBar = within(screen.getByRole("contentinfo"));
      const sidebarBar = within(screen.getByRole("main"));

      await userEvent.click(phoneBar.getByRole("button", { name: "Stärke" }));
      expect(
        sidebarBar.getByRole("button", { name: "Stärke" }),
      ).toHaveAttribute("aria-current", "page");
      await userEvent.click(
        sidebarBar.getByRole("button", { name: "Lagekarte" }),
      );
      expect(
        phoneBar.getByRole("button", { name: "Lagekarte" }),
      ).toHaveAttribute("aria-current", "page");

      rerender(
        <SituationWorkspace
          {...props}
          journalEntries={[
            entry(),
            entry({ id: "e2", number: 2, author: "ben" }),
            entry({ id: "e3", number: 3, author: "anna" }),
          ]}
        />,
      );
      for (const bar of [phoneBar, sidebarBar]) {
        expect(bar.getByText("ETB").closest("button")).toHaveAccessibleName(
          "ETB 1 neuer Eintrag",
        );
      }
    });

    it("puts the cursor into Neuer Eintrag when ETB is chosen on the desktop", async () => {
      stubMatchMedia(true);
      renderWorkspace();
      await selectMainView("Lagekarte");

      await selectMainView("ETB");

      expect(screen.getByLabelText("Neuer Eintrag")).toHaveFocus();
    });

    it("shows the latest ETB entry when the ETB is chosen", async () => {
      const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
      try {
        renderWorkspace();
        await selectMainView("Lagekarte");
        scrollIntoView.mockClear();

        await selectMainView("ETB");

        expect(scrollIntoView).toHaveBeenCalledWith({ block: "end" });
      } finally {
        scrollIntoView.mockRestore();
      }
    });
  });

  describe("the Lagekarte", () => {
    it("is shown on a phone only under Lagekarte, as is the Standard-Ausschnitt festlegen", async () => {
      stubMatchMedia(false);
      renderWorkspace();
      expect(returnButton()).not.toBeVisible();
      expect(
        screen.queryByRole("group", { name: "Kartenpanels", hidden: true }),
      ).toBeNull();
      expect(await defaultViewMenuItem()).toBeDisabled();
      await userEvent.keyboard("{Escape}");

      await selectMainView("Lagekarte");

      expect(returnButton()).toBeVisible();
      expect(await defaultViewMenuItem()).toBeEnabled();
    });

    it("opens, switches and closes map sheets on a phone", async () => {
      stubMatchMedia(false);
      renderWorkspace();
      await selectMainView("Lagekarte");
      expect(anyMapPanel()).toBeNull();

      await openPanel("Bereiche");
      expect(mapPanel("Bereiche")).toBeVisible();
      await userEvent.click(
        within(mapPanel("Bereiche")).getByLabelText("Schließen", {
          selector: "button",
        }),
      );

      expect(anyMapPanel()).toBeNull();
    });

    it("shows Kartenzeichen in the sidebar on the desktop, without Schließen", async () => {
      stubMatchMedia(true);
      renderWorkspace();
      await selectMainView("Lagekarte");

      expect(mapPanel("Kartenzeichen")).toBeVisible();
      expect(
        within(mapPanel("Kartenzeichen")).queryByLabelText("Schließen", {
          selector: "button",
        }),
      ).toBeNull();
    });

    it.each([
      ["closes the sheet on a phone", false],
      ["keeps the panel in the sidebar on the desktop", true],
    ])("%s when editing a Bild-Overlay starts", async (_, desktop) => {
      stubMatchMedia(desktop);
      renderWorkspace({ imageOverlays: [anImageOverlay] });
      await openPanel("Ebenen");

      await userEvent.click(await screen.findByText("Bearbeiten"));

      expect(
        screen.getByRole("toolbar", { name: "Bild-Overlay bearbeiten" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Ebenen" }) !== null).toBe(
        desktop,
      );
    });
  });

  describe("Standard-Ausschnitt festlegen", () => {
    it("saves the current map view as the default", async () => {
      const onSetDefaultView = vi.fn(async () => ({}));
      const { adapter, captured } = renderWorkspace({ onSetDefaultView });
      await selectMainView("Lagekarte");
      await waitFor(() => expect(captured.options).toBeDefined());
      adapter.getView = () => ({ lat: 53.5, lng: 9.9, zoom: 14 });

      await setDefaultView();

      expect(onSetDefaultView).toHaveBeenCalledWith({
        lat: 53.5,
        lng: 9.9,
        zoom: 14,
      });
    });

    it("saves nothing and asks to try again before the map has loaded", async () => {
      // Der echte Leaflet-Adapter wird dynamisch geladen; hängt das Laden, gibt es
      // noch keine Karte und damit keinen Ausschnitt.
      vi.doMock("./leaflet-adapter", () => new Promise(() => {}));
      try {
        const onSetDefaultView = vi.fn(async () => ({}));
        renderWorkspace({ onSetDefaultView, factory: undefined });
        await selectMainView("Lagekarte");

        const dialog = await setDefaultView();

        expect(within(dialog).getByRole("alert")).toHaveTextContent(
          "Die Karte lädt noch. Bitte erneut versuchen.",
        );
        expect(onSetDefaultView).not.toHaveBeenCalled();
      } finally {
        vi.doUnmock("./leaflet-adapter");
      }
    });
  });

  it("hands the map its uploads to the Einsatz's routes", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    renderWorkspace();
    await openPanel("Ebenen");

    await userEvent.upload(
      screen.getByLabelText("KML-/KMZ-Datei einbinden"),
      new File(["<kml/>"], "abschnitte.kml"),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/operations/op-x/kml",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it.each<[keyof SituationWorkspaceProps, () => Promise<void>, unknown[]]>([
    [
      "onAddJournalEntry",
      addJournalEntry,
      [expect.objectContaining({ text: "Deich", sender: "EAL" })],
    ],
    [
      "onCorrectJournalEntry",
      correctJournalEntry,
      ["e1", expect.objectContaining({ text: "Deich hält" })],
    ],
    ["onAnnulJournalEntry", annulJournalEntry, ["e1"]],
    ["onCreateStation", createStation, ["Ziel"]],
    ["onRenameStation", renameStation, ["st1", "UHSt 3 Nord"]],
    [
      "onRecordStrengthReport",
      recordStrengthReport,
      ["st1", expect.objectContaining({ crew: 6 })],
    ],
    ["onReportTotalStrength", reportTotalStrength, []],
    [
      "onCorrectStrengthReport",
      correctStrengthReport,
      ["r1", "st1", expect.objectContaining({ crew: 6 })],
    ],
    ["onAnnulStrengthReport", annulStrengthReport, ["r1"]],
    ["onCreateViewLink", createViewLink, ["Lagezentrum"]],
    ["onDeleteViewLink", deleteViewLink, ["1"]],
  ])("passes %s on to its panel", async (handler, perform, args) => {
    const spy = vi.fn(async () => ({}));
    renderWorkspace({ ...PANEL_CONTENT, [handler]: spy });

    await perform();

    await waitFor(() => expect(spy).toHaveBeenCalledWith(...args));
  });

  it("grays a device symbol and marks a Stärkemeldung going stale while the view stays open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const minutesAgo = (minutes: number) =>
        new Date(Date.now() - minutes * 60_000);
      const { adapter } = renderWorkspace({
        symbols: [
          aSymbol({
            id: "dev",
            positionSource: "device",
            reportedAt: minutesAgo(1),
          }),
        ],
        stations: [
          {
            id: "st1",
            name: "UHSt 3",
            reports: [report({ reportedAt: minutesAgo(58).toISOString() })],
          },
        ],
      });
      await selectMainView("Stärke");
      const lastMarker = () =>
        adapter.setMarker.mock.calls
          .filter((call) => call[0] === "dev")
          .at(-1)?.[1] as MarkerSpec | undefined;
      await vi.waitFor(() => expect(lastMarker()).toBeDefined());
      expect(lastMarker()?.opacity ?? 1).toBe(1);
      const oldest = () => screen.getByText(/^älteste Meldung/);
      expect(oldest()).not.toHaveAttribute("data-stale");

      await act(() => vi.advanceTimersByTimeAsync(4 * 60_000));

      expect(lastMarker()?.opacity).toBeLessThan(1);
      expect(oldest()).toHaveAttribute("data-stale");
    } finally {
      vi.useRealTimers();
    }
  });

  describe("working beside the Lagekarte on the desktop", () => {
    it.each([
      [
        "adds an ETB entry",
        async () => {
          await userEvent.type(screen.getByLabelText("Neuer Eintrag"), "Deich");
          await userEvent.keyboard("{Control>}{Enter}{/Control}");
          expect(screen.getByLabelText("Neuer Eintrag")).toBeVisible();
        },
      ],
      [
        "records a Stärkemeldung and returns to the Stellen",
        async () => {
          await selectMainView("Stärke");
          await userEvent.click(screen.getByRole("button", { name: "UHSt 3" }));
          await userEvent.click(screen.getByRole("button", { name: "Melden" }));
          expect(
            await screen.findByRole("button", { name: "UHSt 3" }),
          ).toBeVisible();
        },
      ],
    ])("%s and keeps the map untouched and clickable", async (_, work) => {
      stubMatchMedia(true);
      const { adapter } = renderWorkspace({
        symbols: [SYMBOL],
        stations: [{ id: "st1", name: "UHSt 3", reports: [report()] }],
      });
      await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
      adapter.setView.mockClear();

      await work();

      expect(returnButton()).toBeVisible();
      expect(adapter.setView).not.toHaveBeenCalled();
      expect(screen.queryByRole("toolbar")).toBeNull();
      const spec = adapter.setMarker.mock.calls.at(-1)?.[1] as MarkerSpec;
      act(() => spec.onClick?.());
      expect(
        await screen.findByRole("dialog", { name: "Kartenzeichen" }),
      ).toBeInTheDocument();
    });
  });
});
