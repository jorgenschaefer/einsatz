import { describe, expect, it } from "vitest";
import { mapPhotonFeatures } from "./photon";

describe("mapPhotonFeatures", () => {
  it("maps GeoJSON features to labelled hits with lat/lng", () => {
    const hits = mapPhotonFeatures({
      features: [
        {
          geometry: { type: "Point", coordinates: [9.99, 53.55] },
          properties: {
            name: "Rathaus",
            city: "Hamburg",
            country: "Deutschland",
          },
        },
      ],
    });
    expect(hits).toEqual([
      { label: "Rathaus, Hamburg, Deutschland", lat: 53.55, lng: 9.99 },
    ]);
  });

  it("skips features without point coordinates and tolerates empty input", () => {
    expect(
      mapPhotonFeatures({ features: [{ properties: { name: "x" } }] }),
    ).toEqual([]);
    expect(mapPhotonFeatures({})).toEqual([]);
  });

  it("skips a feature whose second coordinate is not a number", () => {
    expect(
      mapPhotonFeatures({
        features: [
          {
            geometry: { type: "Point", coordinates: [9.99, "nope"] as never },
            properties: { name: "x" },
          },
        ],
      }),
    ).toEqual([]);
  });

  it("rejects non-Point geometries (e.g. a 2-vertex line)", () => {
    expect(
      mapPhotonFeatures({
        features: [
          {
            geometry: {
              type: "LineString",
              coordinates: [
                [9, 53],
                [10, 54],
              ],
            } as never,
            properties: { name: "x" },
          },
        ],
      }),
    ).toEqual([]);
  });
});
