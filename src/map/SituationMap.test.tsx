import { type ComponentProps, createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@/test/render";
import type { MarkerSpec } from "./adapter";
import { fakeMapAdapterFactory } from "./adapter.fixtures";
import { readLastView, writeLastView } from "./last-view-storage";
import { SituationMap, type SituationMapHandle } from "./SituationMap";
import type { MapView } from "./view";

type Props = Partial<ComponentProps<typeof SituationMap>>;

const dflt: MapView = { lat: 3, lng: 4, zoom: 8 };

/**
 * Renders the map on a fake adapter showing zoom 14. `update` re-renders it
 * with the same base props and the given ones, as a live refresh does.
 */
function renderMap(over: Props = {}) {
  const fake = fakeMapAdapterFactory({ lat: 5, lng: 6, zoom: 14 });
  const base = {
    operationId: "op-x",
    operationDefaultView: dflt,
    tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap-Mitwirkende",
    factory: fake.factory,
  };
  const { rerender } = render(<SituationMap {...base} {...over} />);
  const update = (next: Props) =>
    rerender(<SituationMap {...base} {...next} />);
  const ready = () =>
    waitFor(() => expect(fake.captured.options).toBeDefined());
  return { ...fake, update, ready };
}

/** The spec of the marker set last. */
const lastMarker = (adapter: { setMarker: { mock: { calls: unknown[][] } } }) =>
  adapter.setMarker.mock.calls.at(-1)![1] as MarkerSpec;

const symbol = { id: "s1", lat: 1, lng: 2, iconUrl: "u" };

describe("SituationMap", () => {
  beforeEach(() => localStorage.clear());

  it("initialises the map at the operation default when there is no local view", async () => {
    const { captured, ready } = renderMap();
    await ready();
    expect(captured.options?.initialView).toEqual(dflt);
  });

  it("prefers the browser-local last view over the operation default", async () => {
    const local: MapView = { lat: 1, lng: 2, zoom: 17 };
    writeLastView("op-x", local);
    const { captured, ready } = renderMap();
    await ready();
    expect(captured.options?.initialView).toEqual(local);
  });

  it("passes an OpenStreetMap attribution to the adapter", async () => {
    const { captured, ready } = renderMap();
    await ready();
    expect(captured.options?.attribution).toMatch(/OpenStreetMap/);
  });

  it("persists the current view locally when the map moves", async () => {
    const { captured, ready } = renderMap();
    await ready();
    captured.options?.onViewChange?.({ lat: 9, lng: 9, zoom: 9 });
    expect(readLastView("op-x")).toEqual({ lat: 9, lng: 9, zoom: 9 });
  });

  it("exposes the adapter's current view through its ref", async () => {
    const mapRef = createRef<SituationMapHandle>();
    const { ready } = renderMap({ ref: mapRef });
    await ready();
    expect(mapRef.current?.getView()).toEqual({ lat: 5, lng: 6, zoom: 14 });
  });

  it("keeps the same map instance across a refresh that changes operationDefaultView identity", async () => {
    const { create, adapter, update } = renderMap({
      operationDefaultView: { lat: 1, lng: 2, zoom: 5 },
    });
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    // router.refresh() liefert ein frisches, wertgleiches defaultView-Objekt:
    update({ operationDefaultView: { lat: 1, lng: 2, zoom: 5 } });
    expect(create).toHaveBeenCalledTimes(1); // nicht neu erzeugt
    expect(adapter.destroy).not.toHaveBeenCalled();
  });

  it("sets a marker for each Kartenzeichen and removes it when the symbol is gone", async () => {
    const { adapter, update } = renderMap({
      symbols: [{ ...symbol, iconUrl: "data:svg1", label: "83/1" }],
    });
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
    update({ symbols: [] });
    await waitFor(() =>
      expect(adapter.removeMarker).toHaveBeenCalledWith("s1"),
    );
  });

  it("places the armed composition where the map is clicked", async () => {
    const onPlace = vi.fn();
    const { captured, ready } = renderMap({
      armedComposition: { grundzeichen: "fahrzeug" },
      onPlace,
    });
    await ready();
    captured.options!.onMapClick!({ lat: 50, lng: 8 });
    expect(onPlace).toHaveBeenCalledWith({ grundzeichen: "fahrzeug" }, 50, 8);
  });

  it("does not place anything when nothing is armed", async () => {
    const onPlace = vi.fn();
    const { captured, ready } = renderMap({ armedComposition: null, onPlace });
    await ready();
    captured.options!.onMapClick!({ lat: 50, lng: 8 });
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("moves a symbol when its marker is dragged", async () => {
    const onMove = vi.fn();
    const { adapter } = renderMap({ symbols: [symbol], onMove });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    const spec = lastMarker(adapter);
    expect(spec.draggable).toBe(true);
    act(() => spec.onDragEnd!({ lat: 10, lng: 20 }));
    expect(onMove).toHaveBeenCalledWith("s1", 10, 20);
  });

  it("renders markers non-draggable in read-only mode", async () => {
    const { adapter } = renderMap({ readOnly: true, symbols: [symbol] });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    expect(lastMarker(adapter).draggable).toBe(false);
  });

  it("reports selection when a marker is clicked", async () => {
    const onSelect = vi.fn();
    const { adapter } = renderMap({ symbols: [symbol], onSelect });
    await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
    lastMarker(adapter).onClick!();
    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("jumps the map to a focus target via setView", async () => {
    const { adapter, update, ready } = renderMap({ focusTarget: null });
    await ready();
    update({ focusTarget: { lat: 50, lng: 8, zoom: 16 } });
    await waitFor(() =>
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 50,
        lng: 8,
        zoom: 16,
      }),
    );
  });

  it("reconciles areas: sets each without a click handler and removes when gone", async () => {
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
    const { adapter, update } = renderMap({ areas: [area] });
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

    update({ areas: [] });
    await waitFor(() => expect(adapter.removeArea).toHaveBeenCalledWith("a1"));
  });

  it("arms drawing a shape and reports the completed geometry", async () => {
    const onDrawComplete = vi.fn();
    const { adapter } = renderMap({ drawShape: "line", onDrawComplete });
    await waitFor(() =>
      expect(adapter.startDrawing).toHaveBeenCalledWith(
        "line",
        expect.any(Function),
      ),
    );
    const onComplete = adapter.startDrawing.mock.calls.at(-1)![1] as (
      g: unknown,
    ) => void;
    const geometry = {
      shape: "line",
      points: [
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
      ],
    };
    onComplete(geometry);
    expect(onDrawComplete).toHaveBeenCalledWith(geometry);
  });

  it("cancels drawing when the shape is disarmed", async () => {
    const { adapter, update } = renderMap({ drawShape: "line" });
    await waitFor(() => expect(adapter.startDrawing).toHaveBeenCalled());
    expect(adapter.cancelDrawing).not.toHaveBeenCalled();

    update({ drawShape: null });

    expect(adapter.cancelDrawing).toHaveBeenCalled();
  });

  it("reconciles KML overlays: sets each with its visibility and removes when gone", async () => {
    const overlay = { id: "k1", content: "<kml/>", visible: true };
    const { adapter, update } = renderMap({ kmlOverlays: [overlay] });
    await waitFor(() =>
      expect(adapter.setKmlOverlay).toHaveBeenCalledWith("k1", {
        content: "<kml/>",
        visible: true,
      }),
    );

    update({ kmlOverlays: [{ ...overlay, visible: false }] });
    await waitFor(() =>
      expect(adapter.setKmlOverlay).toHaveBeenCalledWith("k1", {
        content: "<kml/>",
        visible: false,
      }),
    );

    update({ kmlOverlays: [] });
    await waitFor(() =>
      expect(adapter.removeKmlOverlay).toHaveBeenCalledWith("k1"),
    );
  });

  it("reconciles image overlays: sets each with placement and visibility, removes when gone", async () => {
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
    const { adapter, update } = renderMap({ imageOverlays: [overlay] });
    await waitFor(() =>
      expect(adapter.setImageOverlay).toHaveBeenCalledWith("i1", {
        imageUrl: "/img/i1",
        placement,
        aspect: 1.5,
        visible: true,
      }),
    );

    update({ imageOverlays: [] });
    await waitFor(() =>
      expect(adapter.removeImageOverlay).toHaveBeenCalledWith("i1"),
    );
  });

  it("starts overlay editing for the editing id and reports placement changes", async () => {
    const onEditImagePlacement = vi.fn();
    const { adapter } = renderMap({
      editingImageId: "i1",
      onEditImagePlacement,
    });
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
    const { adapter, update } = renderMap({ editingImageId: "i1" });
    await waitFor(() =>
      expect(adapter.startImageOverlayEdit).toHaveBeenCalled(),
    );
    update({ editingImageId: null });
    await waitFor(() =>
      expect(adapter.stopImageOverlayEdit).toHaveBeenCalled(),
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

    const movingAreas = [circle];

    /** Renders the map while the circle is being moved. */
    async function moving() {
      const map = renderMap({ areas: movingAreas, movingCircleId: "c1" });
      await waitFor(() =>
        expect(map.adapter.startCirclePreview).toHaveBeenCalled(),
      );
      return map;
    }

    it("hides the moving circle from the reconcile and previews it", async () => {
      const { adapter, update } = renderMap({ areas: [circle, other] });
      await waitFor(() => expect(adapter.setArea).toHaveBeenCalledTimes(2));

      update({ areas: [circle, other], movingCircleId: "c1" });
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
      update({ areas: [{ ...circle }, other], movingCircleId: "c1" });
      await waitFor(() => expect(adapter.setArea).toHaveBeenCalled());
      expect(adapter.setArea).not.toHaveBeenCalledWith("c1", expect.anything());
      expect(adapter.removeArea).not.toHaveBeenCalledWith("p1");
    });

    it("centres on the circle keeping the zoom", async () => {
      const { adapter } = await moving();
      expect(adapter.setView).toHaveBeenCalledWith({
        lat: 53.5,
        lng: 9.9,
        zoom: 14,
      });
    });

    it("does not re-centre on a live refresh while moving", async () => {
      const { adapter, update } = await moving();
      expect(adapter.setView).toHaveBeenCalledTimes(1);
      update({ areas: [{ ...circle, label: "Neu" }], movingCircleId: "c1" });
      expect(adapter.setView).toHaveBeenCalledTimes(1);
    });

    it("restores the circle when moving ends without a change to areas", async () => {
      const { adapter, update } = await moving();
      expect(adapter.setArea).not.toHaveBeenCalled();

      update({ areas: movingAreas, movingCircleId: null });
      await waitFor(() =>
        expect(adapter.setArea).toHaveBeenCalledWith(
          "c1",
          expect.objectContaining({ geometry: circle.geometry }),
        ),
      );
      expect(adapter.stopCirclePreview).toHaveBeenCalled();
    });

    it.each([
      ["colour", { ...circle, color: "#1971c2" }, { color: "#1971c2" }],
      ["opacity", { ...circle, opacity: 0.6 }, { opacity: 0.6 }],
      [
        "radius",
        { ...circle, geometry: { ...circle.geometry, radius: 400 } },
        { radius: 400 },
      ],
    ])(
      "restarts the preview when the %s changes",
      async (_, changed, preview) => {
        const { adapter, update } = await moving();
        update({ areas: [changed], movingCircleId: "c1" });
        await waitFor(() =>
          expect(adapter.startCirclePreview).toHaveBeenLastCalledWith({
            radius: 250,
            color: "#e8590c",
            opacity: 0.3,
            ...preview,
          }),
        );
      },
    );
  });

  describe("Suchtreffer", () => {
    const HIT = { lat: 53.55, lng: 9.99 };

    it("draws the Suchtreffer", async () => {
      const { drawn } = renderMap({ searchHit: HIT });
      await waitFor(() => expect(drawn.searchHit).toEqual(HIT));
    });

    it("moves it to the next Suchtreffer", async () => {
      const next = { lat: 53.56, lng: 10.01 };
      const { drawn, update } = renderMap({ searchHit: HIT });
      await waitFor(() => expect(drawn.searchHit).toEqual(HIT));
      update({ searchHit: next });
      await waitFor(() => expect(drawn.searchHit).toEqual(next));
    });

    it("removes it when the Suchtreffer is gone", async () => {
      const { drawn, update } = renderMap({ searchHit: HIT });
      await waitFor(() => expect(drawn.searchHit).toEqual(HIT));
      update({ searchHit: null });
      await waitFor(() => expect(drawn.searchHit).toBeNull());
    });

    it("leaves it alone when changes of other users arrive", async () => {
      const { adapter, drawn, update } = renderMap({ searchHit: HIT });
      await waitFor(() => expect(drawn.searchHit).toEqual(HIT));
      update({ searchHit: HIT, symbols: [symbol], areas: [] });
      await waitFor(() => expect(adapter.setMarker).toHaveBeenCalled());
      expect(adapter.setSearchHit).toHaveBeenCalledTimes(1);
      expect(adapter.clearSearchHit).not.toHaveBeenCalled();
    });

    it("draws none on a freshly loaded map", async () => {
      const { drawn, ready } = renderMap();
      await ready();
      expect(drawn.searchHit).toBeNull();
    });
  });
});
