import L from "leaflet";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HAMBURG, mountLeafletMap } from "./leaflet-map.fixtures";

const KML_POINT = `<?xml version="1.0"?>
  <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
    <Placemark><Point><coordinates>9.99,53.55,0</coordinates></Point></Placemark>
  </Document></kml>`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("places the zoom control bottom right on every map", () => {
  const { container } = mountLeafletMap();

  const zoom = container.querySelector(".leaflet-control-zoom");
  expect(zoom?.closest(".leaflet-bottom.leaflet-right")).not.toBeNull();
});

it("gives its drawing hints in German", () => {
  const { adapter, container } = mountLeafletMap();

  adapter.startDrawing("polygon", () => {});

  expect(container.textContent).toContain(
    "Platziere den ersten Marker mit Klick",
  );
});

// Auf der Vollbild-Karte wird der globale Footer ausgeblendet; Impressum und
// Datenschutz müssen daher über die Attributionsleiste erreichbar sein.
it("links Impressum and Datenschutz in the attribution bar", () => {
  const { container } = mountLeafletMap();

  const attribution = container.querySelector(".leaflet-control-attribution");
  expect(attribution?.innerHTML).toContain('href="/impressum"');
  expect(attribution?.innerHTML).toContain('href="/datenschutz"');
});

it("sends tile requests with the app's origin only", () => {
  const { container } = mountLeafletMap(HAMBURG, { width: 512, height: 512 });

  const tiles = [
    ...container.querySelectorAll<HTMLImageElement>("img.leaflet-tile"),
  ];
  expect(tiles).not.toHaveLength(0);
  for (const tile of tiles) {
    expect(tile.referrerPolicy).toBe("strict-origin");
  }
});

// Leaflet misst den Container nur bei window-resize neu. Öffnet sich das
// Kartenpanel daneben, ändert sich nur die Container-Breite – ohne erneutes
// Vermessen bliebe ein grauer, ungefüllter Streifen. Der Adapter beobachtet den
// Container daher selbst.
it("invalidates the map size when its container resizes", () => {
  const captured: { fireResize?: () => void } = {};
  const observe = vi.fn();
  const disconnect = vi.fn();
  class MockResizeObserver {
    constructor(cb: () => void) {
      captured.fireResize = cb;
    }
    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();
  }
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  const invalidateSize = vi.spyOn(L.Map.prototype, "invalidateSize");
  const { container, unmount } = mountLeafletMap();

  expect(observe).toHaveBeenCalledWith(container);

  invalidateSize.mockClear();
  captured.fireResize?.();
  expect(invalidateSize).toHaveBeenCalled();

  unmount();
  expect(disconnect).toHaveBeenCalled();
});

it("draws a KML-Ebene and takes it off again", () => {
  const { adapter, container } = mountLeafletMap();
  const points = () => container.querySelectorAll(".kml-point");

  adapter.setKmlOverlay("k1", { content: KML_POINT, visible: true });
  expect(points()).toHaveLength(1);

  adapter.removeKmlOverlay("k1");
  expect(points()).toHaveLength(0);
});

describe("view extent", () => {
  // Bodenauflösung der Web-Mercator-Kacheln: Erdumfang / (256 · 2^zoom), mal cos(lat).
  const metersPerPixel = (lat: number, zoom: number) =>
    (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** zoom);

  const within5Percent = (actual: number, expected: number) =>
    expect(Math.abs(actual / expected - 1)).toBeLessThan(0.05);

  it("measures the whole map area in meters on the ground", () => {
    const { adapter } = mountLeafletMap(HAMBURG, { width: 800, height: 600 });

    const extent = adapter.getViewExtent();

    const m = metersPerPixel(53.55, 13);
    expect(extent.lat).toBeCloseTo(53.55, 5);
    expect(extent.lng).toBeCloseTo(9.99, 5);
    within5Percent(extent.widthM, 800 * m);
    within5Percent(extent.heightM, 600 * m);
  });

  it("measures the width along the parallel when the map shows a continent", () => {
    const { adapter } = mountLeafletMap(
      { lat: 50, lng: 10, zoom: 3 },
      { width: 2560, height: 1440 },
    );

    within5Percent(
      adapter.getViewExtent().widthM,
      2560 * metersPerPixel(50, 3),
    );
  });

  it("measures more than the whole world when the map shows it repeated", () => {
    const { adapter } = mountLeafletMap(
      { lat: 0, lng: 0, zoom: 1 },
      { width: 2560, height: 1440 },
    );

    within5Percent(adapter.getViewExtent().widthM, 2560 * metersPerPixel(0, 1));
  });
});
