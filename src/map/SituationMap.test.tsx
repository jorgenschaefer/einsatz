import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@/test/render";
import type {
  CreateMapOptions,
  MapAdapterFactory,
  MarkerSpec,
} from "./adapter";
import { readLastView, writeLastView } from "./last-view-storage";
import { SituationMap, type SituationMapHandle } from "./SituationMap";
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
    startCirclePreview: vi.fn(),
    stopCirclePreview: vi.fn(),
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

  it("exposes the adapter's current view through its ref", async () => {
    const mapRef = createRef<SituationMapHandle>();
    const { captured } = renderMap({ ref: mapRef });
    await waitFor(() => expect(captured.options).toBeDefined());
    expect(mapRef.current?.getView()).toEqual({ lat: 5, lng: 6, zoom: 14 });
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
      startCirclePreview: vi.fn(),
      stopCirclePreview: vi.fn(),
      destroy: vi.fn(),
    };
    const create = vi.fn(() => adapter);
    const factory: MapAdapterFactory = { create };
    const common = {
      operationId: "op-x",
      tileUrl: "t",
      attribution: "a",
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

  it("sets a marker for each Kartenzeichen and removes it when the symbol is gone", async () => {
    const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
    const props = {
      operationId: "op-x",
      operationDefaultView: dflt,
      tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
      attribution: "© OpenStreetMap-Mitwirkende",
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

  describe("moving a circle", () => {
    const circle = {
      id: "c1",
      geometry: {
        shape: "circle" as const,
        center: { lat: 53.5, lng: 9.9 },
        radius: 250,
      },
      color: "#e8590c",
      opacity: 0.3,
      label: "Zone",
    };
    const other = {
      id: "p1",
      geometry: {
        shape: "polygon" as const,
        points: [{ lat: 1, lng: 2 }],
      },
      color: "#e2001a",
      opacity: 0.4,
      label: "",
    };
    const props = {
      operationId: "op-x",
      operationDefaultView: dflt,
      tileUrl: "t",
      attribution: "© OpenStreetMap",
    };

    it("hides the moving circle from the reconcile and previews it", async () => {
      const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
      const { rerender } = render(
        <SituationMap {...props} factory={factory} areas={[circle, other]} />,
      );
      await waitFor(() => expect(adapter.setArea).toHaveBeenCalledTimes(2));

      rerender(
        <SituationMap
          {...props}
          factory={factory}
          areas={[circle, other]}
          movingCircleId="c1"
        />,
      );
      await waitFor(() =>
        expect(adapter.removeArea).toHaveBeenCalledWith("c1"),
      );
      expect(adapter.startCirclePreview).toHaveBeenLastCalledWith({
        radius: 250,
        color: "#e8590c",
        opacity: 0.3,
      });

      // A live refresh does not bring the circle back.
      adapter.setArea.mockClear();
      rerender(
        <SituationMap
          {...props}
          factory={factory}
          areas={[{ ...circle }, other]}
          movingCircleId="c1"
        />,
      );
      await waitFor(() => expect(adapter.setArea).toHaveBeenCalled());
      expect(adapter.setArea).not.toHaveBeenCalledWith("c1", expect.anything());
      expect(adapter.removeArea).not.toHaveBeenCalledWith("p1");
    });

    it("centres on the circle keeping the zoom", async () => {
      const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
      render(
        <SituationMap
          {...props}
          factory={factory}
          areas={[circle]}
          movingCircleId="c1"
        />,
      );
      await waitFor(() =>
        expect(adapter.setView).toHaveBeenCalledWith({
          lat: 53.5,
          lng: 9.9,
          zoom: 14,
        }),
      );
    });

    it("does not re-centre on a live refresh while moving", async () => {
      const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
      const { rerender } = render(
        <SituationMap
          {...props}
          factory={factory}
          areas={[circle]}
          movingCircleId="c1"
        />,
      );
      await waitFor(() => expect(adapter.setView).toHaveBeenCalledTimes(1));
      rerender(
        <SituationMap
          {...props}
          factory={factory}
          areas={[{ ...circle, label: "Neu" }]}
          movingCircleId="c1"
        />,
      );
      await waitFor(() =>
        expect(adapter.startCirclePreview).toHaveBeenCalled(),
      );
      expect(adapter.setView).toHaveBeenCalledTimes(1);
    });

    it("restores the circle when moving ends", async () => {
      const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
      const { rerender } = render(
        <SituationMap
          {...props}
          factory={factory}
          areas={[circle]}
          movingCircleId="c1"
        />,
      );
      await waitFor(() =>
        expect(adapter.startCirclePreview).toHaveBeenCalled(),
      );
      expect(adapter.setArea).not.toHaveBeenCalled();

      rerender(
        <SituationMap
          {...props}
          factory={factory}
          areas={[circle]}
          movingCircleId={null}
        />,
      );
      await waitFor(() =>
        expect(adapter.setArea).toHaveBeenCalledWith(
          "c1",
          expect.objectContaining({ geometry: circle.geometry }),
        ),
      );
      expect(adapter.stopCirclePreview).toHaveBeenCalled();
    });

    it("restarts the preview when the colour or opacity changes", async () => {
      const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
      const { rerender } = render(
        <SituationMap
          {...props}
          factory={factory}
          areas={[circle]}
          movingCircleId="c1"
        />,
      );
      await waitFor(() =>
        expect(adapter.startCirclePreview).toHaveBeenCalled(),
      );
      rerender(
        <SituationMap
          {...props}
          factory={factory}
          areas={[{ ...circle, color: "#1971c2" }]}
          movingCircleId="c1"
        />,
      );
      await waitFor(() =>
        expect(adapter.startCirclePreview).toHaveBeenLastCalledWith({
          radius: 250,
          color: "#1971c2",
          opacity: 0.3,
        }),
      );
      rerender(
        <SituationMap
          {...props}
          factory={factory}
          areas={[{ ...circle, color: "#1971c2", opacity: 0.6 }]}
          movingCircleId="c1"
        />,
      );
      await waitFor(() =>
        expect(adapter.startCirclePreview).toHaveBeenLastCalledWith({
          radius: 250,
          color: "#1971c2",
          opacity: 0.6,
        }),
      );
    });

    it("restarts the preview when the radius changes", async () => {
      const { factory, adapter } = fakeFactory({ lat: 5, lng: 6, zoom: 14 });
      const { rerender } = render(
        <SituationMap
          {...props}
          factory={factory}
          areas={[circle]}
          movingCircleId="c1"
        />,
      );
      await waitFor(() =>
        expect(adapter.startCirclePreview).toHaveBeenCalled(),
      );
      rerender(
        <SituationMap
          {...props}
          factory={factory}
          areas={[{ ...circle, geometry: { ...circle.geometry, radius: 400 } }]}
          movingCircleId="c1"
        />,
      );
      await waitFor(() =>
        expect(adapter.startCirclePreview).toHaveBeenLastCalledWith({
          radius: 400,
          color: "#e8590c",
          opacity: 0.3,
        }),
      );
    });
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
