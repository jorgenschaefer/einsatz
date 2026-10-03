import { expect, it } from "vitest";
import { leafletMapAdapterFactory } from "./leaflet-adapter";

it("sends tile requests with the app's origin only", () => {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: 512 });
  Object.defineProperty(container, "clientHeight", { value: 512 });
  document.body.appendChild(container);
  const adapter = leafletMapAdapterFactory.create(container, {
    initialView: { lat: 53.55, lng: 9.99, zoom: 13 },
    tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
    attribution: "©",
  });
  try {
    const tiles = [
      ...container.querySelectorAll<HTMLImageElement>("img.leaflet-tile"),
    ];
    expect(tiles).not.toHaveLength(0);
    for (const tile of tiles) {
      expect(tile.referrerPolicy).toBe("strict-origin");
    }
  } finally {
    adapter.destroy();
    container.remove();
  }
});
