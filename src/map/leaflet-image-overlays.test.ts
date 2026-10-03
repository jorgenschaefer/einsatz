import L from "leaflet";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImageOverlaySpec, MapAdapter } from "./adapter";
import { imageOverlayCorners, imageOverlayHandles } from "./image-overlay";
import { imageSignature } from "./leaflet-image-overlays";
import { mountLeafletMap } from "./leaflet-map.fixtures";

const saved: ImageOverlaySpec = {
  imageUrl: "/img/i1",
  placement: {
    centerLat: 53.55,
    centerLng: 9.99,
    scaleM: 500,
    rotationDeg: 10,
    opacity: 0.8,
  },
  aspect: 1.5,
  visible: true,
};

/** What the rotated-overlay plugin keeps of a drawn image. */
type RotatedLayer = L.ImageOverlay & {
  _map: L.Map | null;
  _topLeft: L.LatLng;
  _topRight: L.LatLng;
  _bottomLeft: L.LatLng;
};

let adapter: MapAdapter;

/**
 * Draws the saved image, starts editing it and collects what the adapter
 * keeps private: the handles and the image layers it creates.
 */
function editSavedImage() {
  const handles: L.Marker[] = [];
  const addTo = L.Marker.prototype.addTo;
  vi.spyOn(L.Marker.prototype, "addTo").mockImplementation(function (
    this: L.Marker,
    map,
  ) {
    handles.push(this);
    return addTo.call(this, map);
  });
  const plugin = L.imageOverlay as unknown as {
    rotated: (...args: unknown[]) => RotatedLayer;
  };
  const rotated = plugin.rotated;
  const layers: RotatedLayer[] = [];
  vi.spyOn(plugin, "rotated").mockImplementation((...args) => {
    const layer = rotated(...args);
    layers.push(layer);
    return layer;
  });

  ({ adapter } = mountLeafletMap());
  adapter.setImageOverlay("i1", saved);
  const onChange = vi.fn();
  adapter.startImageOverlayEdit("i1", onChange);
  return { handles, layers, onChange };
}

/** Drags the move handle, the last of the six, to a new centre. */
function dragMoveHandle(handles: L.Marker[]) {
  const moveHandle = handles.at(-1)!;
  moveHandle.setLatLng([53.6, 10.1]);
  moveHandle.fire("drag");
  moveHandle.fire("dragend");
}

const latLngOf = (p: L.LatLng) => ({ lat: p.lat, lng: p.lng });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dragging an image overlay's move handle", () => {
  const moved = { ...saved.placement, centerLat: 53.6, centerLng: 10.1 };

  it("shows the image on the new placement while dragging", () => {
    const { handles, layers } = editSavedImage();
    const moveHandle = handles.at(-1)!;
    moveHandle.setLatLng([moved.centerLat, moved.centerLng]);
    moveHandle.fire("drag");

    const shown = layers.filter((layer) => layer._map !== null);
    const c = imageOverlayCorners(moved, saved.aspect);
    expect(latLngOf(shown[0]._topLeft)).toEqual(c.topLeft);
  });

  it("reports nothing until the handle is dropped", () => {
    const { handles, onChange } = editSavedImage();
    const moveHandle = handles.at(-1)!;
    moveHandle.setLatLng([moved.centerLat, moved.centerLng]);
    moveHandle.fire("drag");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports the new placement when the handle is dropped", () => {
    const { handles, onChange } = editSavedImage();
    dragMoveHandle(handles);

    expect(onChange).toHaveBeenCalledWith(moved);
  });
});

describe("restoring an image overlay after a gesture", () => {
  it("puts every handle back on the saved placement", () => {
    const { handles } = editSavedImage();
    dragMoveHandle(handles);

    adapter.restoreImageOverlay("i1");

    const h = imageOverlayHandles(saved.placement, saved.aspect);
    expect(
      handles.slice(-6).map((handle) => latLngOf(handle.getLatLng())),
    ).toEqual([
      h.topLeft,
      h.topRight,
      h.bottomRight,
      h.bottomLeft,
      h.rotate,
      h.center,
    ]);
  });

  it("shows the image on the saved corners", () => {
    const { handles, layers } = editSavedImage();
    dragMoveHandle(handles);

    adapter.restoreImageOverlay("i1");

    const shown = layers.filter((layer) => layer._map !== null);
    expect(shown).toHaveLength(1);
    const c = imageOverlayCorners(saved.placement, saved.aspect);
    expect([
      latLngOf(shown[0]._topLeft),
      latLngOf(shown[0]._topRight),
      latLngOf(shown[0]._bottomLeft),
    ]).toEqual([c.topLeft, c.topRight, c.bottomLeft]);
  });

  it("ignores an image overlay it does not know", () => {
    editSavedImage();

    expect(() => adapter.restoreImageOverlay("unknown")).not.toThrow();
  });
});

describe("imageSignature", () => {
  const image = (over: Partial<ImageOverlaySpec> = {}): ImageOverlaySpec => ({
    ...saved,
    ...over,
  });

  it("changes with url, placement, aspect or visibility", () => {
    expect(imageSignature(image())).toBe(imageSignature(image()));
    expect(imageSignature(image())).not.toBe(
      imageSignature(image({ imageUrl: "/img/i2" })),
    );
    expect(imageSignature(image())).not.toBe(
      imageSignature(image({ visible: false })),
    );
    expect(imageSignature(image())).not.toBe(
      imageSignature(image({ aspect: 2 })),
    );
    expect(imageSignature(image())).not.toBe(
      imageSignature(
        image({ placement: { ...saved.placement, rotationDeg: 90 } }),
      ),
    );
  });
});
