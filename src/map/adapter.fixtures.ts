import { vi } from "vitest";
import type { CreateMapOptions, MapAdapterFactory } from "./adapter";
import type { LatLng, MapView, ViewExtent } from "./view";

/**
 * A map adapter without Leaflet: every method is a `vi.fn()`, the options of
 * the last `create` are in `captured`, and what the map shows in `drawn`.
 */
export function fakeMapAdapterFactory(
  currentView: MapView = { lat: 0, lng: 0, zoom: 1 },
  currentExtent: ViewExtent = { lat: 0, lng: 0, widthM: 4000, heightM: 3000 },
) {
  const captured: { options?: CreateMapOptions } = {};
  const drawn: { searchHit: LatLng | null } = { searchHit: null };
  const adapter = {
    getView: () => currentView,
    getViewExtent: () => currentExtent,
    setView: vi.fn(),
    setMarker: vi.fn(),
    removeMarker: vi.fn(),
    setArea: vi.fn(),
    removeArea: vi.fn(),
    setKmlOverlay: vi.fn(),
    removeKmlOverlay: vi.fn(),
    setImageOverlay: vi.fn(),
    removeImageOverlay: vi.fn(),
    restoreImageOverlay: vi.fn(),
    startImageOverlayEdit: vi.fn(),
    stopImageOverlayEdit: vi.fn(),
    startDrawing: vi.fn(),
    cancelDrawing: vi.fn(),
    startCirclePreview: vi.fn(),
    stopCirclePreview: vi.fn(),
    setSearchHit: vi.fn((position: LatLng) => {
      drawn.searchHit = position;
    }),
    clearSearchHit: vi.fn(() => {
      drawn.searchHit = null;
    }),
    destroy: vi.fn(),
  };
  const create = vi.fn((_c: HTMLElement, options: CreateMapOptions) => {
    captured.options = options;
    return adapter;
  });
  const factory: MapAdapterFactory = { create };
  return { factory, create, captured, adapter, drawn };
}
