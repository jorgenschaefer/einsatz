import L from "leaflet";
import { describe, expect, it } from "vitest";
import { extractGeometry } from "./leaflet-areas";

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
