import { expect, it } from "vitest";
import { leafletMapAdapterFactory } from "./leaflet-adapter";

// Auf der Vollbild-Karte wird der globale Footer ausgeblendet; Impressum und
// Datenschutz müssen daher über die Attributionsleiste erreichbar sein.
it("verlinkt Impressum und Datenschutz in der Attributionsleiste", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const adapter = leafletMapAdapterFactory.create(container, {
    initialView: { lat: 53.55, lng: 9.99, zoom: 13 },
    tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
    attribution: "©",
  });
  try {
    const attribution = container.querySelector(".leaflet-control-attribution");
    expect(attribution?.innerHTML).toContain('href="/impressum"');
    expect(attribution?.innerHTML).toContain('href="/datenschutz"');
  } finally {
    adapter.destroy();
    container.remove();
  }
});
