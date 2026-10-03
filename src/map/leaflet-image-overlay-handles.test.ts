import L from "leaflet";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ImagePlacement,
  rotationFromHandle,
  scaleMFromCorner,
} from "./image-overlay";
import { createImageOverlayHandles } from "./leaflet-image-overlay-handles";
import { mountPlainLeafletMap } from "./leaflet-map.fixtures";

const saved = {
  placement: {
    centerLat: 53.55,
    centerLng: 9.99,
    scaleM: 500,
    rotationDeg: 10,
    opacity: 0.8,
  },
  aspect: 1.5,
};

afterEach(() => {
  vi.restoreAllMocks();
});

/** Shows the handles of the saved image and collects them in drawing order. */
function showHandles() {
  const handles: L.Marker[] = [];
  const addTo = L.Marker.prototype.addTo;
  vi.spyOn(L.Marker.prototype, "addTo").mockImplementation(function (
    this: L.Marker,
    map,
  ) {
    handles.push(this);
    return addTo.call(this, map);
  });
  const { map } = mountPlainLeafletMap();
  const onDragEnd = vi.fn<(placement: ImagePlacement) => void>();
  createImageOverlayHandles(map).show(saved, { onDrag: vi.fn(), onDragEnd });
  return { handles, onDragEnd };
}

describe("dropping a corner or the rotate handle", () => {
  const dropped = { lat: 53.56, lng: 10.02 };

  /** Handles in drawing order: four corners, rotate, move. */
  function drop(handle: L.Marker) {
    handle.setLatLng([dropped.lat, dropped.lng]);
    handle.fire("drag");
    handle.fire("dragend");
  }

  it("scales the image from a corner", () => {
    const { handles, onDragEnd } = showHandles();
    drop(handles[0]);

    const scaleM = scaleMFromCorner(saved.placement, saved.aspect, dropped);
    expect(scaleM).not.toBe(saved.placement.scaleM);
    expect(onDragEnd).toHaveBeenCalledWith({ ...saved.placement, scaleM });
  });

  it("rotates the image with the rotate handle", () => {
    const { handles, onDragEnd } = showHandles();
    drop(handles[4]);

    const rotationDeg = rotationFromHandle(saved.placement, dropped);
    expect(rotationDeg).not.toBe(saved.placement.rotationDeg);
    expect(onDragEnd).toHaveBeenCalledWith({
      ...saved.placement,
      rotationDeg,
    });
  });
});
