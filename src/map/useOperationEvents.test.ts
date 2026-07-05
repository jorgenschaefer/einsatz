import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@/test/render";
import { useOperationEvents } from "./useOperationEvents";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }
}

const latest = () => FakeEventSource.instances.at(-1) as FakeEventSource;

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useOperationEvents", () => {
  it("opens an EventSource for the url and starts connected", () => {
    const { result } = renderHook(() => useOperationEvents("/e", vi.fn()));
    expect(latest().url).toBe("/e");
    expect(result.current.connected).toBe(true);
  });

  it("does not reload on the first connect", () => {
    const onChanged = vi.fn();
    renderHook(() => useOperationEvents("/e", onChanged));
    act(() => latest().onopen?.());
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("reloads on each message", () => {
    const onChanged = vi.fn();
    renderHook(() => useOperationEvents("/e", onChanged));
    act(() => latest().onmessage?.());
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("marks disconnected on error and reloads once after a reconnect", () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useOperationEvents("/e", onChanged));
    act(() => latest().onopen?.()); // first connect: no reload
    act(() => latest().onerror?.()); // gap
    expect(result.current.connected).toBe(false);
    act(() => latest().onopen?.()); // reconnect: reload the full state
    expect(result.current.connected).toBe(true);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("closes the source on unmount", () => {
    const { unmount } = renderHook(() => useOperationEvents("/e", vi.fn()));
    const source = latest();
    unmount();
    expect(source.close).toHaveBeenCalled();
  });
});
