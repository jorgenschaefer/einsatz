import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@/test/render";
import { stubVisualViewport } from "@/test/visual-viewport";
import { useKeyboardOpen } from "./useKeyboardOpen";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useKeyboardOpen", () => {
  it("reports closed while the viewport is full height", () => {
    stubVisualViewport(window.innerHeight);
    const { result } = renderHook(() => useKeyboardOpen());
    expect(result.current).toBe(false);
  });

  it("reports open when the viewport shrinks by more than 150 px", () => {
    const viewport = stubVisualViewport(window.innerHeight);
    const { result } = renderHook(() => useKeyboardOpen());
    act(() => viewport.resizeTo(window.innerHeight - 151));
    expect(result.current).toBe(true);
  });

  it("reports closed at exactly 150 px", () => {
    const viewport = stubVisualViewport(window.innerHeight);
    const { result } = renderHook(() => useKeyboardOpen());
    act(() => viewport.resizeTo(window.innerHeight - 150));
    expect(result.current).toBe(false);
  });

  it("reports open when mounted while the keyboard is already open", () => {
    stubVisualViewport(window.innerHeight - 300);
    const { result } = renderHook(() => useKeyboardOpen());
    expect(result.current).toBe(true);
  });

  it("reports closed again after the viewport grows back", () => {
    const viewport = stubVisualViewport(window.innerHeight);
    const { result } = renderHook(() => useKeyboardOpen());
    act(() => viewport.resizeTo(window.innerHeight - 300));
    act(() => viewport.resizeTo(window.innerHeight));
    expect(result.current).toBe(false);
  });

  it("stops listening once unmounted", () => {
    const viewport = stubVisualViewport(window.innerHeight);
    const { unmount } = renderHook(() => useKeyboardOpen());
    unmount();
    expect(viewport.listenerCount()).toBe(0);
  });

  it("reports closed without visualViewport", () => {
    vi.stubGlobal("visualViewport", undefined);
    const { result } = renderHook(() => useKeyboardOpen());
    expect(result.current).toBe(false);
  });
});
