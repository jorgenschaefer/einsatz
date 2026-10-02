import { describe, expect, it } from "vitest";
import type { ImageOverlaySpec } from "./adapter";
import { imageSignature } from "./leaflet-image-overlays";

const image = (over: Partial<ImageOverlaySpec> = {}): ImageOverlaySpec => ({
  imageUrl: "/img/1",
  placement: {
    centerLat: 1,
    centerLng: 2,
    scaleM: 100,
    rotationDeg: 0,
    opacity: 0.8,
  },
  aspect: 1.5,
  visible: true,
  ...over,
});

describe("imageSignature", () => {
  it("changes with url, placement, aspect or visibility", () => {
    expect(imageSignature(image())).toBe(imageSignature(image()));
    expect(imageSignature(image())).not.toBe(
      imageSignature(image({ visible: false })),
    );
    expect(imageSignature(image())).not.toBe(
      imageSignature(image({ aspect: 2 })),
    );
    expect(imageSignature(image())).not.toBe(
      imageSignature(
        image({
          placement: {
            centerLat: 1,
            centerLng: 2,
            scaleM: 100,
            rotationDeg: 90,
            opacity: 0.8,
          },
        }),
      ),
    );
  });
});
