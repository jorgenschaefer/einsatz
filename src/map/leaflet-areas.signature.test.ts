import { describe, expect, it } from "vitest";
import type { AreaSpec } from "./adapter";
import { areaSignature } from "./leaflet-areas";

const area = (over: Partial<AreaSpec> = {}): AreaSpec => ({
  geometry: { shape: "circle", center: { lat: 1, lng: 2 }, radius: 50 },
  color: "#e2001a",
  opacity: 0.4,
  label: "",
  ...over,
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
