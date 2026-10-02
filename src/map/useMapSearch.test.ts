import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@/test/render";
import type { SearchableSymbol } from "./search";
import { useMapSearch } from "./useMapSearch";

afterEach(cleanup);

const symbols: SearchableSymbol[] = [
  { id: "s1", composition: { text: "Rotkreuz 83/1" }, lat: 53.5, lng: 9.9 },
  { id: "s2", composition: { text: null }, lat: 1, lng: 2 },
];

describe("useMapSearch", () => {
  it("finds objects by Bezeichnung locally without geocoding", () => {
    const geocode = vi.fn(async () => []);
    const { result } = renderHook(() =>
      useMapSearch(symbols, geocode, vi.fn()),
    );
    act(() => result.current.setQuery("rotkreuz"));
    expect(result.current.objectResults.map((o) => o.id)).toEqual(["s1"]);
    expect(geocode).not.toHaveBeenCalled();
  });

  it("does not geocode a too-short query and keeps address results empty", () => {
    const geocode = vi.fn(async () => []);
    const { result } = renderHook(() =>
      useMapSearch(symbols, geocode, vi.fn()),
    );
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
      const { result } = renderHook(() =>
        useMapSearch(symbols, geocode, vi.fn()),
      );
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

  it("lists an address the geocoder returns twice only once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const rathaus = { label: "Rathaus, Hamburg", lat: 53.55, lng: 9.99 };
      const hafen = { label: "Hafen, Hamburg", lat: 53.54, lng: 9.97 };
      const geocode = vi.fn(async () => [rathaus, rathaus, hafen]);
      const { result } = renderHook(() =>
        useMapSearch(symbols, geocode, vi.fn()),
      );
      act(() => result.current.setQuery("Hamburg"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      await waitFor(() =>
        expect(result.current.addressResults).toEqual([rathaus, hafen]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  describe("Suchtreffer", () => {
    const RATHAUS = { label: "Rathaus, Hamburg", lat: 53.55, lng: 9.99 };
    const HAFEN = { label: "Hafen, Hamburg", lat: 53.54, lng: 9.97 };

    function renderSearch() {
      const geocode = async () => [];
      const jumpTo = vi.fn();
      const { result } = renderHook(() =>
        useMapSearch(symbols, geocode, jumpTo),
      );
      return { result, jumpTo };
    }

    it("has none before an address is chosen", () => {
      const { result } = renderSearch();
      expect(result.current.searchHit).toBeNull();
    });

    it("becomes the chosen address, and the map jumps there", () => {
      const { result, jumpTo } = renderSearch();
      act(() => result.current.setQuery("Hamburg"));
      act(() => result.current.chooseAddress(RATHAUS));
      expect(result.current.searchHit).toEqual({ lat: 53.55, lng: 9.99 });
      expect(jumpTo).toHaveBeenCalledWith(53.55, 9.99);
    });

    it("moves to another chosen address", () => {
      const { result } = renderSearch();
      act(() => result.current.chooseAddress(RATHAUS));
      act(() => result.current.chooseAddress(HAFEN));
      expect(result.current.searchHit).toEqual({ lat: 53.54, lng: 9.97 });
    });

    it("is gone once an Einsatzobjekt is chosen, and the map jumps there", () => {
      const { result, jumpTo } = renderSearch();
      act(() => result.current.chooseAddress(RATHAUS));
      act(() =>
        result.current.chooseObject({ id: "s1", label: "RK", lat: 1, lng: 2 }),
      );
      expect(result.current.searchHit).toBeNull();
      expect(jumpTo).toHaveBeenLastCalledWith(1, 2);
    });

    it.each([[""], ["   "]])("is gone once the query is emptied to %j", (q) => {
      const { result } = renderSearch();
      act(() => result.current.setQuery("Hamburg"));
      act(() => result.current.chooseAddress(RATHAUS));
      act(() => result.current.setQuery(q));
      expect(result.current.searchHit).toBeNull();
    });

    it("stays while the query changes without being emptied", () => {
      const { result } = renderSearch();
      act(() => result.current.setQuery("Hamburg"));
      act(() => result.current.chooseAddress(RATHAUS));
      act(() => result.current.setQuery("H"));
      expect(result.current.searchHit).toEqual({ lat: 53.55, lng: 9.99 });
    });
  });
});
