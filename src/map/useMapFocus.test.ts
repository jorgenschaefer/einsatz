import { describe, expect, it } from "vitest";
import { act, renderHook } from "@/test/render";
import { useMapFocus } from "./useMapFocus";

const DEFAULT_VIEW = { lat: 52.5, lng: 13.4, zoom: 12 };

describe("useMapFocus", () => {
  it("has no focus target at first", () => {
    const { result } = renderHook(() => useMapFocus(DEFAULT_VIEW));
    expect(result.current.focusTarget).toBeNull();
  });

  it("jumps to a point at zoom 16 without zooming out", () => {
    const { result } = renderHook(() => useMapFocus(DEFAULT_VIEW));

    act(() => result.current.jumpTo(53.5, 9.9));

    expect(result.current.focusTarget).toEqual({
      lat: 53.5,
      lng: 9.9,
      zoom: 16,
      zoomInOnly: true,
    });
  });

  it("returns to the default view, zooming out too, and again on a repeat", () => {
    const { result } = renderHook(() => useMapFocus(DEFAULT_VIEW));

    act(() => result.current.returnToDefaultView());
    const first = result.current.focusTarget;
    act(() => result.current.returnToDefaultView());

    expect(first).toEqual(DEFAULT_VIEW);
    expect(result.current.focusTarget).toEqual(DEFAULT_VIEW);
    expect(result.current.focusTarget).not.toBe(first);
  });

  it("stays where it is on a return without a default view", () => {
    const { result } = renderHook(() => useMapFocus(null));
    act(() => result.current.jumpTo(53.5, 9.9));
    const jumped = result.current.focusTarget;

    act(() => result.current.returnToDefaultView());

    expect(result.current.focusTarget).toBe(jumped);
  });
});
