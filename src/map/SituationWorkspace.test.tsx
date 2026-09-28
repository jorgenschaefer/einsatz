import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntryView } from "@/app/operations/[id]/JournalPanel";
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
import { stubVisualViewport } from "@/test/visual-viewport";
import type {
  CreateMapOptions,
  MapAdapterFactory,
  MarkerSpec,
} from "./adapter";
import type { AreaGeometry } from "./area";
import type { ImagePlacement } from "./image-overlay";
import { QUICK_SELECT } from "./quick-select";
import {
  SituationWorkspace,
  type SituationWorkspaceProps,
} from "./SituationWorkspace";

function fakeFactory() {
  const captured: { options?: CreateMapOptions } = {};
  const adapter = {
    getView: () => ({ lat: 0, lng: 0, zoom: 1 }),
    setView: vi.fn(),
    setMarker: vi.fn(),
    removeMarker: vi.fn(),
    setArea: vi.fn(),
    removeArea: vi.fn(),
    setKmlOverlay: vi.fn(),
    removeKmlOverlay: vi.fn(),
    setImageOverlay: vi.fn(),
    removeImageOverlay: vi.fn(),
    startImageOverlayEdit: vi.fn(),
    stopImageOverlayEdit: vi.fn(),
    startDrawing: vi.fn(),
    cancelDrawing: vi.fn(),
    startCirclePreview: vi.fn(),
    stopCirclePreview: vi.fn(),
    destroy: vi.fn(),
  };
  const create = vi.fn((_c: HTMLElement, options: CreateMapOptions) => {
    captured.options = options;
    return adapter;
  });
  const factory: MapAdapterFactory = { create };
  return { factory, captured, adapter };
}

const selectMainView = (name: "Lagekarte" | "ETB" | "Stärke") =>
  userEvent.click(screen.getAllByText(name)[0]);

/**
 * Gibt Mantines AppShell die Höhe der Leiste an die Hauptansicht zurück?
 * jsdom rechnet kein Layout; sichtbar ist das nur an der CSS-Variable, die
 * AppShell in ihr Inline-Stylesheet schreibt.
 */
const footerOffsetReleased = () =>
  [...document.querySelectorAll("style")].some((style) =>
    style.textContent?.includes("--app-shell-footer-offset:0px !important"),
  );

const START_VIEW_QUERY = "(min-width: 48em)";

/**
 * Stubbt `window.matchMedia` mit einem `matches`-Wert für `START_VIEW_QUERY`,
 * der sich über `fireChange` ändern lässt – simuliert dabei einen echten
 * `MediaQueryList`: ein per `addEventListener("change", …)` auf genau dieser
 * Query registrierter Listener wird tatsächlich aufgerufen, falls die
 * Implementierung (fälschlich) einen registriert. Mantine ruft `matchMedia`
 * für andere Queries auf (Farbschema u. Ä.); jeder Aufruf bekommt daher ein
 * eigenes MediaQueryList-Objekt, damit deren Listener sich nicht mit unserem
 * überschreiben.
 */
function stubMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  let changeListener: ((event: { matches: boolean }) => void) | null = null;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return query === START_VIEW_QUERY ? matches : false;
      },
      media: query,
      onchange: null,
      addEventListener: vi.fn((event: string, cb: typeof changeListener) => {
        if (event === "change" && query === START_VIEW_QUERY) {
          changeListener = cb;
        }
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  return {
    fireChange: (nextMatches: boolean) => {
      matches = nextMatches;
      changeListener?.({ matches: nextMatches });
    },
  };
}

function buildProps(over: Partial<SituationWorkspaceProps> = {}) {
  const fake = fakeFactory();
  const props: SituationWorkspaceProps = {
    operationId: "op-x",
    operationName: "Hochwasser",
    status: "active",
    currentUsername: "anna",
    viewLinks: [],
    onCreateViewLink: vi.fn(async () => {}),
    onDeleteViewLink: vi.fn(async () => {}),
    operationDefaultView: null,
    tileUrl: "t",
    attribution: "© OpenStreetMap",
    symbols: [],
    journalEntries: [],
    onAddJournalEntry: vi.fn(async () => ({})),
    onCorrectJournalEntry: vi.fn(async () => ({})),
    onAnnulJournalEntry: vi.fn(async () => ({})),
    onSetDefault: vi.fn(async () => ({})),
    onPlace: vi.fn(async () => ({})),
    onMove: vi.fn(async () => ({})),
    onUpdate: vi.fn(async () => ({})),
    onDelete: vi.fn(async () => ({})),
    onGenerateDeviceLink: vi.fn(async () => ({})),
    onGeocode: vi.fn(async () => []),
    geocoderAttribution: "© OpenStreetMap",
    areas: [],
    onCreateArea: vi.fn(async () => ({})),
    onUpdateAreaStyle: vi.fn(async () => ({})),
    onUpdateAreaGeometry: vi.fn(async () => ({})),
    onDeleteArea: vi.fn(async () => ({})),
    kmlOverlays: [],
    onAddKmlFile: vi.fn(async () => ({})),
    onAddKmlUrl: vi.fn(async () => ({})),
    onSetKmlVisibility: vi.fn(async () => ({})),
    onReloadKml: vi.fn(async () => ({})),
    onRemoveKml: vi.fn(async () => ({})),
    imageOverlays: [],
    onAddImage: vi.fn(async () => ({})),
    onUpdateImagePlacement: vi.fn(async () => ({})),
    onReplaceImage: vi.fn(async () => ({})),
    onSetImageVisibility: vi.fn(async () => ({})),
    onDeleteImage: vi.fn(async () => ({})),
    stations: [],
    onCreateStation: vi.fn(async () => ({})),
    onRenameStation: vi.fn(async () => ({})),
    onRecordStrengthReport: vi.fn(async () => ({})),
    onReportTotalStrength: vi.fn(async () => ({})),
    onCorrectStrengthReport: vi.fn(async () => ({})),
    factory: fake.factory,
    ...over,
  };
  return { ...fake, props };
}

function renderWorkspace(over: Partial<SituationWorkspaceProps> = {}) {
  const built = buildProps(over);
  render(<SituationWorkspace {...built.props} />);
  return built;
}

type PanelName = "Kartenzeichen" | "Bereiche" | "Ebenen";

// Die Kartenpanels leben nur in der Lagekarten-Hauptansicht; erst hinschalten,
// dann den Kartenknopf tippen.
const openPanel = async (name: PanelName) => {
  await selectMainView("Lagekarte");
  await userEvent.click(screen.getByLabelText(name, { selector: "button" }));
};

const mapPanel = (name: PanelName) => screen.getByRole("region", { name });
const anyMapPanel = () =>
  screen.queryByRole("region", { name: /^(Kartenzeichen|Bereiche|Ebenen)$/ });

const SYMBOL = {
  id: "s1",
  lat: 53.5,
  lng: 9.9,
  composition: {
    grundzeichen: "taktische-formation" as const,
    organisation: "hilfsorganisation" as const,
    text: "Pumpe 1",
  },
};

const AREA = {
  id: "a1",
  geometry: {
    shape: "circle" as const,
    center: { lat: 53.5, lng: 9.9 },
    radius: 100,
  },
  color: "#e2001a",
  opacity: 0.4,
  label: "Deich",
};

const journalEntry = (
  number: number,
  author: string | null,
): JournalEntryView => ({
  id: `e${number}`,
  number,
  createdAt: "2026-07-03T08:00:00.000Z",
  text: `Eintrag ${number}`,
  type: "manuell",
  state: "gueltig",
  author,
  editedAt: null,
  revisions: [],
});

/** Der ETB-Punkt der Leiste; sein Name trägt die Zahl neuer Einträge. */
const etbItem = () => screen.getAllByText("ETB")[0].closest("button");

/**
 * Der Knopf mit diesem Text, für Prüfungen am Knopf selbst (Name, disabled,
 * aria-pressed); `getByText` liefert nur das Textelement darin.
 */
const buttonWithText = (text: string | RegExp, container = document.body) =>
  within(container).getByText(text).closest("button") as HTMLElement;

const modeBand = (label: string) =>
  screen.getByRole("toolbar", { name: label });

const startEditingImage = async () => {
  await openPanel("Ebenen");
  await userEvent.click(await screen.findByText("Bearbeiten"));
};

// Am Handy schließt das Blatt, sobald das Bearbeiten beginnt; den Editor
// zeigt das wieder geöffnete Ebenen-Panel.
const openImageEditor = async () => {
  await startEditingImage();
  await openPanel("Ebenen");
};

describe("SituationWorkspace", () => {
  it("renders the operation name and Teilen in the header", () => {
    renderWorkspace({ operationName: "Cyclassics 2026" });
    expect(
      within(screen.getByTestId("desktop-header")).getByRole("heading", {
        name: "Cyclassics 2026",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Teilen/i)).toBeInTheDocument();
  });

  describe("counting new ETB entries", () => {
    it("counts a new entry from another author while the Lagekarte is shown", async () => {
      const { props } = buildProps({ journalEntries: [journalEntry(1, null)] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await selectMainView("Lagekarte");

      rerender(
        <SituationWorkspace
          {...props}
          journalEntries={[
            journalEntry(1, null),
            journalEntry(2, "ben"),
            journalEntry(3, null),
          ]}
        />,
      );

      expect(etbItem()).toHaveAccessibleName("ETB 2 neue Einträge");
    });

    it("counts a new entry from another author while Stärke is shown", async () => {
      const { props } = buildProps({ journalEntries: [journalEntry(1, null)] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await selectMainView("Stärke");

      rerender(
        <SituationWorkspace
          {...props}
          journalEntries={[journalEntry(1, null), journalEntry(2, "ben")]}
        />,
      );

      expect(etbItem()).toHaveAccessibleName("ETB 1 neuer Eintrag");
    });

    it.each([
      ["Lagekarte", "Stärke"],
      ["Stärke", "Lagekarte"],
    ] as const)(
      "keeps the count when switching from %s to %s",
      async (from, to) => {
        const { props } = buildProps({
          journalEntries: [journalEntry(1, null)],
        });
        const { rerender } = render(<SituationWorkspace {...props} />);
        await selectMainView(from);
        rerender(
          <SituationWorkspace
            {...props}
            journalEntries={[journalEntry(1, null), journalEntry(2, "ben")]}
          />,
        );

        await selectMainView(to);

        expect(etbItem()).toHaveAccessibleName("ETB 1 neuer Eintrag");
      },
    );

    it("does not count own entries", async () => {
      const { props } = buildProps({ journalEntries: [journalEntry(1, null)] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await selectMainView("Lagekarte");

      rerender(
        <SituationWorkspace
          {...props}
          journalEntries={[journalEntry(1, null), journalEntry(2, "anna")]}
        />,
      );

      expect(etbItem()).toHaveAccessibleName("ETB");
    });

    it("resets when switching to the ETB", async () => {
      const { props } = buildProps({ journalEntries: [journalEntry(1, null)] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await selectMainView("Lagekarte");
      rerender(
        <SituationWorkspace
          {...props}
          journalEntries={[journalEntry(1, null), journalEntry(2, "ben")]}
        />,
      );

      await selectMainView("ETB");
      expect(etbItem()).toHaveAccessibleName("ETB");

      await selectMainView("Lagekarte");
      expect(etbItem()).toHaveAccessibleName("ETB");
    });

    it("treats entries arriving while the ETB is shown as seen", async () => {
      const { props } = buildProps({ journalEntries: [journalEntry(1, null)] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      rerender(
        <SituationWorkspace
          {...props}
          journalEntries={[journalEntry(1, null), journalEntry(2, "ben")]}
        />,
      );
      expect(etbItem()).toHaveAccessibleName("ETB");

      await selectMainView("Lagekarte");
      expect(etbItem()).toHaveAccessibleName("ETB");
    });

    it("does not count entries present at load on the desktop", () => {
      stubMatchMedia(true);
      try {
        renderWorkspace({
          journalEntries: [journalEntry(1, null), journalEntry(2, "ben")],
        });
        expect(etbItem()).toHaveAccessibleName("ETB");
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe("the main view Stärke", () => {
    const pane = (view: string) =>
      document.querySelector(`[data-view="${view}"]`) as HTMLElement;

    it("is hidden until selected", () => {
      renderWorkspace();
      expect(pane("strength").style.display).toBe("none");
    });

    it("shows only the Stärke pane once selected", async () => {
      renderWorkspace();
      await selectMainView("Stärke");

      expect(pane("strength").style.display).toBe("");
      expect(pane("map").style.display).toBe("none");
      expect(pane("etb").style.display).toBe("none");
    });

    it("lists the Stellen and creates one", async () => {
      const { props } = renderWorkspace({
        stations: [{ id: "st1", name: "UHSt 3", reports: [] }],
      });
      await selectMainView("Stärke");

      expect(
        within(pane("strength")).getByRole("heading", { name: "UHSt 3" }),
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "+ Stelle" }));
      await userEvent.type(
        screen.getByRole("textbox", { name: "Name der Stelle" }),
        "Ziel{Enter}",
      );
      expect(props.onCreateStation).toHaveBeenCalledWith("Ziel");
    });

    it("renames a Stelle", async () => {
      const { props } = renderWorkspace({
        stations: [{ id: "st1", name: "UHSt 3", reports: [] }],
      });
      await selectMainView("Stärke");

      await userEvent.click(
        screen.getByRole("button", { name: "UHSt 3 umbenennen" }),
      );
      await userEvent.type(
        screen.getByRole("textbox", { name: "Neuer Name" }),
        " Nord{Enter}",
      );
      expect(props.onRenameStation).toHaveBeenCalledWith("st1", "UHSt 3 Nord");
    });

    it("records a Stärkemeldung of a Stelle", async () => {
      const { props } = renderWorkspace({
        stations: [{ id: "st1", name: "UHSt 3", reports: [] }],
      });
      await selectMainView("Stärke");

      await userEvent.click(screen.getByRole("button", { name: "UHSt 3" }));
      await userEvent.type(
        screen.getByRole("textbox", { name: "Helfer" }),
        "6",
      );
      await userEvent.click(screen.getByRole("button", { name: "Melden" }));

      expect(props.onRecordStrengthReport).toHaveBeenCalledWith("st1", {
        leaders: 0,
        subLeaders: 0,
        helpers: 6,
        additionalPersonnel: 0,
        note: null,
      });
    });

    it("reports the Gesamtstärke and marks a report older than 60 minutes", async () => {
      const { props } = renderWorkspace({
        stations: [
          {
            id: "st1",
            name: "UHSt 3",
            reports: [
              {
                id: "r1",
                leaders: 0,
                subLeaders: 1,
                helpers: 6,
                additionalPersonnel: 2,
                note: null,
                reportedAt: new Date(Date.now() - 61 * 60_000).toISOString(),
                state: "gueltig",
                number: 1,
              },
            ],
          },
        ],
      });
      await selectMainView("Stärke");

      expect(screen.getByText(/^älteste Meldung/)).toHaveAttribute(
        "data-stale",
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Gesamtstärke melden" }),
      );
      expect(props.onReportTotalStrength).toHaveBeenCalledTimes(1);
    });

    it("keeps a half-filled Stärkemeldung when switching to the Lagekarte and back", async () => {
      renderWorkspace({
        stations: [{ id: "st1", name: "UHSt 3", reports: [] }],
      });
      await selectMainView("Stärke");
      await userEvent.click(screen.getByRole("button", { name: "UHSt 3" }));
      await userEvent.type(
        screen.getByRole("textbox", { name: "Helfer" }),
        "6",
      );

      await selectMainView("Lagekarte");
      await selectMainView("Stärke");

      expect(screen.getByRole("textbox", { name: "Helfer" })).toHaveValue("6");
    });

    it("keeps a started Stelle name when switching to the ETB and back", async () => {
      renderWorkspace();
      await selectMainView("Stärke");
      await userEvent.click(screen.getByRole("button", { name: "+ Stelle" }));
      await userEvent.type(
        screen.getByRole("textbox", { name: "Name der Stelle" }),
        "Ziel",
      );

      await selectMainView("ETB");
      await selectMainView("Stärke");

      expect(
        screen.getByRole("textbox", { name: "Name der Stelle" }),
      ).toHaveValue("Ziel");
    });
  });

  it("keeps a started ETB entry when switching to the Lagekarte and back", async () => {
    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Neuer Eintrag"), {
      target: { value: "Deich gesichert" },
    });
    await selectMainView("Lagekarte");
    await selectMainView("ETB");
    expect(screen.getByLabelText("Neuer Eintrag")).toHaveValue(
      "Deich gesichert",
    );
  });

  it("does not recreate the map when switching views", async () => {
    const { factory, adapter } = renderWorkspace();
    await selectMainView("Lagekarte");
    await selectMainView("ETB");
    expect(factory.create).toHaveBeenCalledTimes(1);
    expect(adapter.destroy).not.toHaveBeenCalled();
  });

  it("starts on the ETB on a phone", () => {
    stubMatchMedia(false);
    try {
      renderWorkspace();
      expect(screen.getByLabelText("Neuer Eintrag")).toBeVisible();
      expect(
        screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
          selector: "button",
        }),
      ).not.toBeVisible();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("starts on the Lagekarte on the desktop", () => {
    stubMatchMedia(true);
    try {
      renderWorkspace();
      expect(
        screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
          selector: "button",
        }),
      ).toBeVisible();
      expect(screen.getByLabelText("Neuer Eintrag")).not.toBeVisible();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the main view when the width crosses 768 px", () => {
    const { fireChange } = stubMatchMedia(false);
    try {
      renderWorkspace();
      expect(screen.getByLabelText("Neuer Eintrag")).toBeVisible();

      // Die Breite überschreitet 768 px. Selbst wenn ein Listener registriert
      // wäre (was er nicht sein soll), darf sich die Hauptansicht dadurch
      // nicht ändern – sie steht seit dem ersten Rendern fest.
      act(() => {
        fireChange(true);
      });

      expect(screen.getByLabelText("Neuer Eintrag")).toBeVisible();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('carries data-main-view="default" in the server-rendered markup', () => {
    const { props } = buildProps();
    const html = renderToString(
      <Providers>
        <SituationWorkspace {...props} />
      </Providers>,
    );
    expect(html).toContain('data-main-view="default"');
  });

  it("hides the phone bar while the on-screen keyboard is open, even with the field still focused", () => {
    const viewport = stubVisualViewport(window.innerHeight);
    try {
      renderWorkspace();
      const phoneBar = () => screen.queryByRole("contentinfo");
      expect(
        within(phoneBar() as HTMLElement).getByText("Lagekarte"),
      ).toBeInTheDocument();

      screen.getByLabelText("Neuer Eintrag").focus();
      act(() => viewport.resizeTo(window.innerHeight - 300));
      expect(phoneBar()).toBeNull();
      expect(footerOffsetReleased()).toBe(true);

      act(() => viewport.resizeTo(window.innerHeight));
      expect(screen.getByLabelText("Neuer Eintrag")).toHaveFocus();
      expect(phoneBar()).toBeInTheDocument();
      expect(footerOffsetReleased()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("opens no map panel at start", () => {
    stubMatchMedia(true);
    try {
      renderWorkspace();
      expect(anyMapPanel()).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("switches and closes map panels via the controls and ✕", async () => {
    renderWorkspace();
    await openPanel("Kartenzeichen");
    expect(mapPanel("Kartenzeichen")).toBeVisible();
    expect(
      screen.getByLabelText("Kartenzeichen", { selector: "button" }),
    ).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(
      screen.getByLabelText("Bereiche", { selector: "button" }),
    );
    expect(mapPanel("Bereiche")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Kartenzeichen" })).toBeNull();

    await userEvent.click(
      screen.getByLabelText("Bereiche", { selector: "button" }),
    );
    expect(anyMapPanel()).toBeNull();

    await userEvent.click(
      screen.getByLabelText("Ebenen", { selector: "button" }),
    );
    await userEvent.click(
      within(mapPanel("Ebenen")).getByLabelText("Schließen", {
        selector: "button",
      }),
    );
    expect(anyMapPanel()).toBeNull();
  });

  it("marks the Lagekarte while a map panel is open", async () => {
    renderWorkspace();
    await selectMainView("Lagekarte");
    const map = document.querySelector('[data-view="map"]');
    expect(map).not.toHaveAttribute("data-panel-open");

    await openPanel("Ebenen");
    expect(map).toHaveAttribute("data-panel-open");
  });

  it("keeps the open map panel when switching to the ETB and back", async () => {
    renderWorkspace();
    await openPanel("Ebenen");
    await selectMainView("ETB");
    await selectMainView("Lagekarte");
    expect(mapPanel("Ebenen")).toBeVisible();
  });

  it("keeps the open map panel as the right panel when the width crosses 768 px", async () => {
    const { fireChange } = stubMatchMedia(false);
    try {
      renderWorkspace();
      await openPanel("Kartenzeichen");
      act(() => {
        fireChange(true);
      });
      expect(mapPanel("Kartenzeichen")).toBeVisible();

      // Jetzt Desktop-Form: Scharfstellen lässt das Panel stehen.
      await userEvent.click(screen.getByText(/KTW/));
      expect(mapPanel("Kartenzeichen")).toBeVisible();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("saves the current map view as the default after confirming", async () => {
    const onSetDefault = vi.fn(async () => ({}));
    const { captured } = renderWorkspace({ onSetDefault });
    await selectMainView("Lagekarte");
    await waitFor(() => expect(captured.options).toBeDefined());
    await userEvent.click(
      screen.getByLabelText("Standard-Ausschnitt festlegen", {
        selector: "button",
      }),
    );
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByText("Festlegen"),
    );
    expect(onSetDefault).toHaveBeenCalledWith({ lat: 0, lng: 0, zoom: 1 });
  });

  it("does not save a default view before the map has loaded", async () => {
    // Der echte Leaflet-Adapter wird dynamisch geladen; hängt das Laden, gibt es
    // noch keine Karte und damit keinen Ausschnitt.
    vi.doMock("./leaflet-adapter", () => new Promise(() => {}));
    try {
      const onSetDefault = vi.fn(async () => ({}));
      renderWorkspace({ onSetDefault, factory: undefined });
      await selectMainView("Lagekarte");
      await userEvent.click(
        screen.getByLabelText("Standard-Ausschnitt festlegen", {
          selector: "button",
        }),
      );
      const dialog = await screen.findByRole("dialog");
      await userEvent.click(within(dialog).getByText("Festlegen"));

      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Die Karte lädt noch. Bitte erneut versuchen.",
      );
      expect(onSetDefault).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("./leaflet-adapter");
    }
  });

  describe("closing the sheet on a phone", () => {
    beforeEach(() => {
      stubMatchMedia(false);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("closes it when a Schnellauswahl symbol is armed", async () => {
      renderWorkspace();
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      expect(anyMapPanel()).toBeNull();
    });

    it("closes it when an Erweitert composition is armed", async () => {
      renderWorkspace();
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText("Erweitert …"));
      expect(mapPanel("Kartenzeichen")).toBeInTheDocument();
      await userEvent.click(
        within(await screen.findByRole("dialog")).getByText("Platzieren"),
      );
      expect(anyMapPanel()).toBeNull();
    });

    it("closes it when drawing a Bereich starts", async () => {
      renderWorkspace();
      await openPanel("Bereiche");
      await userEvent.click(screen.getByText("Polygon"));
      expect(anyMapPanel()).toBeNull();
    });

    it("closes it when a Bereich is redrawn", async () => {
      renderWorkspace({ areas: [AREA] });
      await openPanel("Bereiche");
      await userEvent.click(
        screen.getByLabelText("Deich bearbeiten", { selector: "button" }),
      );
      await userEvent.click(
        within(await screen.findByRole("dialog")).getByText(
          "Form neu zeichnen",
        ),
      );
      expect(anyMapPanel()).toBeNull();
    });

    it("closes it when a Kartenzeichen is jumped to from the list", async () => {
      renderWorkspace({ symbols: [SYMBOL] });
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText("Pumpe 1"));
      expect(anyMapPanel()).toBeNull();
    });

    it("closes it when a Bereich is jumped to from the list", async () => {
      renderWorkspace({ areas: [AREA] });
      await openPanel("Bereiche");
      await userEvent.click(screen.getByText("Deich"));
      expect(anyMapPanel()).toBeNull();
    });

    it("closes it when editing an image overlay starts", async () => {
      renderWorkspace({ imageOverlays: [anImageOverlay] });
      await startEditingImage();
      expect(anyMapPanel()).toBeNull();
    });

    it("closes it when a map action fails, so the error is not hidden under it", async () => {
      const { captured } = renderWorkspace({
        onPlace: vi.fn(async () => ({
          error: "Ungültige Zeichen-Komposition.",
        })),
      });
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      await openPanel("Kartenzeichen");
      await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
      await act(async () => {
        captured.options!.onMapClick!({ lat: 50, lng: 8 });
      });
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(anyMapPanel()).toBeNull();
    });

    it("keeps it open when a Schnellauswahl symbol is disarmed", async () => {
      renderWorkspace();
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      expect(mapPanel("Kartenzeichen")).toBeVisible();
    });

    it("keeps it open when drawing is toggled off", async () => {
      renderWorkspace();
      await openPanel("Bereiche");
      await userEvent.click(screen.getByText("Polygon"));
      await openPanel("Bereiche");
      await userEvent.click(screen.getByText("Polygon"));
      expect(mapPanel("Bereiche")).toBeVisible();
    });

    it("keeps the right panel open on the desktop", async () => {
      stubMatchMedia(true);
      renderWorkspace();
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      expect(mapPanel("Kartenzeichen")).toBeVisible();
    });
  });

  it("shows the ETB as the default main view on a phone and adds an entry", async () => {
    const onAddJournalEntry = vi.fn(async () => ({}));
    renderWorkspace({
      onAddJournalEntry,
      journalEntries: [
        {
          id: "e1",
          number: 1,
          createdAt: "2026-07-03T08:00:00.000Z",
          text: "Einsatz eröffnet",
          type: "einsatz-eröffnet",
          state: "gueltig",
          author: null,
          editedAt: null,
          revisions: [],
        },
      ],
    });
    expect(screen.getByText("Einsatz eröffnet")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Neuer Eintrag"), {
      target: { value: "Deich gesichert" },
    });
    await userEvent.click(screen.getByText("Eintrag hinzufügen"));
    expect(onAddJournalEntry).toHaveBeenCalledWith("Deich gesichert");
  });

  it("places the armed Schnellauswahl composition where the map is clicked", async () => {
    const onPlace = vi.fn(async () => ({}));
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });

    const ktw = QUICK_SELECT.find((i) => i.label === "KTW")!;
    expect(onPlace).toHaveBeenCalledWith(ktw.composition, 50, 8);
  });

  it("surfaces a returned {error} from placing a Kartenzeichen", async () => {
    const onPlace = vi.fn(async () => ({
      error: "Ungültige Zeichen-Komposition.",
    }));
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });
    expect(
      await screen.findByText("Ungültige Zeichen-Komposition."),
    ).toBeInTheDocument();
  });

  it("surfaces a fallback when placing throws instead of returning an {error}", async () => {
    const onPlace = vi.fn(async () => {
      throw new Error("boom");
    });
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /fehlgeschlagen/i,
    );
  });

  it("shows a placement error as an overlay inside the map container, not a banner above the work area", async () => {
    const onPlace = vi.fn(async () => ({
      error: "Ungültige Zeichen-Komposition.",
    }));
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });
    const alert = await screen.findByRole("alert");
    expect(alert.closest('[data-view="map"]')).not.toBeNull();
  });

  it("clears a placement error on the next successful placement", async () => {
    const onPlace = vi
      .fn<SituationWorkspaceProps["onPlace"]>()
      .mockResolvedValueOnce({ error: "Ungültige Zeichen-Komposition." })
      .mockResolvedValueOnce({});
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // Erneut scharfstellen und platzieren – der alte Fehler verschwindet.
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 51, lng: 9 });
    });
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("ends the placing mode after one Kartenzeichen, even while onPlace is still in flight", async () => {
    // onPlace bleibt hängen (Server-Roundtrip): der Modus muss trotzdem sofort
    // enden, sonst platziert ein zweiter Tap während des Roundtrips ein zweites Zeichen.
    let resolvePlace: () => void = () => {};
    const onPlace = vi.fn(
      () =>
        new Promise<{ error?: string }>((r) => {
          resolvePlace = () => r({});
        }),
    );
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });
    captured.options!.onMapClick!({ lat: 51, lng: 9 });

    expect(onPlace).toHaveBeenCalledTimes(1);
    resolvePlace();
  });

  it("places a composition built in the Erweitert form where the map is clicked", async () => {
    const onPlace = vi.fn(async () => ({}));
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/Erweitert/));
    await userEvent.click(await screen.findByText("Platzieren"));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 51, lng: 7 });
    });

    expect(onPlace).toHaveBeenCalledWith(
      expect.objectContaining({
        organisation: "hilfsorganisation",
        grundzeichen: "taktische-formation",
      }),
      51,
      7,
    );
  });

  it("centers the map on a Kartenzeichen when its list row is clicked, without opening the detail", async () => {
    const { adapter } = renderWorkspace({
      symbols: [
        {
          id: "s1",
          lat: 53.5,
          lng: 9.9,
          composition: {
            grundzeichen: "taktische-formation",
            organisation: "hilfsorganisation",
            text: "Rotkreuz 83/1",
          },
        },
      ],
    });
    await openPanel("Kartenzeichen");
    await userEvent.click(await screen.findByText("Rotkreuz 83/1"));
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 53.5,
        lng: 9.9,
        zoom: 16,
      }),
    );
    expect(screen.queryByLabelText("Bezeichnung")).toBeNull();
  });

  it("opens the detail via the row edit button", async () => {
    renderWorkspace({
      symbols: [
        {
          id: "s1",
          lat: 53.5,
          lng: 9.9,
          composition: {
            grundzeichen: "taktische-formation",
            organisation: "hilfsorganisation",
            text: "Rotkreuz 83/1",
          },
        },
      ],
    });
    await openPanel("Kartenzeichen");
    await userEvent.click(
      await screen.findByLabelText(/Rotkreuz 83\/1 bearbeiten/, {
        selector: "button",
      }),
    );
    expect(await screen.findByLabelText("Bezeichnung")).toHaveValue(
      "Rotkreuz 83/1",
    );
  });

  it("shows an empty state in the Kartenzeichen panel when none are placed", async () => {
    renderWorkspace({ symbols: [] });
    await openPanel("Kartenzeichen");
    expect(
      await screen.findByText(/Noch keine Kartenzeichen/),
    ).toBeInTheDocument();
  });

  it("badges a fresh device symbol as live and a stale one as veraltet in the list", async () => {
    const comp = {
      grundzeichen: "ortsfeste-stelle" as const,
      organisation: "hilfsorganisation" as const,
    };
    renderWorkspace({
      symbols: [
        {
          id: "fresh",
          lat: 1,
          lng: 2,
          composition: comp,
          positionSource: "device",
          reportedAt: new Date(Date.now() - 10 * 1000),
        },
        {
          id: "stale",
          lat: 3,
          lng: 4,
          composition: { ...comp, text: "THW 1" },
          positionSource: "device",
          reportedAt: new Date(Date.now() - 4 * 60 * 1000),
        },
      ],
    });
    await openPanel("Kartenzeichen");
    expect(await screen.findByText("Ohne Bezeichnung")).toBeInTheDocument(); // Fallback ohne Bezeichnung
    expect(screen.getByText("live")).toBeInTheDocument();
    expect(screen.getByText("veraltet")).toBeInTheDocument();
  });

  it("geocodes the address query (debounced) and shows the result", async () => {
    const onGeocode = vi.fn(async () => [
      { label: "Rathaus, Hamburg", lat: 53.55, lng: 9.99 },
    ]);
    renderWorkspace({ onGeocode });
    await selectMainView("Lagekarte");
    fireEvent.change(screen.getByLabelText("Suche"), {
      target: { value: "Hamburg" },
    });
    await waitFor(() => expect(onGeocode).toHaveBeenCalledWith("Hamburg"));
    expect(await screen.findByText(/Rathaus, Hamburg/)).toBeInTheDocument();
  });

  it("jumps the map to a searched Kartenzeichen", async () => {
    const { adapter } = renderWorkspace({
      symbols: [
        {
          id: "s1",
          lat: 53.5,
          lng: 9.9,
          composition: {
            grundzeichen: "taktische-formation",
            organisation: "hilfsorganisation",
            text: "Rotkreuz 83/1",
          },
        },
      ],
    });
    await selectMainView("Lagekarte");
    fireEvent.change(screen.getByLabelText("Suche"), {
      target: { value: "Rotkreuz" },
    });
    // Ein Kartenzeichen mit demselben Namen kann gleichzeitig im offenen
    // Kartenzeichen-Panel stehen; auf das Suchergebnis beschränken.
    const results = within(
      (await screen.findByText("Einsatzobjekte")).parentElement as HTMLElement,
    );
    await userEvent.click(results.getByText(/Rotkreuz 83\/1/));
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 53.5,
        lng: 9.9,
        zoom: 16,
      }),
    );
  });

  it("draws a Bereich: arming a shape then completing creates the area", async () => {
    const onCreateArea = vi.fn(async () => ({}));
    const { adapter } = renderWorkspace({ onCreateArea });
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText("Polygon"));
    await waitFor(() =>
      expect(adapter.startDrawing).toHaveBeenCalledWith(
        "polygon",
        expect.any(Function),
      ),
    );
    const onComplete = adapter.startDrawing.mock.calls.at(-1)![1] as (
      g: unknown,
    ) => void;
    const geometry = {
      shape: "polygon",
      points: [
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
        { lat: 5, lng: 6 },
      ],
    };
    await act(async () => {
      onComplete(geometry);
    });
    expect(onCreateArea).toHaveBeenCalledWith(geometry);
  });

  it("surfaces a returned {error} from completing a draw", async () => {
    const onCreateArea = vi.fn(async () => ({
      error: "Der Radius muss größer als 0 sein.",
    }));
    const { adapter } = renderWorkspace({ onCreateArea });
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText("Polygon"));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    const onComplete = adapter.startDrawing.mock.calls.at(-1)![1] as (
      g: unknown,
    ) => void;
    await act(async () => {
      onComplete({ shape: "polygon", points: [{ lat: 1, lng: 2 }] });
    });
    expect(
      await screen.findByText("Der Radius muss größer als 0 sein."),
    ).toBeInTheDocument();
    // Der Zeichenmodus endet trotzdem: erneutes Scharfstellen ist möglich.
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText("Polygon"));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalledTimes(2));
  });

  it("surfaces a fallback when completing a draw throws", async () => {
    const onCreateArea = vi.fn(async () => {
      throw new Error("boom");
    });
    const { adapter } = renderWorkspace({ onCreateArea });
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText("Polygon"));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    const onComplete = adapter.startDrawing.mock.calls.at(-1)![1] as (
      g: unknown,
    ) => void;
    await act(async () => {
      onComplete({ shape: "polygon", points: [{ lat: 1, lng: 2 }] });
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /fehlgeschlagen/i,
    );
  });

  it("surfaces a returned {error} when redrawing an area geometry", async () => {
    const onUpdateAreaGeometry = vi.fn(async () => ({
      error: "Der Radius muss größer als 0 sein.",
    }));
    const { adapter } = renderWorkspace({
      areas: [
        {
          id: "a1",
          geometry: { shape: "polygon", points: [{ lat: 1, lng: 2 }] },
          color: "#000",
          opacity: 0.4,
          label: "Z",
        },
      ],
      onUpdateAreaGeometry,
    });
    await openPanel("Bereiche");
    await userEvent.click(
      await screen.findByLabelText(/Z bearbeiten/, { selector: "button" }),
    );
    await userEvent.click(await screen.findByText(/Form neu zeichnen/));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    await act(async () => {
      (adapter.startDrawing.mock.calls.at(-1)![1] as (g: unknown) => void)({
        shape: "polygon",
        points: [{ lat: 9, lng: 9 }],
      });
    });
    expect(
      await screen.findByText("Der Radius muss größer als 0 sein."),
    ).toBeInTheDocument();
  });

  it("lists Bereiche and opens the area editor via the row edit button", async () => {
    const onDeleteArea = vi.fn();
    const area = {
      id: "a1",
      geometry: {
        shape: "circle" as const,
        center: { lat: 1, lng: 2 },
        radius: 100,
      },
      color: "#e2001a",
      opacity: 0.4,
      label: "Zone Nord",
    };
    renderWorkspace({ areas: [area], onDeleteArea });
    await openPanel("Bereiche");
    await userEvent.click(
      await screen.findByLabelText(/Zone Nord bearbeiten/, {
        selector: "button",
      }),
    );
    await userEvent.click(await screen.findByText("Löschen"));
    expect(onDeleteArea).toHaveBeenCalledWith("a1");
  });

  it("centers the map on a Bereich when its list row is clicked, without opening the detail", async () => {
    const area = {
      id: "a1",
      geometry: {
        shape: "circle" as const,
        center: { lat: 53.5, lng: 9.9 },
        radius: 100,
      },
      color: "#e2001a",
      opacity: 0.4,
      label: "Zone Nord",
    };
    const { adapter } = renderWorkspace({ areas: [area] });
    await openPanel("Bereiche");
    await userEvent.click(await screen.findByText("Zone Nord"));
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 53.5,
        lng: 9.9,
        zoom: 16,
      }),
    );
    expect(screen.queryByLabelText("Farbe (Hex)")).toBeNull();
  });

  it("does not open the area editor when a Bereich is clicked on the map", async () => {
    const area = {
      id: "a1",
      geometry: {
        shape: "circle" as const,
        center: { lat: 1, lng: 2 },
        radius: 100,
      },
      color: "#e2001a",
      opacity: 0.4,
      label: "Zone",
    };
    const { adapter } = renderWorkspace({ areas: [area] });
    await waitFor(() =>
      expect(adapter.setArea).toHaveBeenCalledWith("a1", expect.anything()),
    );
    expect(
      (adapter.setArea.mock.calls.at(-1)![1] as { onClick?: () => void })
        .onClick,
    ).toBeUndefined();
  });

  it("saves an area style from the row editor, then surfaces a save error", async () => {
    const onUpdateAreaStyle = vi
      .fn<SituationWorkspaceProps["onUpdateAreaStyle"]>()
      .mockRejectedValueOnce(new Error("boom"));
    const area = {
      id: "a1",
      geometry: {
        shape: "circle" as const,
        center: { lat: 1, lng: 2 },
        radius: 100,
      },
      color: "#e2001a",
      opacity: 0.4,
      label: "Zone",
    };
    renderWorkspace({ areas: [area], onUpdateAreaStyle });
    await openPanel("Bereiche");
    await userEvent.click(
      await screen.findByLabelText(/Zone bearbeiten/, { selector: "button" }),
    );
    await userEvent.click(await screen.findByText("Speichern"));
    expect(onUpdateAreaStyle).toHaveBeenCalledWith("a1", {
      color: "#e2001a",
      opacity: 0.4,
      label: "Zone",
    });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("surfaces a returned {error} from an area action in the panel", async () => {
    const onUpdateAreaStyle = vi
      .fn<SituationWorkspaceProps["onUpdateAreaStyle"]>()
      .mockResolvedValueOnce({
        error: "Die Deckkraft muss zwischen 0 und 1 liegen.",
      });
    const area = {
      id: "a1",
      geometry: {
        shape: "circle" as const,
        center: { lat: 1, lng: 2 },
        radius: 100,
      },
      color: "#e2001a",
      opacity: 0.4,
      label: "Zone",
    };
    renderWorkspace({ areas: [area], onUpdateAreaStyle });
    await openPanel("Bereiche");
    await userEvent.click(
      await screen.findByLabelText(/Zone bearbeiten/, { selector: "button" }),
    );
    await userEvent.click(await screen.findByText("Speichern"));
    expect(
      await screen.findByText("Die Deckkraft muss zwischen 0 und 1 liegen."),
    ).toBeInTheDocument();
  });

  describe("changing a circle's radius in the area editor", () => {
    const LEGACY_CIRCLE = {
      ...AREA,
      geometry: { ...AREA.geometry, radius: 463.27 },
    };

    const openEditor = async () => {
      await openPanel("Bereiche");
      await userEvent.click(
        await screen.findByLabelText(/Deich bearbeiten/, {
          selector: "button",
        }),
      );
    };
    const typeRadius = async (value: string) => {
      const radius = await screen.findByLabelText(/Radius/);
      await userEvent.clear(radius);
      await userEvent.type(radius, value);
    };
    const save = () => userEvent.click(screen.getByText("Speichern"));

    it("shows no radius field for a polygon", async () => {
      renderWorkspace({
        areas: [
          {
            ...AREA,
            geometry: {
              shape: "polygon",
              points: [
                { lat: 1, lng: 1 },
                { lat: 1, lng: 2 },
                { lat: 2, lng: 2 },
              ],
            },
          },
        ],
      });
      await openEditor();
      expect(await screen.findByLabelText(/Beschriftung/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Radius/)).not.toBeInTheDocument();
    });

    it("saves a changed radius around the centre the client currently knows", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => ({}));
      const onUpdateAreaStyle = vi.fn(async () => ({}));
      const { props } = buildProps({
        areas: [LEGACY_CIRCLE],
        onUpdateAreaGeometry,
        onUpdateAreaStyle,
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await openEditor();
      await typeRadius("250");

      const moved = { lat: 54, lng: 10 };
      rerender(
        <SituationWorkspace
          {...props}
          areas={[
            {
              ...LEGACY_CIRCLE,
              geometry: { ...LEGACY_CIRCLE.geometry, center: moved },
            },
          ]}
        />,
      );
      await save();

      expect(onUpdateAreaGeometry).toHaveBeenCalledWith("a1", {
        shape: "circle",
        center: moved,
        radius: 250,
      });
      expect(onUpdateAreaStyle).toHaveBeenCalledWith("a1", {
        color: "#e2001a",
        opacity: 0.4,
        label: "Deich",
      });
      await waitFor(() =>
        expect(screen.queryByLabelText(/Radius/)).not.toBeInTheDocument(),
      );
    });

    it("saves only the style when the radius is unchanged", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => ({}));
      const onUpdateAreaStyle = vi.fn(async () => ({}));
      renderWorkspace({
        areas: [LEGACY_CIRCLE],
        onUpdateAreaGeometry,
        onUpdateAreaStyle,
      });
      await openEditor();
      expect(await screen.findByLabelText(/Radius/)).toHaveValue("463,27 m");
      await save();

      expect(onUpdateAreaStyle).toHaveBeenCalled();
      expect(onUpdateAreaGeometry).not.toHaveBeenCalled();
    });

    it("does not overwrite a radius changed elsewhere while the editor was open", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => ({}));
      const { props } = buildProps({
        areas: [LEGACY_CIRCLE],
        onUpdateAreaGeometry,
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await openEditor();
      await screen.findByLabelText(/Radius/);

      rerender(
        <SituationWorkspace
          {...props}
          areas={[
            {
              ...LEGACY_CIRCLE,
              geometry: { ...LEGACY_CIRCLE.geometry, radius: 300 },
            },
          ]}
        />,
      );
      await save();

      expect(props.onUpdateAreaStyle).toHaveBeenCalled();
      expect(onUpdateAreaGeometry).not.toHaveBeenCalled();
    });

    it("does not write the style when the radius save fails", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => ({
        error: "Bereich nicht gefunden.",
      }));
      const onUpdateAreaStyle = vi.fn(async () => ({}));
      renderWorkspace({
        areas: [LEGACY_CIRCLE],
        onUpdateAreaGeometry,
        onUpdateAreaStyle,
      });
      await openEditor();
      await typeRadius("250");
      await save();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Bereich nicht gefunden.",
      );
      expect(onUpdateAreaGeometry).toHaveBeenCalled();
      expect(onUpdateAreaStyle).not.toHaveBeenCalled();
    });

    it("does not write the style when the radius save throws", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => {
        throw new Error("boom");
      });
      const onUpdateAreaStyle = vi.fn(async () => ({}));
      renderWorkspace({
        areas: [LEGACY_CIRCLE],
        onUpdateAreaGeometry,
        onUpdateAreaStyle,
      });
      await openEditor();
      await typeRadius("250");
      await save();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Speichern fehlgeschlagen.",
      );
      expect(onUpdateAreaStyle).not.toHaveBeenCalled();
    });

    it("shows the error when the style fails after the radius was saved", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => ({}));
      const onUpdateAreaStyle = vi.fn(async () => ({
        error: "Die Deckkraft muss zwischen 0 und 1 liegen.",
      }));
      renderWorkspace({
        areas: [LEGACY_CIRCLE],
        onUpdateAreaGeometry,
        onUpdateAreaStyle,
      });
      await openEditor();
      await typeRadius("250");
      await save();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Die Deckkraft muss zwischen 0 und 1 liegen.",
      );
      expect(onUpdateAreaGeometry).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({ radius: 250 }),
      );
    });
  });

  describe("moving a circle", () => {
    const POLYGON = {
      ...AREA,
      id: "p1",
      label: "Feld",
      geometry: {
        shape: "polygon" as const,
        points: [
          { lat: 1, lng: 1 },
          { lat: 1, lng: 2 },
          { lat: 2, lng: 2 },
        ],
      },
    };
    const LINE = {
      ...AREA,
      id: "l1",
      label: "Sperre",
      geometry: {
        shape: "line" as const,
        points: [
          { lat: 1, lng: 1 },
          { lat: 1, lng: 2 },
        ],
      },
    };
    const MAP_CENTRE = { lat: 54, lng: 10, zoom: 15 };

    beforeEach(() => {
      stubMatchMedia(true);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const openEditor = async (label = "Deich") => {
      await openPanel("Bereiche");
      await userEvent.click(
        await screen.findByLabelText(`${label} bearbeiten`, {
          selector: "button",
        }),
      );
      return screen.findByRole("dialog");
    };
    const startMoving = async () => {
      await userEvent.click(
        within(await openEditor()).getByText("Verschieben"),
      );
    };
    const movingBand = () =>
      screen.queryByRole("toolbar", { name: "Kreis verschieben" });
    const crosshair = () => document.querySelector(".map-crosshair");
    const setHere = () =>
      userEvent.click(
        within(modeBand("Kreis verschieben")).getByText("Hier setzen"),
      );
    const cancel = () =>
      userEvent.click(
        within(modeBand("Kreis verschieben")).getByText("Abbrechen"),
      );

    it("offers Verschieben only for circles", async () => {
      renderWorkspace({ areas: [AREA, POLYGON, LINE] });
      expect(
        within(await openEditor()).getByText("Verschieben"),
      ).toBeInTheDocument();
      for (const label of ["Feld", "Sperre"]) {
        await userEvent.keyboard("{Escape}");
        await waitFor(() =>
          expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        );
        await userEvent.click(
          screen.getByLabelText(`${label} bearbeiten`, { selector: "button" }),
        );
        const dialog = await screen.findByRole("dialog");
        expect(
          within(dialog).getByText("Form neu zeichnen"),
        ).toBeInTheDocument();
        expect(
          within(dialog).queryByText("Verschieben"),
        ).not.toBeInTheDocument();
      }
    });

    it("Verschieben closes the editor and, on a phone, the panel, and starts moving", async () => {
      stubMatchMedia(false);
      const { adapter } = renderWorkspace({ areas: [AREA] });
      expect(movingBand()).toBeNull();
      expect(crosshair()).toBeNull();
      await startMoving();

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(anyMapPanel()).toBeNull();
      expect(movingBand()).toBeInTheDocument();
      expect(crosshair()).toHaveAttribute("aria-hidden", "true");
      await waitFor(() =>
        expect(adapter.startCirclePreview).toHaveBeenCalledWith({
          radius: 100,
          color: "#e2001a",
          opacity: 0.4,
        }),
      );
      expect(adapter.removeArea).toHaveBeenCalledWith("a1");
    });

    it("Verschieben keeps the panel open on the desktop", async () => {
      renderWorkspace({ areas: [AREA] });
      await startMoving();
      expect(movingBand()).toBeInTheDocument();
      expect(mapPanel("Bereiche")).toBeVisible();
    });

    it("Hier setzen saves the map centre with the latest radius once and ends moving", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => ({}));
      const { props, adapter } = buildProps({
        areas: [AREA],
        onUpdateAreaGeometry,
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await startMoving();
      rerender(
        <SituationWorkspace
          {...props}
          areas={[{ ...AREA, geometry: { ...AREA.geometry, radius: 400 } }]}
        />,
      );
      adapter.getView = () => MAP_CENTRE;
      await setHere();

      expect(onUpdateAreaGeometry).toHaveBeenCalledTimes(1);
      expect(onUpdateAreaGeometry).toHaveBeenCalledWith("a1", {
        shape: "circle",
        center: { lat: 54, lng: 10 },
        radius: 400,
      });
      await waitFor(() => expect(movingBand()).toBeNull());
      expect(crosshair()).toBeNull();
      expect(adapter.stopCirclePreview).toHaveBeenCalled();
      expect(mapPanel("Bereiche")).toBeVisible();
    });

    it("a second tap while saving does not write again", async () => {
      let finish: (r: object) => void = () => {};
      const onUpdateAreaGeometry = vi.fn(
        () => new Promise<object>((resolve) => (finish = resolve)),
      );
      renderWorkspace({ areas: [AREA], onUpdateAreaGeometry });
      await startMoving();
      await setHere();
      const setButton = buttonWithText(
        "Hier setzen",
        modeBand("Kreis verschieben"),
      );
      expect(setButton).toBeDisabled();
      fireEvent.click(setButton);
      expect(onUpdateAreaGeometry).toHaveBeenCalledTimes(1);
      // Cancelling cannot undo a write already sent.
      expect(
        buttonWithText("Abbrechen", modeBand("Kreis verschieben")),
      ).toBeDisabled();

      await act(async () => finish({}));
      await waitFor(() => expect(movingBand()).toBeNull());
    });

    it("a save finishing after another mode started does not end that mode", async () => {
      let finish: (r: object) => void = () => {};
      const onUpdateAreaGeometry = vi.fn(
        () => new Promise<object>((resolve) => (finish = resolve)),
      );
      renderWorkspace({ areas: [AREA], onUpdateAreaGeometry });
      await startMoving();
      await setHere();
      await userEvent.click(screen.getByText("Polygon"));

      await act(async () => finish({}));
      expect(modeBand("Bereich zeichnen")).toBeInTheDocument();
    });

    it("a failed save keeps moving and shows the error; Abbrechen restores the saved circle", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => ({
        error: "Ungültige Geometrie.",
      }));
      const { adapter } = renderWorkspace({
        areas: [AREA],
        onUpdateAreaGeometry,
      });
      await startMoving();
      await setHere();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Ungültige Geometrie.",
      );
      expect(movingBand()).toBeInTheDocument();
      expect(
        buttonWithText("Hier setzen", modeBand("Kreis verschieben")),
      ).toBeEnabled();

      adapter.setArea.mockClear();
      await cancel();
      expect(movingBand()).toBeNull();
      await waitFor(() =>
        expect(adapter.setArea).toHaveBeenCalledWith(
          "a1",
          expect.objectContaining({ geometry: AREA.geometry }),
        ),
      );
    });

    it("a thrown save keeps moving and shows the fallback error", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => {
        throw new Error("db down");
      });
      renderWorkspace({ areas: [AREA], onUpdateAreaGeometry });
      await startMoving();
      await setHere();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Aktion fehlgeschlagen",
      );
      expect(movingBand()).toBeInTheDocument();
    });

    it("Abbrechen ends moving without saving", async () => {
      const onUpdateAreaGeometry = vi.fn(async () => ({}));
      const { adapter } = renderWorkspace({
        areas: [AREA],
        onUpdateAreaGeometry,
      });
      await startMoving();
      await cancel();

      expect(movingBand()).toBeNull();
      expect(crosshair()).toBeNull();
      await waitFor(() => expect(adapter.stopCirclePreview).toHaveBeenCalled());
      expect(onUpdateAreaGeometry).not.toHaveBeenCalled();
      expect(mapPanel("Bereiche")).toBeVisible();
    });

    it("ends moving when the circle disappears", async () => {
      const { props } = buildProps({ areas: [AREA] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await startMoving();
      rerender(<SituationWorkspace {...props} areas={[]} />);

      await waitFor(() => expect(movingBand()).toBeNull());
      expect(crosshair()).toBeNull();
    });

    it("starting to draw ends moving", async () => {
      renderWorkspace({ areas: [AREA] });
      await startMoving();
      await userEvent.click(screen.getByText("Polygon"));

      expect(movingBand()).toBeNull();
      expect(modeBand("Bereich zeichnen")).toBeInTheDocument();
    });

    it("switching to the ETB ends moving", async () => {
      renderWorkspace({ areas: [AREA] });
      await startMoving();
      await selectMainView("ETB");
      await selectMainView("Lagekarte");

      expect(movingBand()).toBeNull();
    });
  });

  describe("opening the area editor after drawing", () => {
    const CIRCLE = {
      shape: "circle" as const,
      center: { lat: 53.5, lng: 9.9 },
      radius: 250,
    };
    const POLYGON = {
      shape: "polygon" as const,
      points: [
        { lat: 1, lng: 1 },
        { lat: 1, lng: 2 },
        { lat: 2, lng: 2 },
      ],
    };
    const LINE = {
      shape: "line" as const,
      points: [
        { lat: 1, lng: 1 },
        { lat: 1, lng: 2 },
      ],
    };

    const draw = async (
      adapter: ReturnType<typeof buildProps>["adapter"],
      shapeLabel: string,
      geometry: AreaGeometry,
    ) => {
      await openPanel("Bereiche");
      // Die Formknöpfe sind Umschalter; eine Bereichszeile nennt ihre Form auch.
      await userEvent.click(
        screen.getByText(shapeLabel, { selector: "[aria-pressed] *" }),
      );
      await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
      await act(async () => {
        (adapter.startDrawing.mock.calls.at(-1)![1] as (g: unknown) => void)(
          geometry,
        );
      });
    };
    const arrive = (
      rerender: (ui: React.ReactElement) => void,
      props: SituationWorkspaceProps,
      geometry: AreaGeometry,
    ) =>
      rerender(
        <SituationWorkspace
          {...props}
          areas={[{ ...AREA, id: "a9", label: "", geometry }]}
        />,
      );
    const editor = () => screen.queryByRole("dialog", { name: "Bereich" });

    it("opens the editor for a newly drawn circle once it arrives", async () => {
      const { adapter, props } = buildProps({
        onCreateArea: vi.fn(async () => ({ id: "a9" })),
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await draw(adapter, "Kreis", CIRCLE);
      expect(editor()).not.toBeInTheDocument();

      arrive(rerender, props, CIRCLE);

      expect(
        await screen.findByRole("dialog", { name: "Bereich" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Radius/)).toHaveValue("250 m");
    });

    it.each([
      ["Polygon", POLYGON],
      ["Linie", LINE],
    ] as const)(
      "does not open the editor after drawing a %s",
      async (label, geometry) => {
        const { adapter, props } = buildProps({
          onCreateArea: vi.fn(async () => ({ id: "a9" })),
        });
        const { rerender } = render(<SituationWorkspace {...props} />);
        await draw(adapter, label, geometry);

        arrive(rerender, props, geometry);

        await act(async () => {});
        expect(editor()).not.toBeInTheDocument();
      },
    );

    it("does not open the editor after redrawing a circle", async () => {
      const { adapter, props } = buildProps({ areas: [AREA] });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await openPanel("Bereiche");
      await userEvent.click(
        await screen.findByLabelText(/Deich bearbeiten/, {
          selector: "button",
        }),
      );
      await userEvent.click(await screen.findByText(/Form neu zeichnen/));
      await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
      await act(async () => {
        (adapter.startDrawing.mock.calls.at(-1)![1] as (g: unknown) => void)(
          CIRCLE,
        );
      });

      rerender(
        <SituationWorkspace
          {...props}
          areas={[{ ...AREA, geometry: CIRCLE }]}
        />,
      );

      await act(async () => {});
      expect(editor()).not.toBeInTheDocument();
    });

    it("shows the new circle, not the area opened while it was being created", async () => {
      let created: (r: { id: string }) => void = () => {};
      const { adapter, props } = buildProps({
        areas: [AREA],
        onCreateArea: vi.fn(
          () =>
            new Promise<{ id: string }>((resolve) => {
              created = resolve;
            }),
        ),
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await draw(adapter, "Kreis", { ...CIRCLE, radius: 250 });
      await openPanel("Bereiche");
      await userEvent.click(
        await screen.findByLabelText(/Deich bearbeiten/, {
          selector: "button",
        }),
      );
      expect(await screen.findByLabelText(/Beschriftung/)).toHaveValue("Deich");

      rerender(
        <SituationWorkspace
          {...props}
          areas={[AREA, { ...AREA, id: "a9", label: "", geometry: CIRCLE }]}
        />,
      );
      await act(async () => created({ id: "a9" }));

      await waitFor(() =>
        expect(screen.getByLabelText(/Beschriftung/)).toHaveValue(""),
      );
      expect(screen.getByLabelText(/Radius/)).toHaveValue("250 m");
    });

    it("opens the editor for a new circle without an earlier area's save error", async () => {
      const { adapter, props } = buildProps({
        areas: [AREA],
        onUpdateAreaStyle: vi.fn(async () => ({ error: "Stil ungültig." })),
        onCreateArea: vi.fn(async () => ({ id: "a9" })),
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await openPanel("Bereiche");
      await userEvent.click(
        await screen.findByLabelText(/Deich bearbeiten/, {
          selector: "button",
        }),
      );
      await userEvent.click(screen.getByText("Speichern"));
      expect(await screen.findByText("Stil ungültig.")).toBeInTheDocument();
      await userEvent.click(screen.getByText(/Form neu zeichnen/));
      await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
      await act(async () => {
        (adapter.startDrawing.mock.calls.at(-1)![1] as (g: unknown) => void)(
          CIRCLE,
        );
      });

      await draw(adapter, "Kreis", CIRCLE);
      rerender(
        <SituationWorkspace
          {...props}
          areas={[AREA, { ...AREA, id: "a9", label: "", geometry: CIRCLE }]}
        />,
      );

      expect(
        await screen.findByRole("dialog", { name: "Bereich" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Stil ungültig.")).not.toBeInTheDocument();
    });

    it("does not open the editor when creating fails", async () => {
      const { adapter, props } = buildProps({
        onCreateArea: vi.fn(async () => ({
          error: "Der Radius muss größer als 0 sein.",
        })),
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await draw(adapter, "Kreis", { ...CIRCLE, radius: 0 });
      arrive(rerender, props, CIRCLE);

      expect(
        await screen.findByText("Der Radius muss größer als 0 sein."),
      ).toBeInTheDocument();
      expect(editor()).not.toBeInTheDocument();
    });

    it("does not open the editor when creating throws", async () => {
      const { adapter, props } = buildProps({
        onCreateArea: vi.fn(async () => {
          throw new Error("boom");
        }),
      });
      const { rerender } = render(<SituationWorkspace {...props} />);
      await draw(adapter, "Kreis", CIRCLE);
      arrive(rerender, props, CIRCLE);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /fehlgeschlagen/i,
      );
      expect(editor()).not.toBeInTheDocument();
    });
  });

  it("replaces an area geometry when redrawing", async () => {
    const onUpdateAreaGeometry = vi.fn(async () => ({}));
    const { adapter } = renderWorkspace({
      areas: [
        {
          id: "a1",
          geometry: { shape: "polygon", points: [{ lat: 1, lng: 2 }] },
          color: "#000",
          opacity: 0.4,
          label: "Z",
        },
      ],
      onUpdateAreaGeometry,
    });
    await openPanel("Bereiche");
    await userEvent.click(
      await screen.findByLabelText(/Z bearbeiten/, { selector: "button" }),
    );
    await userEvent.click(await screen.findByText(/Form neu zeichnen/));
    await waitFor(() =>
      expect(adapter.startDrawing).toHaveBeenCalledWith(
        "polygon",
        expect.any(Function),
      ),
    );
    const geometry = { shape: "polygon", points: [{ lat: 9, lng: 9 }] };
    await act(async () => {
      (adapter.startDrawing.mock.calls.at(-1)![1] as (g: unknown) => void)(
        geometry,
      );
    });
    expect(onUpdateAreaGeometry).toHaveBeenCalledWith("a1", geometry);
  });

  it.each([
    ["Linie", "line"],
    ["Kreis", "circle"],
  ])("arms drawing the %s shape", async (label, shape) => {
    const { adapter } = renderWorkspace();
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText(label));
    await waitFor(() =>
      expect(adapter.startDrawing).toHaveBeenCalledWith(
        shape,
        expect.any(Function),
      ),
    );
  });

  it("cancels drawing when the armed shape is toggled off", async () => {
    const { adapter } = renderWorkspace();
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText("Polygon"));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText("Polygon"));
    await waitFor(() => expect(adapter.cancelDrawing).toHaveBeenCalled());
  });

  it("shows the Kartenzeichen band while a Schnellauswahl symbol is armed and cancels it", async () => {
    renderWorkspace();
    await openPanel("Kartenzeichen");
    const ktw = buttonWithText(/KTW/);
    await userEvent.click(ktw);
    await userEvent.click(
      within(modeBand("Kartenzeichen platzieren")).getByText("Abbrechen"),
    );
    expect(ktw).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("shows the Kartenzeichen band while an Erweitert composition is armed", async () => {
    renderWorkspace();
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText("Erweitert …"));
    await userEvent.click(await screen.findByText("Platzieren"));
    expect(modeBand("Kartenzeichen platzieren")).toBeInTheDocument();
  });

  it("shows the Bereich band while drawing and cancels the drawing", async () => {
    const { adapter } = renderWorkspace();
    await openPanel("Bereiche");
    const polygon = buttonWithText("Polygon");
    await userEvent.click(polygon);
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    await userEvent.click(
      within(modeBand("Bereich zeichnen")).getByText("Abbrechen"),
    );
    await waitFor(() => expect(adapter.cancelDrawing).toHaveBeenCalled());
    expect(polygon).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("cancels an armed symbol when switching to the ETB", async () => {
    const onPlace = vi.fn(async () => ({}));
    const { captured } = renderWorkspace({ onPlace });
    await openPanel("Kartenzeichen");
    const ktw = buttonWithText(/KTW/);
    await userEvent.click(ktw);
    await selectMainView("ETB");
    await selectMainView("Lagekarte");
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(ktw).toHaveAttribute("aria-pressed", "false");
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("cancels drawing when switching to the ETB", async () => {
    const { adapter } = renderWorkspace();
    await openPanel("Bereiche");
    await userEvent.click(screen.getByText("Polygon"));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    await selectMainView("ETB");
    await waitFor(() => expect(adapter.cancelDrawing).toHaveBeenCalled());
    await selectMainView("Lagekarte");
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("keeps an armed symbol when the active main view is tapped again", async () => {
    renderWorkspace();
    await openPanel("Kartenzeichen");
    await userEvent.click(screen.getByText(/KTW/));
    await selectMainView("Lagekarte");
    expect(modeBand("Kartenzeichen platzieren")).toBeInTheDocument();
  });

  it("keeps an armed symbol when the width crosses 768 px", async () => {
    const { fireChange } = stubMatchMedia(true);
    try {
      renderWorkspace();
      await openPanel("Kartenzeichen");
      await userEvent.click(screen.getByText(/KTW/));
      act(() => {
        fireChange(false);
      });
      expect(modeBand("Kartenzeichen platzieren")).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows no mode band while nothing is armed", async () => {
    renderWorkspace();
    await selectMainView("Lagekarte");
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("renders a marker for each provided Kartenzeichen", async () => {
    const { adapter } = renderWorkspace({
      symbols: [
        {
          id: "s1",
          lat: 53.5,
          lng: 9.9,
          composition: {
            grundzeichen: "ortsfeste-stelle",
            organisation: "hilfsorganisation",
          },
        },
      ],
    });
    await waitFor(() =>
      expect(adapter.setMarker).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({
          lat: 53.5,
          lng: 9.9,
          iconUrl: expect.stringMatching(/^data:image\/svg/),
        }),
      ),
    );
  });

  it("opens the detail panel for a selected Kartenzeichen and saves an edit", async () => {
    const onUpdate = vi.fn();
    const { adapter } = renderWorkspace({
      symbols: [
        {
          id: "s1",
          lat: 1,
          lng: 2,
          composition: {
            grundzeichen: "ortsfeste-stelle",
            organisation: "hilfsorganisation",
            text: "RK 1",
          },
        },
      ],
      onUpdate,
    });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    const spec = adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;
    act(() => spec.onClick!());

    expect(await screen.findByLabelText("Bezeichnung")).toHaveValue("RK 1");
    await userEvent.click(screen.getByText("Speichern"));
    expect(onUpdate).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        grundzeichen: "ortsfeste-stelle",
        text: "RK 1",
      }),
    );
  });

  it("surfaces a save error in the detail panel when the update fails", async () => {
    const onUpdate = vi
      .fn<SituationWorkspaceProps["onUpdate"]>()
      .mockRejectedValue(new Error("boom"));
    const { adapter } = renderWorkspace({
      symbols: [
        {
          id: "s1",
          lat: 1,
          lng: 2,
          composition: {
            grundzeichen: "ortsfeste-stelle",
            organisation: "hilfsorganisation",
          },
        },
      ],
      onUpdate,
    });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    const spec = adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;
    act(() => spec.onClick!());
    await userEvent.click(await screen.findByText("Speichern"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("surfaces a returned {error} from a symbol update in the detail panel", async () => {
    const onUpdate = vi
      .fn<SituationWorkspaceProps["onUpdate"]>()
      .mockResolvedValueOnce({ error: "Ungültige Zeichen-Komposition." });
    const { adapter } = renderWorkspace({
      symbols: [
        {
          id: "s1",
          lat: 1,
          lng: 2,
          composition: {
            grundzeichen: "ortsfeste-stelle",
            organisation: "hilfsorganisation",
          },
        },
      ],
      onUpdate,
    });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    const spec = adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;
    act(() => spec.onClick!());
    await userEvent.click(await screen.findByText("Speichern"));
    expect(
      await screen.findByText("Ungültige Zeichen-Komposition."),
    ).toBeInTheDocument();
  });

  it("shows a connection-lost symbol on both header sizes when the live stream is disconnected, without a banner above the work area", () => {
    renderWorkspace({ eventsHook: () => ({ connected: false }) });
    for (const testId of ["desktop-header", "mobile-header"]) {
      expect(
        within(screen.getByTestId(testId)).getByLabelText(
          "Verbindung getrennt – wird automatisch wiederhergestellt",
          { selector: "button" },
        ),
      ).toBeInTheDocument();
    }
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("reloads the full state when a live event arrives", () => {
    routerRefresh.mockClear();
    let fire: () => void = () => {};
    renderWorkspace({
      eventsHook: (_url, onChanged) => {
        fire = onChanged;
        return { connected: true };
      },
    });
    fire();
    expect(routerRefresh).toHaveBeenCalled();
  });

  it("renders each visible KML overlay on the map as a layer", async () => {
    const { adapter } = renderWorkspace({
      kmlOverlays: [
        {
          id: "k1",
          name: "Laufstrecke",
          sourceType: "url",
          visible: true,
          content: "<kml/>",
        },
        {
          id: "k2",
          name: "Zonen",
          sourceType: "file",
          visible: false,
          content: "<kml2/>",
        },
      ],
    });
    await waitFor(() =>
      expect(adapter.setKmlOverlay).toHaveBeenCalledWith("k1", {
        content: "<kml/>",
        visible: true,
      }),
    );
    expect(adapter.setKmlOverlay).toHaveBeenCalledWith("k2", {
      content: "<kml2/>",
      visible: false,
    });
  });

  it("opens the Ebenen panel and toggles overlay visibility", async () => {
    const onSetKmlVisibility = vi.fn(async () => ({}));
    renderWorkspace({
      kmlOverlays: [
        {
          id: "k1",
          name: "Laufstrecke",
          sourceType: "url",
          visible: true,
          content: "<kml/>",
        },
      ],
      onSetKmlVisibility,
    });
    await openPanel("Ebenen");
    await userEvent.click(
      await screen.findByRole("switch", { name: /Laufstrecke/ }),
    );
    expect(onSetKmlVisibility).toHaveBeenCalledWith("k1", false);
  });

  it("splits the Ebenen panel into KML-Datei, KML-URL and Bild-Overlays sections in order", async () => {
    renderWorkspace();
    await openPanel("Ebenen");
    const file = screen.getByRole("region", { name: "KML-Datei" });
    const url = screen.getByRole("region", { name: "KML-URL" });
    const image = screen.getByRole("region", { name: "Bild-Overlays" });
    expect(
      file.compareDocumentPosition(url) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      url.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  const anImageOverlay = {
    id: "i1",
    name: "Lageplan",
    imageUrl: "/img/i1",
    placement: {
      centerLat: 53.5,
      centerLng: 9.9,
      scaleM: 500,
      rotationDeg: 10,
      opacity: 0.8,
    },
    aspect: 1.5,
    visible: true,
  };

  it("grays out a device symbol whose last report is stale, but never a manual one", async () => {
    const stale = new Date(Date.now() - 4 * 60 * 1000); // > 3 min
    const comp = {
      grundzeichen: "ortsfeste-stelle" as const,
      organisation: "hilfsorganisation" as const,
    };
    const { adapter } = renderWorkspace({
      symbols: [
        {
          id: "dev",
          lat: 1,
          lng: 2,
          composition: comp,
          positionSource: "device",
          reportedAt: stale,
        },
        {
          id: "man",
          lat: 3,
          lng: 4,
          composition: comp,
          positionSource: "manual",
          reportedAt: stale,
        },
      ],
    });
    await waitFor(() =>
      expect(adapter.setMarker).toHaveBeenCalledWith("dev", expect.anything()),
    );
    const devSpec = adapter.setMarker.mock.calls
      .filter((c) => c[0] === "dev")
      .at(-1)![1] as MarkerSpec;
    const manSpec = adapter.setMarker.mock.calls
      .filter((c) => c[0] === "man")
      .at(-1)![1] as MarkerSpec;
    expect(devSpec.opacity).toBeLessThan(1);
    expect(manSpec.opacity ?? 1).toBe(1);
  });

  it("grays a device symbol that goes stale while the view stays open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const comp = {
        grundzeichen: "ortsfeste-stelle" as const,
        organisation: "hilfsorganisation" as const,
      };
      const justNow = new Date(Date.now() - 10 * 1000); // frisch gemeldet
      const { adapter } = renderWorkspace({
        symbols: [
          {
            id: "dev",
            lat: 1,
            lng: 2,
            composition: comp,
            positionSource: "device",
            reportedAt: justNow,
          },
        ],
      });
      await vi.waitFor(() =>
        expect(adapter.setMarker).toHaveBeenCalledWith(
          "dev",
          expect.anything(),
        ),
      );
      const fresh = adapter.setMarker.mock.calls
        .filter((c) => c[0] === "dev")
        .at(-1)![1] as MarkerSpec;
      expect(fresh.opacity ?? 1).toBe(1); // noch nicht veraltet

      await act(async () => {
        await vi.advanceTimersByTimeAsync(4 * 60 * 1000); // > 3 min ohne neue Meldung
      });
      const stale = adapter.setMarker.mock.calls
        .filter((c) => c[0] === "dev")
        .at(-1)![1] as MarkerSpec;
      expect(stale.opacity).toBeLessThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders each visible image overlay on the map", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await waitFor(() =>
      expect(adapter.setImageOverlay).toHaveBeenCalledWith("i1", {
        imageUrl: "/img/i1",
        placement: anImageOverlay.placement,
        aspect: 1.5,
        visible: true,
      }),
    );
  });

  it("opens the Ebenen panel and toggles image overlay visibility", async () => {
    const onSetImageVisibility = vi.fn(async () => ({}));
    renderWorkspace({
      imageOverlays: [anImageOverlay],
      onSetImageVisibility,
    });
    await openPanel("Ebenen");
    await userEvent.click(
      await screen.findByRole("switch", { name: /Lageplan/ }),
    );
    expect(onSetImageVisibility).toHaveBeenCalledWith("i1", false);
  });

  it("edits an image overlay: shows handles on the map and the inline controls", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await openImageEditor();
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalledWith(
        "i1",
        expect.any(Function),
      ),
    );
    expect(within(mapPanel("Ebenen")).getByText("Fertig")).toBeInTheDocument();
  });

  it("saves the placement from a map gesture without leaving edit mode", async () => {
    const onUpdateImagePlacement = vi.fn(async () => ({}));
    const { adapter } = renderWorkspace({
      imageOverlays: [anImageOverlay],
      onUpdateImagePlacement,
    });
    await openImageEditor();
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalled(),
    );
    const onChange = adapter.startImageOverlayEdit.mock.calls.at(-1)![1] as (
      p: unknown,
    ) => void;
    const moved = { ...anImageOverlay.placement, scaleM: 800, rotationDeg: 42 };
    await act(async () => onChange(moved));
    expect(onUpdateImagePlacement).toHaveBeenCalledWith("i1", moved);
    // Bearbeiten bleibt aktiv.
    expect(within(mapPanel("Ebenen")).getByText("Fertig")).toBeInTheDocument();
  });

  it("changes the opacity from the inline controls", async () => {
    const onUpdateImagePlacement = vi.fn(
      async (_id: string, _placement: ImagePlacement) => ({}),
    );
    renderWorkspace({
      imageOverlays: [anImageOverlay],
      onUpdateImagePlacement,
    });
    await openImageEditor();
    const slider = await screen.findByRole("slider", { name: "Deckkraft" });
    act(() => slider.focus());
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(onUpdateImagePlacement).toHaveBeenCalled());
    const [, placement] = onUpdateImagePlacement.mock.calls.at(-1)!;
    expect(placement.opacity).toBeGreaterThan(0.8);
    expect(placement.scaleM).toBe(anImageOverlay.placement.scaleM);
  });

  it("replaces the file of an image overlay, keeping it in edit mode", async () => {
    const onReplaceImage = vi.fn(async () => ({}));
    renderWorkspace({ imageOverlays: [anImageOverlay], onReplaceImage });
    await openImageEditor();
    const file = new File(["%PDF-1.4"], "neu.pdf", {
      type: "application/pdf",
    });
    await userEvent.upload(screen.getByLabelText("Datei ersetzen"), file);
    expect(onReplaceImage).toHaveBeenCalledWith("i1", file);
  });

  it("finishes editing, removing the handles from the map", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await openImageEditor();
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalled(),
    );
    await userEvent.click(within(mapPanel("Ebenen")).getByText("Fertig"));
    await waitFor(() =>
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled(),
    );
  });

  it("shows the Bild-Overlay band while editing and finishes editing from it", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await startEditingImage();
    await userEvent.click(
      within(modeBand("Bild-Overlay bearbeiten")).getByText("Fertig"),
    );
    await waitFor(() =>
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled(),
    );
    expect(screen.queryByRole("slider", { name: "Deckkraft" })).toBeNull();
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("keeps editing the image overlay when the Ebenen panel is opened", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await startEditingImage();
    await openPanel("Kartenzeichen");
    await openPanel("Ebenen");
    expect(modeBand("Bild-Overlay bearbeiten")).toBeInTheDocument();
    expect(
      await screen.findByRole("slider", { name: "Deckkraft" }),
    ).toBeInTheDocument();
    expect(adapter.stopImageOverlayEdit).not.toHaveBeenCalled();
  });

  it("ends image editing when switching the main view", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await startEditingImage();
    await selectMainView("ETB");
    await waitFor(() =>
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled(),
    );
    await selectMainView("Lagekarte");
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(screen.queryByRole("slider", { name: "Deckkraft" })).toBeNull();
  });

  it("does not place a Kartenzeichen when the map is clicked while editing an overlay", async () => {
    const onPlace = vi.fn(async () => ({}));
    const { captured } = renderWorkspace({
      imageOverlays: [anImageOverlay],
      onPlace,
    });
    await openPanel("Ebenen");
    await userEvent.click(await screen.findByText("Bearbeiten"));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    captured.options!.onMapClick!({ lat: 50, lng: 8 });
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("leaves image editing when a redraw is started (modes are exclusive)", async () => {
    const { adapter } = renderWorkspace({
      imageOverlays: [anImageOverlay],
      areas: [
        {
          id: "a1",
          geometry: { shape: "polygon", points: [{ lat: 1, lng: 2 }] },
          color: "#000",
          opacity: 0.4,
          label: "Z",
        },
      ],
    });
    await openPanel("Ebenen");
    await userEvent.click(await screen.findByText("Bearbeiten"));
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalled(),
    );
    // Einen Bereich auswählen und dessen Form neu zeichnen …
    await openPanel("Bereiche");
    await userEvent.click(
      await screen.findByLabelText(/Z bearbeiten/, { selector: "button" }),
    );
    await userEvent.click(await screen.findByText(/Form neu zeichnen/));
    // … beendet den Bild-Bearbeiten-Modus.
    await waitFor(() =>
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled(),
    );
  });

  it("generates a device link from the Kartenzeichen detail", async () => {
    const onGenerateDeviceLink = vi.fn(async () => ({}));
    const { adapter } = renderWorkspace({
      symbols: [
        {
          id: "s1",
          lat: 1,
          lng: 2,
          composition: {
            grundzeichen: "ortsfeste-stelle",
            organisation: "hilfsorganisation",
          },
        },
      ],
      onGenerateDeviceLink,
    });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    const spec = adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;
    act(() => spec.onClick!());
    await userEvent.click(await screen.findByText(/Gerätelink erzeugen/));
    expect(onGenerateDeviceLink).toHaveBeenCalledWith("s1");
  });

  it("disables the return-to-default button when no default view is set", async () => {
    renderWorkspace({ operationDefaultView: null });
    await selectMainView("Lagekarte");
    expect(
      screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
        selector: "button",
      }),
    ).toBeDisabled();
  });

  it("returns the map to the operation's default view when the button is clicked", async () => {
    const { adapter } = renderWorkspace({
      operationDefaultView: { lat: 52.5, lng: 13.4, zoom: 12 },
    });
    await selectMainView("Lagekarte");
    const button = screen.getByLabelText("Zum Standard-Ausschnitt zurück", {
      selector: "button",
    });
    await userEvent.click(button);
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 52.5,
        lng: 13.4,
        zoom: 12,
      }),
    );

    // Nach dem Wegpannen muss ein erneuter Klick wieder zum Standard springen.
    adapter.setView.mockClear();
    await userEvent.click(button);
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 52.5,
        lng: 13.4,
        zoom: 12,
      }),
    );
  });

  it("deletes the selected Kartenzeichen from the detail panel", async () => {
    const onDelete = vi.fn();
    const { adapter } = renderWorkspace({
      symbols: [
        {
          id: "s1",
          lat: 1,
          lng: 2,
          composition: {
            grundzeichen: "ortsfeste-stelle",
            organisation: "hilfsorganisation",
          },
        },
      ],
      onDelete,
    });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    const spec = adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;
    act(() => spec.onClick!());

    await userEvent.click(await screen.findByText("Löschen"));
    expect(onDelete).toHaveBeenCalledWith("s1");
  });
});
