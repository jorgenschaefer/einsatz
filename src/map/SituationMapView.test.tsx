import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@/test/render";
import { AREA, anImageOverlay } from "./map-objects.fixtures";
import { MAP_LOADING } from "./SituationMapView";
import {
  armKtw,
  button,
  chooseSearchResult,
  click,
  clickInBand,
  clickMarker,
  confirm,
  failPlacingDuring,
  hideAndShowMap,
  INVALID,
  jumpsTo,
  KML,
  type MapViewProps,
  modeBand,
  moveImageOnMap,
  noModeBand,
  openAreaEditor,
  openSymbolDetail,
  PUMPE,
  type RenderedMapView,
  renderMapView,
  startDrawing,
  startEditingImage,
  startMovingCircle,
  startRedrawing,
  tapMap,
  upload,
} from "./SituationMapView.fixtures";
import { aSymbol } from "./symbol.fixtures";

describe("SituationMapView", () => {
  const { text: _, ...COPIED } = PUMPE.composition;
  it.each([
    [
      "an Erweitert composition",
      async () => {
        await click("Erweitert …");
        await click("Platzieren", await screen.findByRole("dialog"));
      },
      expect.anything(),
    ],
    ["a copy without its Bezeichnung", () => click("Pumpe 1 kopieren"), COPIED],
  ])(
    "shows the band while placing %s, and places it once",
    async (_, arm, composition) => {
      const view = renderMapView({ symbols: [PUMPE], shownPanel: "symbols" });
      await arm();
      expect(modeBand("Kartenzeichen platzieren")).toBeInTheDocument();

      await tapMap(view);
      await tapMap(view);

      expect(view.props.onPlace).toHaveBeenCalledTimes(1);
      expect(view.props.onPlace).toHaveBeenCalledWith(composition, 50, 8);
      noModeBand();
    },
  );

  it("shows the band while drawing, and creates the Bereich drawn on the map", async () => {
    const view = renderMapView();
    await startDrawing(view);
    expect(modeBand("Bereich zeichnen")).toBeInTheDocument();
    const complete = view.adapter.startDrawing.mock.calls.at(-1)?.[1] as (
      geometry: unknown,
    ) => void;
    const geometry = { shape: "line", points: [{ lat: 1, lng: 2 }] };

    await act(async () => complete(geometry));

    expect(view.props.onCreateArea).toHaveBeenCalledWith(geometry);
  });

  it("shows the band and a crosshair while moving a circle, and Abbrechen ends moving without saving", async () => {
    const crosshair = () => document.querySelector(".map-crosshair");
    const view = renderMapView({ areas: [AREA] });
    expect(crosshair()).toBeNull();
    await startMovingCircle(view);
    expect(crosshair()).toHaveAttribute("aria-hidden", "true");
    await waitFor(() =>
      expect(view.adapter.startCirclePreview).toHaveBeenCalled(),
    );

    await clickInBand("Kreis verschieben", "Abbrechen");

    noModeBand();
    expect(crosshair()).toBeNull();
    expect(view.props.onUpdateAreaGeometry).not.toHaveBeenCalled();
  });

  it("locks the band while Hier setzen is saved, so a second tap does not write again", async () => {
    let finish: (result: object) => void = () => {};
    const onUpdateAreaGeometry = vi.fn(
      () => new Promise<object>((resolve) => (finish = resolve)),
    );
    const view = renderMapView({ areas: [AREA], onUpdateAreaGeometry });
    await startMovingCircle(view);
    const band = modeBand("Kreis verschieben");

    await click("Hier setzen", band);
    expect(button("Hier setzen", band)).toBeDisabled();
    expect(button("Abbrechen", band)).toBeDisabled();
    fireEvent.click(button("Hier setzen", band));
    expect(onUpdateAreaGeometry).toHaveBeenCalledTimes(1);

    await act(async () => finish({}));
    noModeBand();
  });

  describe("the Karte notification", () => {
    const noEntry = async () => {};
    it.each([
      ["a Kartenzeichen is armed", noEntry, armKtw],
      ["drawing begins", noEntry, startDrawing],
      ["editing a Bild-Overlay begins", noEntry, startEditingImage],
      ["moving a circle begins", noEntry, startMovingCircle],
      ["redrawing a Bereich begins", noEntry, startRedrawing],
      [
        "a mode is cancelled in its band",
        startDrawing,
        () => clickInBand("Bereich zeichnen", "Abbrechen"),
      ],
    ])("closes when %s", async (_, enter, transition) => {
      const view = await failPlacingDuring(enter);

      await transition(view);

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    });

    it.each([
      [
        "the map is moved or zoomed",
        noEntry,
        ({ captured }: RenderedMapView) =>
          act(() =>
            captured.options?.onViewChange?.({ lat: 9, lng: 9, zoom: 9 }),
          ),
      ],
      [
        "the panel changes",
        noEntry,
        (view: RenderedMapView) => view.rerender({ shownPanel: "layers" }),
      ],
      [
        "the map is hidden, which ends the mode",
        startMovingCircle,
        (view: RenderedMapView) => {
          hideAndShowMap(view);
          noModeBand();
        },
      ],
    ])("stays when %s", async (_, enter, change) => {
      const view = await failPlacingDuring(enter);

      await change(view);

      await act(async () => {});
      expect(screen.getByRole("alert")).toHaveTextContent(INVALID);
    });
  });

  describe("the search", () => {
    const RATHAUS = { label: "Rathaus, Hamburg", lat: 53.55, lng: 9.99 };
    const MARKED = { lat: RATHAUS.lat, lng: RATHAUS.lng };

    async function chooseRathaus(over: Partial<MapViewProps> = {}) {
      const view = renderMapView({
        onGeocode: vi.fn(async () => [RATHAUS]),
        ...over,
      });
      await chooseSearchResult("Hamburg", /Rathaus/);
      await waitFor(() => expect(view.drawn.searchHit).toEqual(MARKED));
      return view;
    }

    it("geocodes an address, marks the chosen one and jumps there, and an Einsatzobjekt chosen next removes the mark", async () => {
      const view = await chooseRathaus({ symbols: [PUMPE] });
      expect(view.props.onGeocode).toHaveBeenCalledWith("Hamburg");
      await jumpsTo(view, { ...MARKED, zoom: 16 });

      await chooseSearchResult("Pumpe", /Pumpe 1/);

      await jumpsTo(view, { lat: 53.4, lng: 9.8, zoom: 16 });
      expect(view.drawn.searchHit).toBeNull();
    });

    it("keeps the query and the mark while panels change, a Kartenzeichen is placed and the map is hidden", async () => {
      const view = await chooseRathaus();
      view.rerender({ shownPanel: "layers" });

      await armKtw(view);
      await tapMap(view);
      hideAndShowMap(view);

      expect(view.props.onPlace).toHaveBeenCalled();
      expect(screen.getByLabelText("Suche")).toHaveValue("Hamburg");
      expect(view.drawn.searchHit).toEqual(MARKED);
    });
  });

  describe("the panel", () => {
    const map = () => document.querySelector('[data-view="map"]');
    const panelSwitch = () =>
      screen.queryByRole("group", { name: "Kartenpanels" });

    // Das CSS blendet `.map-controls` unter `[data-panel-open]` aus.
    it("marks the map while a panel is open", () => {
      const view = renderMapView();
      expect(map()).not.toHaveAttribute("data-panel-open");

      view.rerender({ shownPanel: "layers" });

      expect(map()).toHaveAttribute("data-panel-open");
      expect(
        button("Zum Standard-Ausschnitt zurück").closest(".map-controls"),
      ).not.toBeNull();
    });

    it("closes with Schließen on a phone, and offers none on the desktop", async () => {
      const view = renderMapView({ shownPanel: "layers" });
      await click("Schließen");
      expect(view.props.onCloseSheet).toHaveBeenCalled();

      view.rerender({ isDesktop: true });

      expect(screen.queryByRole("button", { name: "Schließen" })).toBeNull();
    });

    // Daran endet das Blatt an der Reihe oder reicht ohne sie bis ganz unten.
    it("shows the panel switch only while asked to, marks the map with it, and reports the chosen panel", async () => {
      const view = renderMapView();
      expect(map()).toHaveAttribute("data-panel-switch");
      await click("Ebenen", panelSwitch() as HTMLElement);
      expect(view.props.onSelectPanel).toHaveBeenCalledWith("layers");

      view.rerender({ panelSwitchShown: false });

      expect(map()).not.toHaveAttribute("data-panel-switch");
      expect(panelSwitch()).toBeNull();
    });

    it.each([
      ["Kartenzeichen", "symbols", "Pumpe 1", { lat: 53.4, lng: 9.8 }],
      ["Bereiche", "areas", "Deich", AREA.geometry.center],
    ] as const)(
      "jumps from a row in %s, closing the sheet on a phone, without opening a detail",
      async (_, panel, row, position) => {
        const view = renderMapView({
          symbols: [PUMPE],
          areas: [AREA],
          shownPanel: panel,
        });

        await userEvent.click(screen.getByText(row));

        await jumpsTo(view, { ...position, zoom: 16 });
        expect(view.props.closeSheetOnPhone).toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).toBeNull();
      },
    );
  });

  it("returns to the operation's default view, also zooming out, and offers no return without one", async () => {
    const DEFAULT = { lat: 52.5, lng: 13.4, zoom: 12 };
    const view = renderMapView({ operationDefaultView: DEFAULT });
    view.adapter.getView = () => ({ lat: 0, lng: 0, zoom: 18 });

    await click("Zum Standard-Ausschnitt zurück");

    await jumpsTo(view, DEFAULT);
    view.rerender({ operationDefaultView: null });
    expect(button("Zum Standard-Ausschnitt zurück")).toBeDisabled();
  });

  it("does not show an earlier Kartenzeichen's save error after it vanished", async () => {
    const view = renderMapView({
      symbols: [aSymbol({ id: "s1" }), aSymbol({ id: "s2" })],
      onUpdate: vi.fn(async () => ({ error: INVALID })),
    });
    await clickMarker(view, "s1");
    await click("Speichern", await screen.findByRole("dialog"));
    expect(await screen.findByText(INVALID)).toBeInTheDocument();

    view.rerender({ symbols: [aSymbol({ id: "s2" })] });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await clickMarker(view, "s2");

    await screen.findByRole("dialog", { name: "Kartenzeichen" });
    expect(screen.queryByText(INVALID)).toBeNull();
  });

  it.each<
    [
      string,
      Partial<MapViewProps>,
      (view: RenderedMapView) => Promise<unknown>,
      keyof MapViewProps,
      unknown[],
    ]
  >([
    [
      "deletes a Kartenzeichen from its detail, opened from its row, once confirmed",
      { symbols: [PUMPE], shownPanel: "symbols" },
      async () => {
        await click("Pumpe 1 bearbeiten");
        await screen.findByDisplayValue("Pumpe 1");
        await click("Löschen");
        await confirm("Endgültig löschen");
      },
      "onDelete",
      [PUMPE.id],
    ],
    [
      "generates a device link from the Kartenzeichen detail",
      { symbols: [PUMPE] },
      async (view) => {
        await openSymbolDetail(view, PUMPE.id);
        await click(/Gerätelink erzeugen/);
      },
      "onGenerateDeviceLink",
      [PUMPE.id],
    ],
    [
      "removes a device link from the Kartenzeichen detail once confirmed",
      { symbols: [{ ...PUMPE, deviceLinkToken: "token-1" }] },
      async (view) => {
        await openSymbolDetail(view, PUMPE.id);
        await click("Gerätelink entfernen");
        await confirm("Entfernen");
      },
      "onRemoveDeviceLink",
      [PUMPE.id],
    ],
    [
      "deletes a Bereich from its editor once confirmed",
      { areas: [AREA] },
      async (view) => {
        await userEvent.click(
          (await openAreaEditor(view)).getByText("Löschen"),
        );
        await confirm("Endgültig löschen");
      },
      "onDeleteArea",
      [AREA.id],
    ],
    [
      "shows or hides a KML-Overlay",
      { kmlOverlays: [KML], shownPanel: "layers" },
      () => userEvent.click(screen.getByRole("switch", { name: /Zonen/ })),
      "onSetKmlVisibility",
      [KML.id, false],
    ],
    [
      "shows or hides a Bild-Overlay",
      { imageOverlays: [anImageOverlay], shownPanel: "layers" },
      () => userEvent.click(screen.getByRole("switch", { name: /Lageplan/ })),
      "onSetImageVisibility",
      [anImageOverlay.id, false],
    ],
    [
      "reloads a KML-URL",
      { kmlOverlays: [KML], shownPanel: "layers" },
      () => click("Neu laden"),
      "onReloadKml",
      [KML.id],
    ],
    [
      "removes a KML-Overlay once confirmed",
      { kmlOverlays: [KML], shownPanel: "layers" },
      async () => {
        await click("Entfernen");
        await confirm("Entfernen");
      },
      "onRemoveKml",
      [KML.id],
    ],
    [
      "adds a Bild-Overlay where the map shows",
      { shownPanel: "layers" },
      async ({ captured }) => {
        await waitFor(() => expect(captured.options).toBeDefined());
        await upload("Bild-Overlay einbinden", "plan.png");
      },
      "onAddImage",
      [
        expect.objectContaining({ name: "plan.png" }),
        { lat: 0, lng: 0, widthM: 4000, heightM: 3000 },
      ],
    ],
    [
      "deletes the edited Bild-Overlay once confirmed",
      { imageOverlays: [anImageOverlay] },
      async (view) => {
        await startEditingImage(view);
        await click("Löschen");
        await confirm("Endgültig löschen");
      },
      "onDeleteImage",
      [anImageOverlay.id],
    ],
  ])("%s", async (_, over, perform, action, args) => {
    const view = renderMapView(over);

    await perform(view);

    await waitFor(() =>
      expect(view.props[action]).toHaveBeenCalledWith(...args),
    );
  });

  it("adds no Bild-Overlay before the map has loaded, and asks to try again", async () => {
    vi.doMock("./leaflet-adapter", () => new Promise(() => {}));
    try {
      const view = renderMapView({
        shownPanel: "layers",
        factory: undefined,
      });

      await upload("Bild-Overlay einbinden", "plan.png");

      expect(await screen.findByRole("alert")).toHaveTextContent(MAP_LOADING);
      expect(view.props.onAddImage).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("./leaflet-adapter");
    }
  });

  it("shows the KML and Bild-Overlays on the map", async () => {
    const view = renderMapView({
      kmlOverlays: [KML],
      imageOverlays: [anImageOverlay],
    });
    await waitFor(() =>
      expect(view.adapter.setKmlOverlay).toHaveBeenCalledWith("k1", {
        content: "<kml/>",
        visible: true,
      }),
    );
    expect(view.adapter.setImageOverlay).toHaveBeenCalledWith(
      "i1",
      expect.objectContaining({ imageUrl: "/img/i1" }),
    );
  });

  describe("editing a Bild-Overlay", () => {
    const FAILED = { error: "Bild-Overlay nicht gefunden." };
    const MOVED = { ...anImageOverlay.placement, scaleM: 800 };

    async function editImage(over: Partial<MapViewProps> = {}) {
      const view = renderMapView({ imageOverlays: [anImageOverlay], ...over });
      await startEditingImage(view);
      return view;
    }

    it("closes the sheet on a phone, and keeps editing while the panel changes", async () => {
      const view = await editImage();
      expect(view.props.closeSheetOnPhone).toHaveBeenCalled();

      view.rerender({ shownPanel: "symbols" });
      view.rerender({ shownPanel: "layers" });

      expect(screen.getByRole("slider", { name: "Deckkraft" })).toBeVisible();
      expect(modeBand("Bild-Overlay bearbeiten")).toBeInTheDocument();
    });

    it("saves a gesture on the map, and puts the Bild-Overlay back when that fails", async () => {
      const onUpdateImagePlacement = vi.fn(async () => FAILED);
      const view = await editImage({ onUpdateImagePlacement });

      await moveImageOnMap(view, MOVED);

      expect(onUpdateImagePlacement).toHaveBeenCalledWith("i1", MOVED);
      expect(view.adapter.restoreImageOverlay).toHaveBeenCalledWith("i1");
    });

    it("finishes in the band, closing the Bild-Overlays notification", async () => {
      const view = await editImage({
        onUpdateImagePlacement: vi.fn(async () => FAILED),
      });
      await moveImageOnMap(view, MOVED);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Bild-Overlays",
      );

      await clickInBand("Bild-Overlay bearbeiten", "Fertig");

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      expect(view.adapter.stopImageOverlayEdit).toHaveBeenCalled();
      noModeBand();
    });
  });
});
