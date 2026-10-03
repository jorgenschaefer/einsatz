import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  geocodeGate,
  geocodeQuery,
  geocodeQueryForTokenLink,
  tokenLinkGeocodeGate,
} from "./geocode-service";
import type { Geocoder } from "./geocoder";

const hamburg = () => ({
  geocode: vi.fn(async () => [{ label: "Hamburg", lat: 53.55, lng: 9.99 }]),
});

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

  it("finds nothing for a query over 200 characters, without asking the geocoder or using up the slot", async () => {
    const geocoder = hamburg();
    expect(await geocodeQuery("a".repeat(201), geocoder)).toEqual([]);
    expect(geocoder.geocode).not.toHaveBeenCalled();
    expect(await geocodeQuery("Hamburg", geocoder)).toHaveLength(1);
  });

  it("finds nothing for a query that is not text, without asking the geocoder or using up the slot", async () => {
    const geocoder = hamburg();
    // biome-ignore lint/suspicious/noExplicitAny: die Action nimmt, was der Client schickt
    expect(await geocodeQuery(12345 as any, geocoder)).toEqual([]);
    expect(geocoder.geocode).not.toHaveBeenCalled();
    expect(await geocodeQuery("Hamburg", geocoder)).toHaveLength(1);
  });

  it("ignores surrounding spaces and counts a character outside the BMP once", async () => {
    const geocoder = hamburg();
    expect(
      await geocodeQuery(`  ${"🚒".repeat(200)}  `, geocoder),
    ).toHaveLength(1);
  });
});

describe("geocodeQueryForTokenLink", () => {
  const T0 = Date.UTC(2026, 9, 3);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    geocodeGate.reset();
    tokenLinkGeocodeGate.reset();
  });

  afterEach(() => vi.useRealTimers());

  it("asks the geocoder at most once in 3 seconds", async () => {
    const geocoder = hamburg();
    expect(await geocodeQueryForTokenLink("Hamburg", geocoder)).toHaveLength(1);
    vi.setSystemTime(T0 + 2999);
    expect(await geocodeQueryForTokenLink("Hamburg", geocoder)).toEqual([]);
    vi.setSystemTime(T0 + 3000);
    expect(await geocodeQueryForTokenLink("Hamburg", geocoder)).toHaveLength(1);
  });

  it("leaves the shared slot to logged-in users when its own limit refuses", async () => {
    const geocoder = hamburg();
    await geocodeQueryForTokenLink("Hamburg", geocoder);
    vi.setSystemTime(T0 + 1500);

    expect(await geocodeQueryForTokenLink("Hamburg", geocoder)).toEqual([]);
    expect(await geocodeQuery("Hamburg", geocoder)).toHaveLength(1);
  });

  it("finds nothing when the shared limit is used up by a logged-in search", async () => {
    const geocoder = hamburg();
    await geocodeQuery("Hamburg", geocoder);

    expect(await geocodeQueryForTokenLink("Hamburg", geocoder)).toEqual([]);
    expect(geocoder.geocode).toHaveBeenCalledTimes(1);
  });

  it("leaves logged-in users at least two thirds while token links search all the time", async () => {
    const calledAt: number[] = [];
    const geocoder: Geocoder = {
      geocode: async () => {
        calledAt.push(Date.now());
        return [{ label: "Hamburg", lat: 53.55, lng: 9.99 }];
      },
    };
    const tokenHitsAt: number[] = [];
    const loggedInHitsAt: number[] = [];

    for (let ms = 0; ms < 6000; ms += 500) {
      vi.setSystemTime(T0 + ms);
      if ((await geocodeQueryForTokenLink("Hamburg", geocoder)).length > 0)
        tokenHitsAt.push(ms);
      if (ms % 1000 !== 0) continue;
      if ((await geocodeQuery("Hamburg", geocoder)).length > 0)
        loggedInHitsAt.push(ms);
    }

    expect(gaps(calledAt).every((gap) => gap >= 1000)).toBe(true);
    expect(gaps(tokenHitsAt).every((gap) => gap >= 3000)).toBe(true);
    expect(loggedInHitsAt.length).toBeGreaterThanOrEqual(4);
  });

  it("uses up neither limit for a query over 200 characters or a too-short one", async () => {
    const geocoder = hamburg();
    expect(await geocodeQueryForTokenLink("a".repeat(201), geocoder)).toEqual(
      [],
    );
    expect(await geocodeQueryForTokenLink("ab", geocoder)).toEqual([]);
    expect(geocoder.geocode).not.toHaveBeenCalled();

    expect(await geocodeQueryForTokenLink("Hamburg", geocoder)).toHaveLength(1);
  });
});

function gaps(times: number[]): number[] {
  return times.slice(1).map((t, i) => t - times[i]);
}
