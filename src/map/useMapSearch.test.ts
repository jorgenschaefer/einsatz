import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@/test/render";
import { type MapSearchSymbol, useMapSearch } from "./useMapSearch";

afterEach(cleanup);

const symbols: MapSearchSymbol[] = [
  { id: "s1", composition: { text: "Rotkreuz 83/1" }, lat: 53.5, lng: 9.9 },
  { id: "s2", composition: { text: null }, lat: 1, lng: 2 },
];

describe("useMapSearch", () => {
  it("finds objects by Bezeichnung locally without geocoding", () => {
    const geocode = vi.fn(async () => []);
    const { result } = renderHook(() => useMapSearch(symbols, geocode));
    act(() => result.current.setQuery("rotkreuz"));
    expect(result.current.objectResults.map((o) => o.id)).toEqual(["s1"]);
    expect(geocode).not.toHaveBeenCalled();
  });

  it("does not geocode a too-short query and keeps address results empty", () => {
    const geocode = vi.fn(async () => []);
    const { result } = renderHook(() => useMapSearch(symbols, geocode));
    act(() => result.current.setQuery("ab"));
    expect(geocode).not.toHaveBeenCalled();
    expect(result.current.addressResults).toEqual([]);
  });

  it("geocodes the address query after a debounce and exposes the hits", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const geocode = vi.fn(async () => [
        { label: "Hamburg", lat: 53.55, lng: 9.99 },
      ]);
      const { result } = renderHook(() => useMapSearch(symbols, geocode));
      act(() => result.current.setQuery("Hamburg"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(geocode).toHaveBeenCalledWith("Hamburg");
      await waitFor(() =>
        expect(result.current.addressResults).toHaveLength(1),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
