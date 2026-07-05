import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@/test/render";
import { useDeviceLocation } from "./useDeviceLocation";

type SuccessCb = (pos: GeolocationPosition) => void;
type ErrorCb = () => void;

function installGeolocation() {
  const cbs: { success?: SuccessCb; error?: ErrorCb } = {};
  const clearWatch = vi.fn();
  const watchPosition = vi.fn((success: SuccessCb, error: ErrorCb) => {
    cbs.success = success;
    cbs.error = error;
    return 7;
  });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { watchPosition, clearWatch },
  });
  return { cbs, clearWatch, watchPosition };
}

function installWakeLock() {
  const release = vi.fn(async () => {});
  const request = vi.fn(async () => ({ release }));
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
  return { request, release };
}

function stubFetch(response: { status: number; ok: boolean }) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const fix = (lat: number, lng: number) =>
  ({ coords: { latitude: lat, longitude: lng } }) as GeolocationPosition;

afterEach(() => {
  cleanup(); // unmount now, while the geolocation/wake-lock stubs still exist
  vi.unstubAllGlobals();
  delete (navigator as { geolocation?: unknown }).geolocation;
  delete (navigator as { wakeLock?: unknown }).wakeLock;
});

describe("useDeviceLocation", () => {
  beforeEach(() => stubFetch({ status: 200, ok: true }));

  it("starts paused and does nothing without geolocation support", () => {
    const { result } = renderHook(() => useDeviceLocation("tok", vi.fn()));
    expect(result.current.status).toBe("paused");
    expect(result.current.position).toBeNull();
  });

  it("watches position and requests a wake lock on mount", async () => {
    const { watchPosition } = installGeolocation();
    const { request } = installWakeLock();
    renderHook(() => useDeviceLocation("tok", vi.fn()));
    expect(watchPosition).toHaveBeenCalled();
    await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
  });

  it("reports an active fix and posts the position", async () => {
    const { cbs } = installGeolocation();
    const fetchMock = stubFetch({ status: 200, ok: true });
    const { result } = renderHook(() => useDeviceLocation("tok", vi.fn()));
    act(() => cbs.success?.(fix(53.55, 9.99)));
    expect(result.current.status).toBe("active");
    expect(result.current.position).toEqual({ lat: 53.55, lng: 9.99 });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/device/tok/position",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("pauses again when geolocation reports an error", () => {
    const { cbs } = installGeolocation();
    const { result } = renderHook(() => useDeviceLocation("tok", vi.fn()));
    act(() => cbs.success?.(fix(1, 2)));
    expect(result.current.status).toBe("active");
    act(() => cbs.error?.());
    expect(result.current.status).toBe("paused");
  });

  it("stops watching and calls onAccessLost on a 403", async () => {
    const { cbs, clearWatch } = installGeolocation();
    stubFetch({ status: 403, ok: false });
    const onAccessLost = vi.fn();
    renderHook(() => useDeviceLocation("tok", onAccessLost));
    await act(async () => {
      cbs.success?.(fix(1, 2));
    });
    await waitFor(() => expect(onAccessLost).toHaveBeenCalled());
    expect(clearWatch).toHaveBeenCalled();
  });

  it("releases the wake lock and clears the watch on unmount", async () => {
    const { clearWatch } = installGeolocation();
    const { request, release } = installWakeLock();
    const { unmount } = renderHook(() => useDeviceLocation("tok", vi.fn()));
    await waitFor(() => expect(request).toHaveBeenCalled());
    await act(async () => {}); // let request().then assign the wake lock
    unmount();
    expect(clearWatch).toHaveBeenCalled();
    await waitFor(() => expect(release).toHaveBeenCalled());
  });
});
