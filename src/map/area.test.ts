import { describe, expect, it } from "vitest";
import { areaCenter } from "./area";

describe("areaCenter", () => {
  it("returns the center of a circle", () => {
    expect(
      areaCenter({
        shape: "circle",
        center: { lat: 53.5, lng: 9.9 },
        radius: 100,
      }),
    ).toEqual({ lat: 53.5, lng: 9.9 });
  });

  it("returns the mean of a polygon's points", () => {
    expect(
      areaCenter({
        shape: "polygon",
        points: [
          { lat: 0, lng: 0 },
          { lat: 2, lng: 4 },
          { lat: 4, lng: 2 },
        ],
      }),
    ).toEqual({ lat: 2, lng: 2 });
  });

  it("returns the mean of a line's points", () => {
    expect(
      areaCenter({
        shape: "line",
        points: [
          { lat: 1, lng: 1 },
          { lat: 3, lng: 5 },
        ],
      }),
    ).toEqual({ lat: 2, lng: 3 });
  });
});
