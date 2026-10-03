import L from "leaflet";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AreaSpec } from "./adapter";
import { areaSignature, extractGeometry } from "./leaflet-areas";
import { mountLeafletMap } from "./leaflet-map.fixtures";
import { expectTooltipText } from "./tooltip.fixtures";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extractGeometry", () => {
  it("reads a circle's center and radius", () => {
    const layer = L.circle([53.55, 9.99], { radius: 250 });
    expect(extractGeometry("circle", layer)).toEqual({
      shape: "circle",
      center: { lat: 53.55, lng: 9.99 },
      radius: 250,
    });
  });

  it.each([
    [463.27, 463],
    [463.5, 464],
    [0.4, 0],
  ])(
    "rounds a drawn circle's radius of %s to %s whole metres",
    (drawn, stored) => {
      const layer = L.circle([53.55, 9.99], { radius: drawn });
      expect(extractGeometry("circle", layer)).toMatchObject({
        radius: stored,
      });
    },
  );

  it("reads a polygon's outer ring", () => {
    const layer = L.polygon([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
    expect(extractGeometry("polygon", layer)).toEqual({
      shape: "polygon",
      points: [
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
        { lat: 5, lng: 6 },
      ],
    });
  });

  it("reads a line's points as a flat list, not a ring", () => {
    const layer = L.polyline([
      [1, 2],
      [3, 4],
    ]);
    expect(extractGeometry("line", layer)).toEqual({
      shape: "line",
      points: [
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
      ],
    });
  });

  it("falls back to no points for an empty polygon ring", () => {
    const layer = L.polygon([] as L.LatLngExpression[]);
    expect(extractGeometry("polygon", layer)).toEqual({
      shape: "polygon",
      points: [],
    });
  });
});

describe("areaSignature", () => {
  const area = (over: Partial<AreaSpec> = {}): AreaSpec => ({
    geometry: { shape: "circle", center: { lat: 1, lng: 2 }, radius: 50 },
    color: "#e2001a",
    opacity: 0.4,
    label: "",
    ...over,
  });

  it("changes when geometry, colour, opacity or label change", () => {
    expect(areaSignature(area())).not.toBe(
      areaSignature(area({ color: "#0000ff" })),
    );
    expect(areaSignature(area())).not.toBe(
      areaSignature(area({ label: "Abschnitt" })),
    );
    expect(areaSignature(area())).not.toBe(
      areaSignature(
        area({
          geometry: { shape: "circle", center: { lat: 1, lng: 2 }, radius: 99 },
        }),
      ),
    );
  });
});

describe("leaflet area label", () => {
  it("shows a Beschriftung containing HTML as text, also after it changes", () => {
    const { adapter, container } = mountLeafletMap();
    const spec = {
      geometry: {
        shape: "circle" as const,
        center: { lat: 53.55, lng: 9.99 },
        radius: 250,
      },
      color: "#e8590c",
      opacity: 0.3,
    };
    const tooltip = () =>
      container.querySelector<HTMLElement>(".leaflet-tooltip");

    adapter.setArea("b1", { ...spec, label: "<img src=x onerror=alert(1)>" });
    expectTooltipText(tooltip(), "<img src=x onerror=alert(1)>");

    adapter.setArea("b1", { ...spec, label: "<b>neu</b>" });
    expectTooltipText(tooltip(), "<b>neu</b>");
  });
});

// The adapter hides the Leaflet map, so the preview is observed through the
// circles it adds to the map.
describe("circle preview", () => {
  const spec = { radius: 250, color: "#e8590c", opacity: 0.3 };

  function previewMap() {
    const added: L.Circle[] = [];
    let map: L.Map | undefined;
    const addLayer = L.Map.prototype.addLayer;
    vi.spyOn(L.Map.prototype, "addLayer").mockImplementation(function (
      this: L.Map,
      layer,
    ) {
      map = this;
      if (layer instanceof L.Circle) added.push(layer);
      return addLayer.call(this, layer);
    });
    const { adapter } = mountLeafletMap();
    const shown = () => added.filter((c) => map?.hasLayer(c));
    return { adapter, shown };
  }

  it("draws the preview around the map centre", () => {
    const { adapter, shown } = previewMap();
    adapter.startCirclePreview(spec);

    expect(shown()).toHaveLength(1);
    const [circle] = shown();
    expect(circle.getLatLng().lat).toBeCloseTo(53.55, 6);
    expect(circle.getLatLng().lng).toBeCloseTo(9.99, 6);
    expect(circle.getRadius()).toBe(250);
    expect(circle.options.color).toBe("#e8590c");
    expect(circle.options.fillOpacity).toBe(0.3);
  });

  it("follows the map centre after setView", () => {
    const { adapter, shown } = previewMap();
    adapter.startCirclePreview(spec);
    adapter.setView({ lat: 53.6, lng: 10.05, zoom: 15 });

    const [circle] = shown();
    expect(circle.getLatLng().lat).toBeCloseTo(53.6, 6);
    expect(circle.getLatLng().lng).toBeCloseTo(10.05, 6);
    expect(circle.getRadius()).toBe(250);
  });

  it("replaces the preview when started again", () => {
    const { adapter, shown } = previewMap();
    adapter.startCirclePreview(spec);
    adapter.startCirclePreview({ ...spec, radius: 400 });

    expect(shown()).toHaveLength(1);
    expect(shown()[0].getRadius()).toBe(400);
  });

  it("stop removes the preview", () => {
    const { adapter, shown } = previewMap();
    adapter.startCirclePreview(spec);
    adapter.stopCirclePreview();

    expect(shown()).toHaveLength(0);
    adapter.setView({ lat: 53.6, lng: 10.05, zoom: 15 });
    expect(shown()).toHaveLength(0);
  });
});
