import { describe, expect, it } from "vitest";
import {
  assertLatLng,
  assertOpacity,
  assertRadius,
  assertScale,
  isValidLatLng,
  ValidationError,
} from "./validation";

describe("isValidLatLng", () => {
  it("accepts a coordinate within WGS84 bounds", () => {
    expect(isValidLatLng(53.55, 9.99)).toBe(true);
    expect(isValidLatLng(-90, -180)).toBe(true);
    expect(isValidLatLng(90, 180)).toBe(true);
  });

  it("rejects out-of-range latitude or longitude", () => {
    expect(isValidLatLng(90.1, 0)).toBe(false);
    expect(isValidLatLng(0, 180.1)).toBe(false);
    expect(isValidLatLng(-91, 0)).toBe(false);
  });

  it("rejects non-finite or non-number values", () => {
    expect(isValidLatLng(Number.NaN, 0)).toBe(false);
    expect(isValidLatLng(0, Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidLatLng("53", 9)).toBe(false);
    expect(isValidLatLng(null, undefined)).toBe(false);
  });
});

describe("assertLatLng", () => {
  it("passes for valid coordinates", () => {
    expect(() => assertLatLng(53.55, 9.99)).not.toThrow();
  });

  it("throws ValidationError for invalid coordinates", () => {
    expect(() => assertLatLng(200, 0)).toThrow(ValidationError);
    expect(() => assertLatLng(Number.NaN, 0)).toThrow(ValidationError);
  });
});

describe("assertOpacity", () => {
  it("accepts 0, 1 and values in between", () => {
    expect(() => assertOpacity(0)).not.toThrow();
    expect(() => assertOpacity(1)).not.toThrow();
    expect(() => assertOpacity(0.4)).not.toThrow();
  });

  it("rejects values outside 0–1 or non-finite", () => {
    expect(() => assertOpacity(-0.1)).toThrow(ValidationError);
    expect(() => assertOpacity(1.1)).toThrow(ValidationError);
    expect(() => assertOpacity(Number.NaN)).toThrow(ValidationError);
  });
});

describe("assertRadius", () => {
  it("accepts a positive radius", () => {
    expect(() => assertRadius(50)).not.toThrow();
  });

  it("rejects zero, negative or non-finite radius", () => {
    expect(() => assertRadius(0)).toThrow(ValidationError);
    expect(() => assertRadius(-5)).toThrow(ValidationError);
    expect(() => assertRadius(Number.POSITIVE_INFINITY)).toThrow(
      ValidationError,
    );
  });
});

describe("assertScale", () => {
  it("accepts a positive scale", () => {
    expect(() => assertScale(1000)).not.toThrow();
  });

  it("rejects zero, negative or non-finite scale", () => {
    expect(() => assertScale(0)).toThrow(ValidationError);
    expect(() => assertScale(-5)).toThrow(ValidationError);
    expect(() => assertScale(Number.NaN)).toThrow(ValidationError);
  });

  it("uses a scale-specific message, not the radius message", () => {
    let message = "";
    try {
      assertScale(0);
    } catch (err) {
      message = (err as ValidationError).message;
    }
    expect(message).not.toMatch(/Radius/);
    expect(message).toMatch(/Skalierung|Skala|Breite/);
  });
});
