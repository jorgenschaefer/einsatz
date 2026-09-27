import { expect, it } from "vitest";
import { leafletMapAdapterFactory } from "./leaflet-adapter";

it("places the zoom control bottom right on every map", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const adapter = leafletMapAdapterFactory.create(container, {
    initialView: { lat: 53.55, lng: 9.99, zoom: 13 },
    tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
    attribution: "©",
  });
  try {
    const zoom = container.querySelector(".leaflet-control-zoom");
    expect(zoom?.closest(".leaflet-bottom.leaflet-right")).not.toBeNull();
  } finally {
    adapter.destroy();
    container.remove();
  }
});
