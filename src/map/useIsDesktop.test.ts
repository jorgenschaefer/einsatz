import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "@/test/match-media";
import { act, cleanup, renderHook } from "@/test/render";
import { useIsDesktop } from "./useIsDesktop";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useIsDesktop", () => {
  it("does not know the width while rendering on the server", () => {
    stubMatchMedia(true);
    let rendered: boolean | null | undefined;
    const Probe = () => {
      rendered = useIsDesktop();
      return null;
    };
    renderToString(createElement(Probe));
    expect(rendered).toBeNull();
  });

  it("reports the desktop from 48 em", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });

  it("reports a phone below 48 em", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
  });

  it("follows the width across 48 em", () => {
    const { fireChange } = stubMatchMedia(false);
    const { result } = renderHook(() => useIsDesktop());
    act(() => fireChange(true));
    expect(result.current).toBe(true);
    act(() => fireChange(false));
    expect(result.current).toBe(false);
  });

  it("stops listening once unmounted", () => {
    const { listenerCount } = stubMatchMedia(false);
    const { unmount } = renderHook(() => useIsDesktop());
    unmount();
    expect(listenerCount()).toBe(0);
  });
});
