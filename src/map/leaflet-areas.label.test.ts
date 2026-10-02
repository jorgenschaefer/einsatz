import { describe, it } from "vitest";
import { leafletMapAdapterFactory } from "./leaflet-adapter";
import { expectTooltipText } from "./tooltip.fixtures";

describe("leaflet area label", () => {
  it("shows a Beschriftung containing HTML as text, also after it changes", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 800 });
    Object.defineProperty(container, "clientHeight", { value: 600 });
    document.body.appendChild(container);
    const adapter = leafletMapAdapterFactory.create(container, {
      initialView: { lat: 53.55, lng: 9.99, zoom: 13 },
      tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
      attribution: "©",
    });
    const spec = {
      geometry: {
        shape: "circle" as const,
        center: { lat: 53.55, lng: 9.99 },
        radius: 250,
      },
      color: "#e8590c",
      opacity: 0.3,
    };
    const tooltip = () =>
      container.querySelector<HTMLElement>(".leaflet-tooltip");

    adapter.setArea("b1", { ...spec, label: "<img src=x onerror=alert(1)>" });
    expectTooltipText(tooltip(), "<img src=x onerror=alert(1)>");

    adapter.setArea("b1", { ...spec, label: "<b>neu</b>" });
    expectTooltipText(tooltip(), "<b>neu</b>");

    adapter.destroy();
    container.remove();
  });
});
