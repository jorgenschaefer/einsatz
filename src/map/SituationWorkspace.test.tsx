import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { act, render, routerRefresh, screen, waitFor } from "@/test/render";
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
  const factory: MapAdapterFactory = {
    create(_c, options) {
      captured.options = options;
      return adapter;
    },
  };
  return { factory, captured, adapter };
}

function renderWorkspace(over: Partial<SituationWorkspaceProps> = {}) {
  const fake = fakeFactory();
  const props: SituationWorkspaceProps = {
    operationId: "op-x",
    operationDefaultView: null,
    tileUrl: "t",
    attribution: "© OpenStreetMap",
    symbols: [],
    journalEntries: [],
    onAddJournalEntry: vi.fn(async () => {}),
    onCorrectJournalEntry: vi.fn(async () => {}),
    onAnnulJournalEntry: vi.fn(async () => {}),
    onSetDefault: vi.fn(),
    onPlace: vi.fn(),
    onMove: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onGenerateDeviceLink: vi.fn(async () => {}),
    onGeocode: vi.fn(async () => []),
    geocoderAttribution: "© OpenStreetMap",
    areas: [],
    onCreateArea: vi.fn(),
    onUpdateAreaStyle: vi.fn(),
    onUpdateAreaGeometry: vi.fn(),
    onDeleteArea: vi.fn(),
    kmlOverlays: [],
    onAddKmlFile: vi.fn(async () => ({})),
    onAddKmlUrl: vi.fn(async () => ({})),
    onToggleKmlVisibility: vi.fn(async () => ({})),
    onReloadKml: vi.fn(async () => ({})),
    onRemoveKml: vi.fn(async () => ({})),
    imageOverlays: [],
    onAddImage: vi.fn(async () => ({})),
    onUpdateImagePlacement: vi.fn(async () => ({})),
    onReplaceImage: vi.fn(async () => ({})),
    onToggleImageVisibility: vi.fn(async () => ({})),
    onDeleteImage: vi.fn(async () => ({})),
    factory: fake.factory,
    ...over,
  };
  render(<SituationWorkspace {...props} />);
  return { ...fake, props };
}

const openTab = (name: RegExp | string) =>
  userEvent.click(screen.getByRole("tab", { name }));

describe("SituationWorkspace", () => {
  it("opens the Einsatztagebuch tab by default and adds an entry", async () => {
    const onAddJournalEntry = vi.fn(async () => {});
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
    await userEvent.type(
      screen.getByLabelText("Neuer Eintrag"),
      "Deich gesichert",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Eintrag hinzufügen" }),
    );
    expect(onAddJournalEntry).toHaveBeenCalledWith("Deich gesichert");
  });

  it("places the armed Schnellauswahl composition where the map is clicked", async () => {
    const onPlace = vi.fn();
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

  it("ends the placing mode after one Kartenzeichen, even while onPlace is still in flight", async () => {
    // onPlace bleibt hängen (Server-Roundtrip): der Modus muss trotzdem sofort
    // enden, sonst platziert ein zweiter Tap während des Roundtrips ein zweites Zeichen.
    let resolvePlace: () => void = () => {};
    const onPlace = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolvePlace = r;
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
    const onPlace = vi.fn();
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
    await userEvent.type(screen.getByLabelText("Suche"), "Hamburg");
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
    await userEvent.type(screen.getByLabelText("Suche"), "Rotkreuz");
    await userEvent.click(
      await screen.findByRole("button", { name: /Rotkreuz 83\/1/ }),
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
    const onCreateArea = vi.fn();
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

  it("replaces an area geometry when redrawing", async () => {
    const onUpdateAreaGeometry = vi.fn();
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

  it("shows a connection-lost hint when the live stream is disconnected", () => {
    renderWorkspace({ eventsHook: () => ({ connected: false }) });
    expect(screen.getByText(/Verbindung getrennt/i)).toBeInTheDocument();
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
    const onToggleKmlVisibility = vi.fn(async () => ({}));
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
      onToggleKmlVisibility,
    });
    await openTab("Ebenen");
    await userEvent.click(
      await screen.findByRole("switch", { name: /Laufstrecke/ }),
    );
    expect(onToggleKmlVisibility).toHaveBeenCalledWith("k1", false);
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
    const onToggleImageVisibility = vi.fn(async () => ({}));
    renderWorkspace({
      imageOverlays: [anImageOverlay],
      onToggleImageVisibility,
    });
    await openTab("Ebenen");
    await userEvent.click(
      await screen.findByRole("switch", { name: /Lageplan/ }),
    );
    expect(onToggleImageVisibility).toHaveBeenCalledWith("i1", false);
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
    expect(screen.getByRole("button", { name: "Fertig" })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Fertig" })).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: "Fertig" }));
    await waitFor(() =>
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled(),
    );
  });

  it("does not place a Kartenzeichen when the map is clicked while editing an overlay", async () => {
    const onPlace = vi.fn();
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
    const onGenerateDeviceLink = vi.fn(async () => {});
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
    // Seitenleiste offen: der Tab-Reiter ist sichtbar.
    expect(screen.getByRole("tab", { name: "Einsatztagebuch" })).toBeVisible();

    const collapse = screen.getByRole("button", {
      name: "Seitenleiste einklappen",
    });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(collapse);
    // Eingeklappt: die Tabs sind weg, der Ausklapp-Button erscheint.
    expect(screen.queryByRole("tab", { name: "Einsatztagebuch" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Seitenleiste ausklappen" }),
    ).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(
      screen.getByRole("button", { name: "Seitenleiste ausklappen" }),
    );
    expect(screen.getByRole("tab", { name: "Einsatztagebuch" })).toBeVisible();
  });

  it("disables the return-to-default button when no default view is set", () => {
    renderWorkspace({ operationDefaultView: null });
    expect(
      screen.getByRole("button", { name: "Zum Standard-Ausschnitt zurück" }),
    ).toBeDisabled();
  });

  it("returns the map to the operation's default view when the button is clicked", async () => {
    const { adapter } = renderWorkspace({
      operationDefaultView: { lat: 52.5, lng: 13.4, zoom: 12 },
    });
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
