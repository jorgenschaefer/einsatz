import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@/test/render";
import { STALE_TICK_MS } from "./staleness";
import { useStalenessClock } from "./useStalenessClock";

afterEach(cleanup);

describe("useStalenessClock", () => {
  it("advances the timestamp on each tick", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useStalenessClock());
      const start = result.current;
      act(() => {
        vi.advanceTimersByTime(STALE_TICK_MS);
      });
      expect(result.current).toBeGreaterThan(start);
    } finally {
      vi.useRealTimers();
    }
  });
});
