import { describe, expect, it } from "vitest";
import type { MarkerSpec } from "./adapter";
import { markerVisualSignature } from "./leaflet-markers";

const marker = (over: Partial<MarkerSpec> = {}): MarkerSpec => ({
  lat: 53.55,
  lng: 9.99,
  iconUrl: "data:image/svg+xml,A",
  opacity: 1,
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
