import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
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
    destroy: vi.fn(),
  };
  const create = vi.fn((_c: HTMLElement, options: CreateMapOptions) => {
    captured.options = options;
    return adapter;
  });
  const factory: MapAdapterFactory = { create };
  return { factory, captured, adapter };
}

// Der ETB-Punkt trägt die Zahl neuer Einträge im Namen („ETB 2 neue Einträge").
const selectMainView = (name: "Lagekarte" | "ETB") =>
  userEvent.click(
    screen.getAllByRole("button", { name: new RegExp(`^${name}`) })[0],
  );

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
function stubMatchMedia(matches: boolean) {
  let changeListener: ((event: { matches: boolean }) => void) | null = null;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === START_VIEW_QUERY ? matches : false,
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

// Die Seitenleisten-Tabs (Kartenzeichen, Bereiche, Ebenen) leben nur in der
// Lagekarten-Hauptansicht; erst hinschalten, dann den Tab öffnen.
const openTab = async (name: RegExp | string) => {
  await selectMainView("Lagekarte");
  await userEvent.click(screen.getByRole("tab", { name }));
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
const etbItem = () => screen.getAllByRole("button", { name: /^ETB/ })[0];

const modeBand = (label: string) =>
  screen.getByRole("toolbar", { name: label });

const startEditingImage = async () => {
  await openTab("Ebenen");
  await userEvent.click(
    await screen.findByRole("button", { name: "Bearbeiten" }),
  );
};

describe("SituationWorkspace", () => {
  it("renders the operation name and Teilen in the header", () => {
    renderWorkspace({ operationName: "Cyclassics 2026" });
    expect(
      within(screen.getByTestId("desktop-header")).getByRole("heading", {
        name: "Cyclassics 2026",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Teilen/i })).toBeInTheDocument();
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
        screen.getByRole("button", {
          name: "Zum Standard-Ausschnitt zurück",
          hidden: true,
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
        screen.getByRole("button", { name: "Zum Standard-Ausschnitt zurück" }),
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
        within(phoneBar() as HTMLElement).getByRole("button", {
          name: "Lagekarte",
        }),
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

  it("lays the three map sidebar tabs out in a grid", async () => {
    renderWorkspace();
    await selectMainView("Lagekarte");
    expect(screen.getByRole("tablist")).toHaveStyle({
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
    });
    expect(
      screen.getByRole("tab", { name: "Kartenzeichen" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bereiche" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ebenen" })).toBeInTheDocument();
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
    await userEvent.click(
      screen.getByRole("button", { name: "Eintrag hinzufügen" }),
    );
    expect(onAddJournalEntry).toHaveBeenCalledWith("Deich gesichert");
  });

  it("places the armed Schnellauswahl composition where the map is clicked", async () => {
    const onPlace = vi.fn(async () => ({}));
    const { captured } = renderWorkspace({ onPlace });
    await openTab("Kartenzeichen");
    await userEvent.click(screen.getByRole("button", { name: /KTW/ }));
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
    await openTab("Kartenzeichen");
    await userEvent.click(screen.getByRole("button", { name: /KTW/ }));
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
    await openTab("Kartenzeichen");
    await userEvent.click(screen.getByRole("button", { name: /KTW/ }));
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
    await openTab("Kartenzeichen");
    await userEvent.click(screen.getByRole("button", { name: /KTW/ }));
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
    await openTab("Kartenzeichen");
    await userEvent.click(screen.getByRole("button", { name: /KTW/ }));
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    await act(async () => {
      captured.options!.onMapClick!({ lat: 50, lng: 8 });
    });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // Erneut scharfstellen und platzieren – der alte Fehler verschwindet.
    await userEvent.click(screen.getByRole("button", { name: /KTW/ }));
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
    await openTab("Kartenzeichen");
    await userEvent.click(screen.getByRole("button", { name: /KTW/ }));
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
    await openTab("Kartenzeichen");
    await userEvent.click(screen.getByRole("button", { name: /Erweitert/ }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Platzieren" }),
    );
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
    await openTab("Kartenzeichen");
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
    await openTab("Kartenzeichen");
    await userEvent.click(
      await screen.findByRole("button", { name: /Rotkreuz 83\/1 bearbeiten/ }),
    );
    expect(await screen.findByLabelText("Bezeichnung")).toHaveValue(
      "Rotkreuz 83/1",
    );
  });

  it("shows an empty state in the Kartenzeichen tab when none are placed", async () => {
    renderWorkspace({ symbols: [] });
    await openTab("Kartenzeichen");
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
    await openTab("Kartenzeichen");
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
    expect(
      await screen.findByRole("button", { name: /Rathaus, Hamburg/ }),
    ).toBeInTheDocument();
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
    // Ein Kartenzeichen mit demselben Namen kann gleichzeitig in der
    // Kartenzeichen-Seitenleiste stehen; auf das Suchergebnis beschränken.
    const results = within(
      (await screen.findByText("Einsatzobjekte")).parentElement as HTMLElement,
    );
    await userEvent.click(
      results.getByRole("button", { name: /Rotkreuz 83\/1/ }),
    );
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
    await openTab("Bereiche");
    await userEvent.click(screen.getByRole("button", { name: "Polygon" }));
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
    onComplete(geometry);
    await waitFor(() => expect(onCreateArea).toHaveBeenCalledWith(geometry));
  });

  it("surfaces a returned {error} from completing a draw", async () => {
    const onCreateArea = vi.fn(async () => ({
      error: "Der Radius muss größer als 0 sein.",
    }));
    const { adapter } = renderWorkspace({ onCreateArea });
    await openTab("Bereiche");
    await userEvent.click(screen.getByRole("button", { name: "Polygon" }));
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
    await userEvent.click(screen.getByRole("button", { name: "Polygon" }));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalledTimes(2));
  });

  it("surfaces a fallback when completing a draw throws", async () => {
    const onCreateArea = vi.fn(async () => {
      throw new Error("boom");
    });
    const { adapter } = renderWorkspace({ onCreateArea });
    await openTab("Bereiche");
    await userEvent.click(screen.getByRole("button", { name: "Polygon" }));
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
    await openTab("Bereiche");
    await userEvent.click(
      await screen.findByRole("button", { name: /Z bearbeiten/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Form neu zeichnen/ }),
    );
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
    await openTab("Bereiche");
    await userEvent.click(
      await screen.findByRole("button", { name: /Zone Nord bearbeiten/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Löschen" }),
    );
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
    await openTab("Bereiche");
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
    await openTab("Bereiche");
    await userEvent.click(
      await screen.findByRole("button", { name: /Zone bearbeiten/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Speichern" }),
    );
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
    await openTab("Bereiche");
    await userEvent.click(
      await screen.findByRole("button", { name: /Zone bearbeiten/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Speichern" }),
    );
    expect(
      await screen.findByText("Die Deckkraft muss zwischen 0 und 1 liegen."),
    ).toBeInTheDocument();
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
    await openTab("Bereiche");
    await userEvent.click(
      await screen.findByRole("button", { name: /Z bearbeiten/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Form neu zeichnen/ }),
    );
    await waitFor(() =>
      expect(adapter.startDrawing).toHaveBeenCalledWith(
        "polygon",
        expect.any(Function),
      ),
    );
    const geometry = { shape: "polygon", points: [{ lat: 9, lng: 9 }] };
    (adapter.startDrawing.mock.calls.at(-1)![1] as (g: unknown) => void)(
      geometry,
    );
    await waitFor(() =>
      expect(onUpdateAreaGeometry).toHaveBeenCalledWith("a1", geometry),
    );
  });

  it.each([
    ["Linie", "line"],
    ["Kreis", "circle"],
  ])("arms drawing the %s shape", async (label, shape) => {
    const { adapter } = renderWorkspace();
    await openTab("Bereiche");
    await userEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() =>
      expect(adapter.startDrawing).toHaveBeenCalledWith(
        shape,
        expect.any(Function),
      ),
    );
  });

  it("cancels drawing when the armed shape is toggled off", async () => {
    const { adapter } = renderWorkspace();
    await openTab("Bereiche");
    await userEvent.click(screen.getByRole("button", { name: "Polygon" }));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: "Polygon" }));
    await waitFor(() => expect(adapter.cancelDrawing).toHaveBeenCalled());
  });

  it("shows the Kartenzeichen band while a Schnellauswahl symbol is armed and cancels it", async () => {
    renderWorkspace();
    await openTab("Kartenzeichen");
    const ktw = screen.getByRole("button", { name: /KTW/ });
    await userEvent.click(ktw);
    await userEvent.click(
      within(modeBand("Kartenzeichen platzieren")).getByRole("button", {
        name: "Abbrechen",
      }),
    );
    expect(ktw).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("shows the Kartenzeichen band while an Erweitert composition is armed", async () => {
    renderWorkspace();
    await openTab("Kartenzeichen");
    await userEvent.click(screen.getByRole("button", { name: "Erweitert …" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Platzieren" }),
    );
    expect(modeBand("Kartenzeichen platzieren")).toBeInTheDocument();
  });

  it("shows the Bereich band while drawing and cancels the drawing", async () => {
    const { adapter } = renderWorkspace();
    await openTab("Bereiche");
    const polygon = screen.getByRole("button", { name: "Polygon" });
    await userEvent.click(polygon);
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    await userEvent.click(
      within(modeBand("Bereich zeichnen")).getByRole("button", {
        name: "Abbrechen",
      }),
    );
    await waitFor(() => expect(adapter.cancelDrawing).toHaveBeenCalled());
    expect(polygon).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("cancels an armed symbol when switching to the ETB", async () => {
    const onPlace = vi.fn(async () => ({}));
    const { captured } = renderWorkspace({ onPlace });
    await openTab("Kartenzeichen");
    const ktw = screen.getByRole("button", { name: /KTW/ });
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
    await openTab("Bereiche");
    await userEvent.click(screen.getByRole("button", { name: "Polygon" }));
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    await selectMainView("ETB");
    await waitFor(() => expect(adapter.cancelDrawing).toHaveBeenCalled());
    await selectMainView("Lagekarte");
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("keeps an armed symbol when the active main view is tapped again", async () => {
    renderWorkspace();
    await openTab("Kartenzeichen");
    await userEvent.click(screen.getByRole("button", { name: /KTW/ }));
    await selectMainView("Lagekarte");
    expect(modeBand("Kartenzeichen platzieren")).toBeInTheDocument();
  });

  it("keeps an armed symbol when the width crosses 768 px", async () => {
    const { fireChange } = stubMatchMedia(true);
    try {
      renderWorkspace();
      await openTab("Kartenzeichen");
      await userEvent.click(screen.getByRole("button", { name: /KTW/ }));
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
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
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
    await userEvent.click(
      await screen.findByRole("button", { name: "Speichern" }),
    );
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
    await userEvent.click(
      await screen.findByRole("button", { name: "Speichern" }),
    );
    expect(
      await screen.findByText("Ungültige Zeichen-Komposition."),
    ).toBeInTheDocument();
  });

  it("shows a connection-lost symbol on both header sizes when the live stream is disconnected, without a banner above the work area", () => {
    renderWorkspace({ eventsHook: () => ({ connected: false }) });
    for (const testId of ["desktop-header", "mobile-header"]) {
      expect(
        within(screen.getByTestId(testId)).getByRole("button", {
          name: "Verbindung getrennt – wird automatisch wiederhergestellt",
        }),
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

  it("opens the layers tab and toggles overlay visibility", async () => {
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
    await openTab("Ebenen");
    await userEvent.click(
      await screen.findByRole("switch", { name: /Laufstrecke/ }),
    );
    expect(onSetKmlVisibility).toHaveBeenCalledWith("k1", false);
  });

  it("splits the layers tab into KML-Datei, KML-URL and Bild-Overlays sections in order", async () => {
    renderWorkspace();
    await openTab("Ebenen");
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

  it("opens the layers tab and toggles image overlay visibility", async () => {
    const onSetImageVisibility = vi.fn(async () => ({}));
    renderWorkspace({
      imageOverlays: [anImageOverlay],
      onSetImageVisibility,
    });
    await openTab("Ebenen");
    await userEvent.click(
      await screen.findByRole("switch", { name: /Lageplan/ }),
    );
    expect(onSetImageVisibility).toHaveBeenCalledWith("i1", false);
  });

  it("edits an image overlay: shows handles on the map and the inline controls", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await openTab("Ebenen");
    await userEvent.click(
      await screen.findByRole("button", { name: "Bearbeiten" }),
    );
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalledWith(
        "i1",
        expect.any(Function),
      ),
    );
    expect(
      within(screen.getByRole("tabpanel")).getByRole("button", {
        name: "Fertig",
      }),
    ).toBeInTheDocument();
  });

  it("saves the placement from a map gesture without leaving edit mode", async () => {
    const onUpdateImagePlacement = vi.fn(async () => ({}));
    const { adapter } = renderWorkspace({
      imageOverlays: [anImageOverlay],
      onUpdateImagePlacement,
    });
    await openTab("Ebenen");
    await userEvent.click(
      await screen.findByRole("button", { name: "Bearbeiten" }),
    );
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
    expect(
      within(screen.getByRole("tabpanel")).getByRole("button", {
        name: "Fertig",
      }),
    ).toBeInTheDocument();
  });

  it("changes the opacity from the inline controls", async () => {
    const onUpdateImagePlacement = vi.fn(
      async (_id: string, _placement: ImagePlacement) => ({}),
    );
    renderWorkspace({
      imageOverlays: [anImageOverlay],
      onUpdateImagePlacement,
    });
    await openTab("Ebenen");
    await userEvent.click(
      await screen.findByRole("button", { name: "Bearbeiten" }),
    );
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
    await openTab("Ebenen");
    await userEvent.click(
      await screen.findByRole("button", { name: "Bearbeiten" }),
    );
    const file = new File(["%PDF-1.4"], "neu.pdf", {
      type: "application/pdf",
    });
    await userEvent.upload(screen.getByLabelText("Datei ersetzen"), file);
    expect(onReplaceImage).toHaveBeenCalledWith("i1", file);
  });

  it("finishes editing, removing the handles from the map", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await openTab("Ebenen");
    await userEvent.click(
      await screen.findByRole("button", { name: "Bearbeiten" }),
    );
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalled(),
    );
    await userEvent.click(
      within(screen.getByRole("tabpanel")).getByRole("button", {
        name: "Fertig",
      }),
    );
    await waitFor(() =>
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled(),
    );
  });

  it("shows the Bild-Overlay band while editing and finishes editing from it", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await startEditingImage();
    await userEvent.click(
      within(modeBand("Bild-Overlay bearbeiten")).getByRole("button", {
        name: "Fertig",
      }),
    );
    await waitFor(() =>
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled(),
    );
    expect(screen.queryByRole("slider", { name: "Deckkraft" })).toBeNull();
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("keeps editing the image overlay when the Ebenen tab is opened", async () => {
    const { adapter } = renderWorkspace({ imageOverlays: [anImageOverlay] });
    await startEditingImage();
    await userEvent.click(screen.getByRole("tab", { name: "Kartenzeichen" }));
    await userEvent.click(screen.getByRole("tab", { name: "Ebenen" }));
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
    await openTab("Ebenen");
    await userEvent.click(
      await screen.findByRole("button", { name: "Bearbeiten" }),
    );
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
    await openTab("Ebenen");
    await userEvent.click(
      await screen.findByRole("button", { name: "Bearbeiten" }),
    );
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalled(),
    );
    // Einen Bereich auswählen und dessen Form neu zeichnen …
    await openTab("Bereiche");
    await userEvent.click(
      await screen.findByRole("button", { name: /Z bearbeiten/ }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /Form neu zeichnen/ }),
    );
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
    await userEvent.click(
      await screen.findByRole("button", { name: /Gerätelink erzeugen/ }),
    );
    expect(onGenerateDeviceLink).toHaveBeenCalledWith("s1");
  });

  it("collapses and reopens the sidebar via the toggle button", async () => {
    renderWorkspace();
    await selectMainView("Lagekarte");
    // Seitenleiste offen: der Tab-Reiter ist sichtbar.
    expect(screen.getByRole("tab", { name: "Kartenzeichen" })).toBeVisible();

    const collapse = screen.getByRole("button", {
      name: "Seitenleiste einklappen",
    });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(collapse);
    // Eingeklappt: die Tabs sind weg, der Ausklapp-Button erscheint.
    expect(screen.queryByRole("tab", { name: "Kartenzeichen" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Seitenleiste ausklappen" }),
    ).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(
      screen.getByRole("button", { name: "Seitenleiste ausklappen" }),
    );
    expect(screen.getByRole("tab", { name: "Kartenzeichen" })).toBeVisible();
  });

  it("disables the return-to-default button when no default view is set", async () => {
    renderWorkspace({ operationDefaultView: null });
    await selectMainView("Lagekarte");
    expect(
      screen.getByRole("button", { name: "Zum Standard-Ausschnitt zurück" }),
    ).toBeDisabled();
  });

  it("returns the map to the operation's default view when the button is clicked", async () => {
    const { adapter } = renderWorkspace({
      operationDefaultView: { lat: 52.5, lng: 13.4, zoom: 12 },
    });
    await selectMainView("Lagekarte");
    const button = screen.getByRole("button", {
      name: "Zum Standard-Ausschnitt zurück",
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

    await userEvent.click(
      await screen.findByRole("button", { name: "Löschen" }),
    );
    expect(onDelete).toHaveBeenCalledWith("s1");
  });
});
