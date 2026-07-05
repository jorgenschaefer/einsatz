import { beforeEach, describe, expect, it, vi } from "vitest";
import { geocodeGate, geocodeQuery } from "./geocode-service";
import type { Geocoder } from "./geocoder";

describe("geocodeQuery", () => {
  beforeEach(() => geocodeGate.reset());

  it("returns the geocoder hits for a query worth geocoding", async () => {
    const geocoder: Geocoder = {
      geocode: vi.fn(async () => [{ label: "Hamburg", lat: 53.55, lng: 9.99 }]),
    };
    expect(await geocodeQuery("Hamburg", geocoder)).toEqual([
      { label: "Hamburg", lat: 53.55, lng: 9.99 },
    ]);
  });

  it("skips the geocoder for a too-short query", async () => {
    const geocoder: Geocoder = { geocode: vi.fn() };
    expect(await geocodeQuery("ab", geocoder)).toEqual([]);
    expect(geocoder.geocode).not.toHaveBeenCalled();
  });

  it("skips the geocoder when the rate gate is exhausted", async () => {
    const geocoder: Geocoder = {
      geocode: vi.fn(async () => [{ label: "Hamburg", lat: 53.55, lng: 9.99 }]),
    };
    await geocodeQuery("Hamburg", geocoder); // first call acquires the gate
    expect(await geocodeQuery("Hamburg", geocoder)).toEqual([]); // gate blocks
    expect(geocoder.geocode).toHaveBeenCalledTimes(1);
  });

  it("degrades to no hits when the geocoder throws", async () => {
    const geocoder: Geocoder = {
      geocode: vi.fn(async () => {
        throw new Error("upstream down");
      }),
    };
    expect(await geocodeQuery("Hamburg", geocoder)).toEqual([]);
  });
});
