import { describe, expect, it } from "vitest";
import { kmlSignature } from "./leaflet-kml-overlays";

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
