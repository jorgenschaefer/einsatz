import L from "leaflet";
import { onTestFinished } from "vitest";
import type { MapAdapter } from "./adapter";
import { leafletMapAdapterFactory } from "./leaflet-adapter";
import type { MapView } from "./view";

export const HAMBURG: MapView = { lat: 53.55, lng: 9.99, zoom: 13 };

/**
 * A real Leaflet map in a container of the given size (jsdom measures
 * nothing by itself), destroyed and removed when the test finishes unless
 * `unmount` did that before.
 */
export function mountLeafletMap(
  view: MapView = HAMBURG,
  size = { width: 800, height: 600 },
): { adapter: MapAdapter; container: HTMLDivElement; unmount: () => void } {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: size.width });
  Object.defineProperty(container, "clientHeight", { value: size.height });
  document.body.appendChild(container);
  const adapter = leafletMapAdapterFactory.create(container, {
    initialView: view,
    tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
    attribution: "©",
  });
  let mounted = true;
  const unmount = () => {
    if (!mounted) return;
    mounted = false;
    adapter.destroy();
    container.remove();
  };
  onTestFinished(unmount);
  return { adapter, container, unmount };
}

/**
 * A bare Leaflet map without the adapter, for testing one `leaflet-*` or
 * `kml-layer` module on its own; removed when the test finishes.
 */
export function mountPlainLeafletMap(): {
  map: L.Map;
  container: HTMLDivElement;
} {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: 800 });
  Object.defineProperty(container, "clientHeight", { value: 600 });
  document.body.appendChild(container);
  const map = L.map(container).setView(
    [HAMBURG.lat, HAMBURG.lng],
    HAMBURG.zoom,
  );
  onTestFinished(() => {
    map.remove();
    container.remove();
  });
  return { map, container };
}
