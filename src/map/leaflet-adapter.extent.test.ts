import { afterEach, expect, it } from "vitest";
import type { MapAdapter } from "./adapter";
import { leafletMapAdapterFactory } from "./leaflet-adapter";
import type { MapView } from "./view";

// Bodenauflösung der Web-Mercator-Kacheln: Erdumfang / (256 · 2^zoom), mal cos(lat).
const metersPerPixel = (lat: number, zoom: number) =>
  (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** zoom);

const within5Percent = (actual: number, expected: number) =>
  expect(Math.abs(actual / expected - 1)).toBeLessThan(0.05);

let cleanUp = () => {};
afterEach(() => cleanUp());

function mapOfSize(width: number, height: number, view: MapView): MapAdapter {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: width });
  Object.defineProperty(container, "clientHeight", { value: height });
  document.body.appendChild(container);
  const adapter = leafletMapAdapterFactory.create(container, {
    initialView: view,
    tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
    attribution: "©",
  });
  cleanUp = () => {
    adapter.destroy();
    container.remove();
  };
  return adapter;
}

it("measures the whole map area in meters on the ground", () => {
  const adapter = mapOfSize(800, 600, { lat: 53.55, lng: 9.99, zoom: 13 });

  const extent = adapter.getViewExtent();

  const m = metersPerPixel(53.55, 13);
  expect(extent.lat).toBeCloseTo(53.55, 5);
  expect(extent.lng).toBeCloseTo(9.99, 5);
  within5Percent(extent.widthM, 800 * m);
  within5Percent(extent.heightM, 600 * m);
});

it("measures the width along the parallel when the map shows a continent", () => {
  const adapter = mapOfSize(2560, 1440, { lat: 50, lng: 10, zoom: 3 });

  within5Percent(adapter.getViewExtent().widthM, 2560 * metersPerPixel(50, 3));
});

it("measures more than the whole world when the map shows it repeated", () => {
  const adapter = mapOfSize(2560, 1440, { lat: 0, lng: 0, zoom: 1 });

  within5Percent(adapter.getViewExtent().widthM, 2560 * metersPerPixel(0, 1));
});
