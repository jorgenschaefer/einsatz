import { describe, expect, it } from "vitest";
import type { AreaSpec, ImageOverlaySpec, MarkerSpec } from "./adapter";
import {
  areaSignature,
  imageSignature,
  kmlSignature,
  markerVisualSignature,
} from "./layer-signature";

const marker = (over: Partial<MarkerSpec> = {}): MarkerSpec => ({
  lat: 53.55,
  lng: 9.99,
  iconUrl: "data:image/svg+xml,A",
  opacity: 1,
  ...over,
});

const area = (over: Partial<AreaSpec> = {}): AreaSpec => ({
  geometry: { shape: "circle", center: { lat: 1, lng: 2 }, radius: 50 },
  color: "#e2001a",
  opacity: 0.4,
  label: "",
  ...over,
});

const image = (over: Partial<ImageOverlaySpec> = {}): ImageOverlaySpec => ({
  imageUrl: "/img/1",
  placement: {
    centerLat: 1,
    centerLng: 2,
    scaleM: 100,
    rotationDeg: 0,
    opacity: 0.8,
  },
  aspect: 1.5,
  visible: true,
  ...over,
});

describe("markerVisualSignature", () => {
  it("ignores callback identity and position", () => {
    expect(markerVisualSignature(marker({ onClick: () => {} }))).toBe(
      markerVisualSignature(marker({ onClick: () => {}, lat: 10, lng: 20 })),
    );
  });

  it("changes when the icon, opacity or label changes", () => {
    expect(markerVisualSignature(marker())).not.toBe(
      markerVisualSignature(marker({ iconUrl: "data:image/svg+xml,B" })),
    );
    expect(markerVisualSignature(marker())).not.toBe(
      markerVisualSignature(marker({ opacity: 0.4 })),
    );
    expect(markerVisualSignature(marker())).not.toBe(
      markerVisualSignature(marker({ label: "83/1" })),
    );
  });
});

describe("areaSignature", () => {
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

describe("imageSignature", () => {
  it("changes with url, placement, aspect or visibility", () => {
    expect(imageSignature(image())).toBe(imageSignature(image()));
    expect(imageSignature(image())).not.toBe(
      imageSignature(image({ visible: false })),
    );
    expect(imageSignature(image())).not.toBe(
      imageSignature(image({ aspect: 2 })),
    );
    expect(imageSignature(image())).not.toBe(
      imageSignature(
        image({
          placement: {
            centerLat: 1,
            centerLng: 2,
            scaleM: 100,
            rotationDeg: 90,
            opacity: 0.8,
          },
        }),
      ),
    );
  });
});
