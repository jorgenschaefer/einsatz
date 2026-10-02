import L from "leaflet";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapAdapter } from "./adapter";
import { leafletMapAdapterFactory } from "./leaflet-adapter";

// The adapter hides the Leaflet map, so the preview is observed through the
// circles it adds to the map.
describe("circle preview", () => {
  let container: HTMLDivElement;
  let adapter: MapAdapter;
  let added: L.Circle[];
  let map: L.Map | undefined;
  const spec = { radius: 250, color: "#e8590c", opacity: 0.3 };

  beforeEach(() => {
    added = [];
    const addLayer = L.Map.prototype.addLayer;
    vi.spyOn(L.Map.prototype, "addLayer").mockImplementation(function (
      this: L.Map,
      layer,
    ) {
      map = this;
      if (layer instanceof L.Circle) added.push(layer);
      return addLayer.call(this, layer);
    });
    container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 800 });
    Object.defineProperty(container, "clientHeight", { value: 600 });
    document.body.appendChild(container);
    adapter = leafletMapAdapterFactory.create(container, {
      initialView: { lat: 53.55, lng: 9.99, zoom: 13 },
      tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
      attribution: "©",
    });
  });

  afterEach(() => {
    adapter.destroy();
    container.remove();
    vi.restoreAllMocks();
  });

  const shown = () => added.filter((c) => map?.hasLayer(c));

  it("draws the preview around the map centre", () => {
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
    adapter.startCirclePreview(spec);
    adapter.setView({ lat: 53.6, lng: 10.05, zoom: 15 });

    const [circle] = shown();
    expect(circle.getLatLng().lat).toBeCloseTo(53.6, 6);
    expect(circle.getLatLng().lng).toBeCloseTo(10.05, 6);
    expect(circle.getRadius()).toBe(250);
  });

  it("replaces the preview when started again", () => {
    adapter.startCirclePreview(spec);
    adapter.startCirclePreview({ ...spec, radius: 400 });

    expect(shown()).toHaveLength(1);
    expect(shown()[0].getRadius()).toBe(400);
  });

  it("stop removes the preview", () => {
    adapter.startCirclePreview(spec);
    adapter.stopCirclePreview();

    expect(shown()).toHaveLength(0);
    adapter.setView({ lat: 53.6, lng: 10.05, zoom: 15 });
    expect(shown()).toHaveLength(0);
  });
});
