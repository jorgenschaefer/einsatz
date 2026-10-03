import { describe, expect, it } from "vitest";
import { createKmlOverlayLayers, kmlSignature } from "./leaflet-kml-overlays";
import { mountPlainLeafletMap } from "./leaflet-map.fixtures";

const POINT = `<?xml version="1.0"?>
  <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
    <Placemark><Point><coordinates>9.99,53.55,0</coordinates></Point></Placemark>
  </Document></kml>`;

describe("KML-Ebenen on the map", () => {
  function kmlLayers() {
    const { map, container } = mountPlainLeafletMap();
    const points = () => [...container.querySelectorAll(".kml-point")];
    return { layers: createKmlOverlayLayers(map), points };
  }

  it("draws a visible KML-Ebene", () => {
    const { layers, points } = kmlLayers();

    layers.set("k1", { content: POINT, visible: true });

    expect(points()).toHaveLength(1);
  });

  it("draws nothing for a hidden KML-Ebene, and takes it off when hidden", () => {
    const { layers, points } = kmlLayers();

    layers.set("k1", { content: POINT, visible: false });
    expect(points()).toHaveLength(0);

    layers.set("k2", { content: POINT, visible: true });
    layers.set("k2", { content: POINT, visible: false });
    expect(points()).toHaveLength(0);
  });

  it("keeps the drawn KML-Ebene when it is set again unchanged", () => {
    const { layers, points } = kmlLayers();
    layers.set("k1", { content: POINT, visible: true });
    const [drawn] = points();

    layers.set("k1", { content: POINT, visible: true });

    expect(points()).toEqual([drawn]);
    expect(drawn.isConnected).toBe(true);
  });

  it("draws nothing for content that is not KML", () => {
    const { layers, points } = kmlLayers();

    layers.set("k1", { content: "<kml><unclosed>", visible: true });

    expect(points()).toHaveLength(0);
  });

  it("removes a KML-Ebene, and draws it again when it is set after that", () => {
    const { layers, points } = kmlLayers();
    layers.set("k1", { content: POINT, visible: true });

    layers.remove("k1");
    expect(points()).toHaveLength(0);

    layers.set("k1", { content: POINT, visible: true });
    expect(points()).toHaveLength(1);
  });
});

describe("kmlSignature", () => {
  it("changes with content or visibility", () => {
    expect(kmlSignature({ content: "<kml/>", visible: true })).toBe(
      kmlSignature({ content: "<kml/>", visible: true }),
    );
    expect(kmlSignature({ content: "<kml/>", visible: true })).not.toBe(
      kmlSignature({ content: "<kml/>", visible: false }),
    );
    expect(kmlSignature({ content: "<kml/>", visible: true })).not.toBe(
      kmlSignature({ content: "<other/>", visible: true }),
    );
  });
});
