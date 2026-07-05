import { describe, expect, it } from "vitest";
import {
  haversineMeters,
  navigationUrl,
  shouldSendPosition,
} from "./device-location";

describe("navigationUrl", () => {
  it("hands off to the device map app via a geo URI (no in-app routing)", () => {
    expect(navigationUrl(53.5, 9.9)).toBe("geo:53.5,9.9?q=53.5,9.9");
  });
});

describe("haversineMeters", () => {
  it("is ~0 for the same point", () => {
    expect(
      haversineMeters({ lat: 53.5, lng: 9.9 }, { lat: 53.5, lng: 9.9 }),
    ).toBeCloseTo(0, 3);
  });

  it("measures roughly the great-circle distance", () => {
    // ~0.001° latitude ≈ 111 m
    expect(
      haversineMeters({ lat: 53.5, lng: 9.9 }, { lat: 53.501, lng: 9.9 }),
    ).toBeGreaterThan(100);
    expect(
      haversineMeters({ lat: 53.5, lng: 9.9 }, { lat: 53.501, lng: 9.9 }),
    ).toBeLessThan(120);
  });
});

describe("shouldSendPosition", () => {
  const now = 1_000_000;

  it("sends the first fix (no previous report)", () => {
    expect(shouldSendPosition(null, { lat: 53.5, lng: 9.9 }, now)).toBe(true);
  });

  it("sends when moved more than ~10 m since the last report", () => {
    const last = { lat: 53.5, lng: 9.9, at: now - 1000 };
    expect(shouldSendPosition(last, { lat: 53.5005, lng: 9.9 }, now)).toBe(
      true,
    ); // ~55 m
  });

  it("sends when more than ~30 s elapsed even without much movement", () => {
    const last = { lat: 53.5, lng: 9.9, at: now - 31_000 };
    expect(shouldSendPosition(last, { lat: 53.5, lng: 9.9 }, now)).toBe(true);
  });

  it("does not send when neither moved far nor waited long", () => {
    const last = { lat: 53.5, lng: 9.9, at: now - 5000 };
    expect(shouldSendPosition(last, { lat: 53.50001, lng: 9.9 }, now)).toBe(
      false,
    ); // ~1 m, 5 s
  });
});
