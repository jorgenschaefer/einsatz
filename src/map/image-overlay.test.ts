import { describe, expect, it } from "vitest";
import {
  defaultImagePlacement,
  type ImagePlacement,
  imageOverlayCorners,
  imageOverlayHandles,
  rotationFromHandle,
  scaleMFromCorner,
} from "./image-overlay";

describe("defaultImagePlacement", () => {
  it("centers a new overlay on the given map view", () => {
    expect(
      defaultImagePlacement({ lat: 53.5, lng: 9.9, zoom: 14 }),
    ).toMatchObject({
      centerLat: 53.5,
      centerLng: 9.9,
      rotationDeg: 0,
      opacity: 1,
    });
  });

  it("falls back to a default center when there is no view", () => {
    const p = defaultImagePlacement(null);
    expect(p.rotationDeg).toBe(0);
    expect(p.opacity).toBe(1);
    expect(p.scaleM).toBeGreaterThan(0);
    expect(typeof p.centerLat).toBe("number");
  });
});

// 1° breit/hoch am Äquator: 111320 m pro Grad in beide Richtungen bei lat 0.
const DEG_M = 111320;

describe("imageOverlayCorners", () => {
  it("places an unrotated square symmetrically around the center", () => {
    const placement: ImagePlacement = {
      centerLat: 0,
      centerLng: 0,
      scaleM: 2 * DEG_M,
      rotationDeg: 0,
      opacity: 1,
    };
    const c = imageOverlayCorners(placement, 1); // aspect 1 → Höhe = Breite
    expect(c.topLeft.lat).toBeCloseTo(1, 5);
    expect(c.topLeft.lng).toBeCloseTo(-1, 5);
    expect(c.topRight.lat).toBeCloseTo(1, 5);
    expect(c.topRight.lng).toBeCloseTo(1, 5);
    expect(c.bottomLeft.lat).toBeCloseTo(-1, 5);
    expect(c.bottomLeft.lng).toBeCloseTo(-1, 5);
  });

  it("halves the on-map height when the image is twice as wide as tall", () => {
    const placement: ImagePlacement = {
      centerLat: 0,
      centerLng: 0,
      scaleM: 2 * DEG_M,
      rotationDeg: 0,
      opacity: 1,
    };
    const c = imageOverlayCorners(placement, 2); // aspect 2 → Höhe = halbe Breite
    expect(c.topLeft.lat).toBeCloseTo(0.5, 5);
    expect(c.bottomLeft.lat).toBeCloseTo(-0.5, 5);
  });

  it("rotates the corners clockwise by rotationDeg", () => {
    const placement: ImagePlacement = {
      centerLat: 0,
      centerLng: 0,
      scaleM: 2 * DEG_M,
      rotationDeg: 90,
      opacity: 1,
    };
    const c = imageOverlayCorners(placement, 1);
    // top-left (-1,+1) 90° im Uhrzeigersinn → (+1,+1)
    expect(c.topLeft.lat).toBeCloseTo(1, 5);
    expect(c.topLeft.lng).toBeCloseTo(1, 5);
  });
});

const placement = (over: Partial<ImagePlacement> = {}): ImagePlacement => ({
  centerLat: 0,
  centerLng: 0,
  scaleM: 1000,
  rotationDeg: 0,
  opacity: 1,
  ...over,
});

describe("imageOverlayHandles", () => {
  it("puts the move handle at the overlay center", () => {
    const p = placement({ centerLat: 53.5, centerLng: 9.9, rotationDeg: 20 });
    expect(imageOverlayHandles(p, 1.5).center).toEqual({
      lat: 53.5,
      lng: 9.9,
    });
  });
});

describe("scaleMFromCorner", () => {
  it("recovers the current scaleM from an unmoved corner (rotated/rectangular)", () => {
    const p = placement({ scaleM: 1000, rotationDeg: 30 });
    const h = imageOverlayHandles(p, 2);
    expect(scaleMFromCorner(p, 2, h.topRight)).toBeCloseTo(1000, 3);
    expect(scaleMFromCorner(p, 2, h.bottomLeft)).toBeCloseTo(1000, 3);
  });

  it("doubles the scale when a corner is dragged to twice its distance from the center", () => {
    const p = placement({ scaleM: 1000 });
    const h = imageOverlayHandles(p, 1);
    const twiceAsFar = {
      lat: p.centerLat + (h.topRight.lat - p.centerLat) * 2,
      lng: p.centerLng + (h.topRight.lng - p.centerLng) * 2,
    };
    expect(scaleMFromCorner(p, 1, twiceAsFar)).toBeCloseTo(2000, 2);
  });

  it("never returns a scale below 1", () => {
    const p = placement({ scaleM: 1000 });
    expect(scaleMFromCorner(p, 1, { lat: 0, lng: 0 })).toBe(1);
  });
});

describe("rotationFromHandle", () => {
  it("reads 0° for a handle due north of the center", () => {
    expect(rotationFromHandle(placement(), { lat: 0.01, lng: 0 })).toBeCloseTo(
      0,
      5,
    );
  });

  it("reads 90° for a handle due east of the center", () => {
    expect(rotationFromHandle(placement(), { lat: 0, lng: 0.01 })).toBeCloseTo(
      90,
      5,
    );
  });

  it("round-trips the rotation of the rotate handle", () => {
    const p = placement({ rotationDeg: 35 });
    expect(
      rotationFromHandle(p, imageOverlayHandles(p, 1.5).rotate),
    ).toBeCloseTo(35, 3);
  });
});
