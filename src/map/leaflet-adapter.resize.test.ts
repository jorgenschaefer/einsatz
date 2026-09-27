import L from "leaflet";
import { expect, it, vi } from "vitest";
import { leafletMapAdapterFactory } from "./leaflet-adapter";

// Leaflet misst den Container nur bei window-resize neu. Öffnet sich das
// Kartenpanel daneben, ändert sich nur die Container-Breite – ohne erneutes
// Vermessen bliebe ein grauer, ungefüllter Streifen. Der Adapter beobachtet den
// Container daher selbst.
it("invalidates the map size when its container resizes", () => {
  const captured: { fireResize?: () => void } = {};
  const observe = vi.fn();
  const disconnect = vi.fn();
  class MockResizeObserver {
    constructor(cb: () => void) {
      captured.fireResize = cb;
    }
    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();
  }
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  const invalidateSize = vi.spyOn(L.Map.prototype, "invalidateSize");

  try {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const adapter = leafletMapAdapterFactory.create(container, {
      initialView: { lat: 53.55, lng: 9.99, zoom: 13 },
      tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
      attribution: "©",
    });

    expect(observe).toHaveBeenCalledWith(container);

    invalidateSize.mockClear();
    captured.fireResize?.();
    expect(invalidateSize).toHaveBeenCalled();

    adapter.destroy();
    expect(disconnect).toHaveBeenCalled();
  } finally {
    invalidateSize.mockRestore();
    vi.unstubAllGlobals();
  }
});
