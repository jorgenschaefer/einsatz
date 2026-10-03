import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@/test/render";
import { useOperationEvents } from "./useOperationEvents";

class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readyState = FakeEventSource.CONNECTING;
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
  vi.useRealTimers();
});

/** Der Server lehnt ab (403, 429, Umleitung): EventSource gibt auf. */
function refuse(source: FakeEventSource) {
  source.readyState = FakeEventSource.CLOSED;
  source.onerror?.();
}

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

  it("keeps trying every 5 seconds after the server refused the connection", () => {
    vi.useFakeTimers();
    const onChanged = vi.fn();
    const { result } = renderHook(() => useOperationEvents("/e", onChanged));
    const refused = latest();
    act(() => refuse(refused));
    expect(result.current.connected).toBe(false);
    expect(refused.close).toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(4_999));
    expect(FakeEventSource.instances).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(latest().url).toBe("/e");

    act(() => refuse(latest()));
    act(() => vi.advanceTimersByTime(5_000));
    expect(FakeEventSource.instances).toHaveLength(3);

    act(() => latest().onopen?.());
    expect(result.current.connected).toBe(true);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("leaves reconnecting to EventSource while it is still trying", () => {
    vi.useFakeTimers();
    renderHook(() => useOperationEvents("/e", vi.fn()));
    act(() => latest().onerror?.()); // readyState CONNECTING
    act(() => vi.advanceTimersByTime(5_000));
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("stops trying once unmounted", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useOperationEvents("/e", vi.fn()));
    act(() => refuse(latest()));
    unmount();
    vi.advanceTimersByTime(5_000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
