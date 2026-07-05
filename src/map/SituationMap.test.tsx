import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@/test/render";
import type {
  CreateMapOptions,
  MapAdapterFactory,
  MarkerSpec,
} from "./adapter";
import { readLastView, writeLastView } from "./last-view-storage";
import { SituationMap } from "./SituationMap";
import type { MapView } from "./view";

function fakeFactory(currentView: MapView) {
  const captured: { options?: CreateMapOptions } = {};
  const adapter = {
    getView: () => currentView,
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
    create(_container, options) {
      captured.options = options;
      return adapter;
    },
  };
  return { factory, captured, adapter };
}

const dflt: MapView = { lat: 3, lng: 4, zoom: 8 };

function renderMap(
  over: Partial<React.ComponentProps<typeof SituationMap>> = {},
) {
  const own = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
  const { rerender } = render(
    <SituationMap
      operationId="op-x"
      operationDefaultView={dflt}
      tileUrl="https://tiles.example/{z}/{x}/{y}.png"
      attribution="© OpenStreetMap-Mitwirkende"
      onSetDefault={vi.fn()}
      factory={own.factory}
      {...over}
    />,
  );
  return { ...own, rerender };
}

describe("SituationMap", () => {
  beforeEach(() => localStorage.clear());

  it("initialises the map at the operation default when there is no local view", async () => {
    const { captured } = renderMap();
    await waitFor(() => expect(captured.options).toBeDefined());
    expect(captured.options?.initialView).toEqual(dflt);
  });

  it("prefers the browser-local last view over the operation default", async () => {
    const local: MapView = { lat: 1, lng: 2, zoom: 17 };
    writeLastView("op-x", local);
    const { captured } = renderMap();
    await waitFor(() => expect(captured.options).toBeDefined());
    expect(captured.options?.initialView).toEqual(local);
  });

  it("passes an OpenStreetMap attribution to the adapter", async () => {
    const { captured } = renderMap();
    await waitFor(() => expect(captured.options).toBeDefined());
    expect(captured.options?.attribution).toMatch(/OpenStreetMap/);
  });

  it("persists the current view locally when the map moves", async () => {
    const { captured } = renderMap();
    await waitFor(() => expect(captured.options).toBeDefined());
    captured.options?.onViewChange?.({ lat: 9, lng: 9, zoom: 9 });
    expect(readLastView("op-x")).toEqual({ lat: 9, lng: 9, zoom: 9 });
  });

  it("saves the current view as the default from the map menu", async () => {
    const onSetDefault = vi.fn();
    const { adapter } = renderMap({ onSetDefault });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Karten-Optionen" }),
      ).toBeEnabled(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Karten-Optionen" }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: /Standard-Ausschnitt festlegen/,
      }),
    );
    expect(onSetDefault).toHaveBeenCalledWith(adapter.getView());
  });

  it("keeps the same map instance across a refresh that changes operationDefaultView identity", async () => {
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
    const create = vi.fn(() => adapter);
    const factory: MapAdapterFactory = { create };
    const common = {
      operationId: "op-x",
      tileUrl: "t",
      attribution: "a",
      onSetDefault: vi.fn(),
      factory,
    };
    const { rerender } = render(
      <SituationMap
        {...common}
        operationDefaultView={{ lat: 1, lng: 2, zoom: 5 }}
      />,
    );
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    // router.refresh() liefert ein frisches, wertgleiches defaultView-Objekt:
    rerender(
      <SituationMap
        {...common}
        operationDefaultView={{ lat: 1, lng: 2, zoom: 5 }}
      />,
    );
    await waitFor(() => expect(adapter.setMarker).not.toBe(undefined));
    expect(create).toHaveBeenCalledTimes(1); // nicht neu erzeugt
    expect(adapter.destroy).not.toHaveBeenCalled();
  });

  it("offers no map menu in read-only mode", async () => {
    const { captured } = renderMap({ readOnly: true });
    await waitFor(() => expect(captured.options).toBeDefined());
    expect(
      screen.queryByRole("button", { name: "Karten-Optionen" }),
    ).toBeNull();
  });

  it("sets a marker for each Kartenzeichen and removes it when the symbol is gone", async () => {
    const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
    const props = {
      operationId: "op-x",
      operationDefaultView: dflt,
      tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
      attribution: "© OpenStreetMap-Mitwirkende",
      onSetDefault: vi.fn(),
      factory,
    };
    const { rerender } = render(
      <SituationMap
        {...props}
        symbols={[
          { id: "s1", lat: 1, lng: 2, iconUrl: "data:svg1", label: "83/1" },
        ]}
      />,
    );
    await waitFor(() =>
      expect(adapter.setMarker).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({
          lat: 1,
          lng: 2,
          iconUrl: "data:svg1",
          label: "83/1",
        }),
      ),
    );
    rerender(<SituationMap {...props} symbols={[]} />);
    await waitFor(() =>
      expect(adapter.removeMarker).toHaveBeenCalledWith("s1"),
    );
  });

  it("places the armed composition where the map is clicked", async () => {
    const { factory, captured } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
    const onPlace = vi.fn();
    renderMap({
      factory,
      armedComposition: { grundzeichen: "fahrzeug" },
      onPlace,
    });
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    captured.options!.onMapClick!({ lat: 50, lng: 8 });
    expect(onPlace).toHaveBeenCalledWith({ grundzeichen: "fahrzeug" }, 50, 8);
  });

  it("does not place anything when nothing is armed", async () => {
    const { factory, captured } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
    const onPlace = vi.fn();
    renderMap({ factory, armedComposition: null, onPlace });
    await waitFor(() => expect(captured.options?.onMapClick).toBeDefined());
    captured.options!.onMapClick!({ lat: 50, lng: 8 });
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("moves a symbol when its marker is dragged", async () => {
    const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
    const onMove = vi.fn();
    renderMap({
      factory,
      symbols: [{ id: "s1", lat: 1, lng: 2, iconUrl: "u" }],
      onMove,
    });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    const spec = adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;
    expect(spec.draggable).toBe(true);
    act(() => spec.onDragEnd!({ lat: 10, lng: 20 }));
    expect(onMove).toHaveBeenCalledWith("s1", 10, 20);
  });

  it("jumps the map to a focus target via setView", async () => {
    const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
    const props = {
      operationId: "op-x",
      operationDefaultView: dflt,
      tileUrl: "t",
      attribution: "© OpenStreetMap",
      onSetDefault: vi.fn(),
      factory,
    };
    const { rerender } = render(<SituationMap {...props} focusTarget={null} />);
    await waitFor(() => expect(adapter.setMarker).toBeDefined());
    rerender(
      <SituationMap {...props} focusTarget={{ lat: 50, lng: 8, zoom: 16 }} />,
    );
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 50,
        lng: 8,
        zoom: 16,
      }),
    );
  });

  it("reconciles areas: sets each without a click handler and removes when gone", async () => {
    const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
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
    const props = {
      operationId: "op-x",
      operationDefaultView: dflt,
      tileUrl: "t",
      attribution: "© OpenStreetMap",
      onSetDefault: vi.fn(),
      factory,
    };
    const { rerender } = render(<SituationMap {...props} areas={[area]} />);
    await waitFor(() =>
      expect(adapter.setArea).toHaveBeenCalledWith(
        "a1",
        expect.objectContaining({ color: "#e2001a", opacity: 0.4 }),
      ),
    );
    const spec = adapter.setArea.mock.calls.at(-1)![1] as {
      onClick?: () => void;
    };
    expect(spec.onClick).toBeUndefined();

    rerender(<SituationMap {...props} areas={[]} />);
    await waitFor(() => expect(adapter.removeArea).toHaveBeenCalledWith("a1"));
  });

  it("arms drawing a shape and reports the completed geometry", async () => {
    const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
    const onDrawComplete = vi.fn();
    renderMap({ factory, drawShape: "polygon", onDrawComplete });
    await waitFor(() =>
      expect(adapter.startDrawing).toHaveBeenCalledWith(
        "polygon",
        expect.any(Function),
      ),
    );
    const onComplete = adapter.startDrawing.mock.calls.at(-1)![1] as (
      g: unknown,
    ) => void;
    const geometry = { shape: "polygon", points: [{ lat: 1, lng: 2 }] };
    onComplete(geometry);
    expect(onDrawComplete).toHaveBeenCalledWith(geometry);
  });

  it("reconciles KML overlays: sets each with its visibility and removes when gone", async () => {
    const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
    const props = {
      operationId: "op-x",
      operationDefaultView: dflt,
      tileUrl: "t",
      attribution: "© OpenStreetMap",
      onSetDefault: vi.fn(),
      factory,
    };
    const overlay = { id: "k1", content: "<kml/>", visible: true };
    const { rerender } = render(
      <SituationMap {...props} kmlOverlays={[overlay]} />,
    );
    await waitFor(() =>
      expect(adapter.setKmlOverlay).toHaveBeenCalledWith("k1", {
        content: "<kml/>",
        visible: true,
      }),
    );

    rerender(
      <SituationMap
        {...props}
        kmlOverlays={[{ ...overlay, visible: false }]}
      />,
    );
    await waitFor(() =>
      expect(adapter.setKmlOverlay).toHaveBeenCalledWith("k1", {
        content: "<kml/>",
        visible: false,
      }),
    );

    rerender(<SituationMap {...props} kmlOverlays={[]} />);
    await waitFor(() =>
      expect(adapter.removeKmlOverlay).toHaveBeenCalledWith("k1"),
    );
  });

  it("starts overlay editing for the editing id and reports placement changes", async () => {
    const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
    const onEditImagePlacement = vi.fn();
    renderMap({ factory, editingImageId: "i1", onEditImagePlacement });
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalledWith(
        "i1",
        expect.any(Function),
      ),
    );
    const onChange = adapter.startImageOverlayEdit.mock.calls.at(-1)![1] as (
      p: unknown,
    ) => void;
    const placement = {
      centerLat: 1,
      centerLng: 2,
      scaleM: 300,
      rotationDeg: 45,
      opacity: 0.9,
    };
    act(() => onChange(placement));
    expect(onEditImagePlacement).toHaveBeenCalledWith("i1", placement);
  });

  it("stops overlay editing when the editing id is cleared", async () => {
    const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
    const props = {
      operationId: "op-x",
      operationDefaultView: dflt,
      tileUrl: "t",
      attribution: "© OpenStreetMap",
      onSetDefault: vi.fn(),
      factory,
    };
    const { rerender } = render(
      <SituationMap {...props} editingImageId="i1" />,
    );
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalledWith(
        "i1",
        expect.any(Function),
      ),
    );
    rerender(<SituationMap {...props} editingImageId={null} />);
    await waitFor(() =>
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled(),
    );
  });

  it("reconciles image overlays: sets each with placement and visibility, removes when gone", async () => {
    const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
    const props = {
      operationId: "op-x",
      operationDefaultView: dflt,
      tileUrl: "t",
      attribution: "© OpenStreetMap",
      onSetDefault: vi.fn(),
      factory,
    };
    const placement = {
      centerLat: 53.5,
      centerLng: 9.9,
      scaleM: 500,
      rotationDeg: 20,
      opacity: 0.7,
    };
    const overlay = {
      id: "i1",
      imageUrl: "/img/i1",
      placement,
      aspect: 1.5,
      visible: true,
    };
    const { rerender } = render(
      <SituationMap {...props} imageOverlays={[overlay]} />,
    );
    await waitFor(() =>
      expect(adapter.setImageOverlay).toHaveBeenCalledWith("i1", {
        imageUrl: "/img/i1",
        placement,
        aspect: 1.5,
        visible: true,
      }),
    );

    rerender(<SituationMap {...props} imageOverlays={[]} />);
    await waitFor(() =>
      expect(adapter.removeImageOverlay).toHaveBeenCalledWith("i1"),
    );
  });

  it("renders markers non-draggable in read-only mode", async () => {
    const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
    renderMap({
      factory,
      readOnly: true,
      symbols: [{ id: "s1", lat: 1, lng: 2, iconUrl: "u" }],
    });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    const spec = adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;
    expect(spec.draggable).toBe(false);
  });

  it("reports selection when a marker is clicked", async () => {
    const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
    const onSelect = vi.fn();
    renderMap({
      factory,
      symbols: [{ id: "s1", lat: 1, lng: 2, iconUrl: "u" }],
      onSelect,
    });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    const spec = adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;
    spec.onClick!();
    expect(onSelect).toHaveBeenCalledWith("s1");
  });
});
