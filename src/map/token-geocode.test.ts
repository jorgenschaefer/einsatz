import { afterEach, describe, expect, it, vi } from "vitest";
import type { GeoHit } from "@/server/geocoder/geocoder";
import { tokenGeocode } from "./token-geocode";

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(response: { ok: boolean; body?: GeoHit[] }) {
  const fetchMock = vi.fn(async () => ({
    ok: response.ok,
    json: async () => response.body ?? [],
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("tokenGeocode", () => {
  it("returns the parsed GeoHit[] on an ok response", async () => {
    const hits: GeoHit[] = [{ label: "Hamburg", lat: 53.55, lng: 9.99 }];
    const fetchMock = mockFetch({ ok: true, body: hits });

    const result = await tokenGeocode("/device", "tok-1", "Hamburg");

    expect(result).toEqual(hits);
    expect(fetchMock).toHaveBeenCalledWith("/device/tok-1/geocode?q=Hamburg");
  });

  it("returns [] on a non-ok response", async () => {
    mockFetch({ ok: false });
    expect(await tokenGeocode("/view", "tok-2", "Berlin")).toEqual([]);
  });

  it("uses the given basePath and url-encodes the query", async () => {
    const fetchMock = mockFetch({ ok: true, body: [] });
    await tokenGeocode("/view", "tok-3", "Bad Segeberg");
    expect(fetchMock).toHaveBeenCalledWith(
      "/view/tok-3/geocode?q=Bad%20Segeberg",
    );
  });
});
