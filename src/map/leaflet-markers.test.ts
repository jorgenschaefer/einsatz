import { describe, expect, it } from "vitest";
import { leafletMapAdapterFactory } from "./leaflet-adapter";
import { expectTooltipText } from "./tooltip.fixtures";

describe("leaflet marker label", () => {
  it("places the Bezeichnung tooltip to the right of the symbol icon", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 800 });
    Object.defineProperty(container, "clientHeight", { value: 600 });
    document.body.appendChild(container);

    const adapter = leafletMapAdapterFactory.create(container, {
      initialView: { lat: 53.55, lng: 9.99, zoom: 13 },
      tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
      attribution: "©",
    });
    adapter.setMarker("s1", {
      lat: 53.55,
      lng: 9.99,
      iconUrl: "data:image/svg+xml,A",
      label: "83/1",
    });

    const tooltip = container.querySelector<HTMLElement>(
      ".leaflet-tooltip-right",
    );
    const icon = container.querySelector<HTMLElement>(".leaflet-marker-icon");
    expect(tooltip).not.toBeNull();
    expect(icon).not.toBeNull();
    expect(tooltip?.textContent).toBe("83/1");
    // Eigene Klasse als CSS-Haken (kastenlos, Halo, größere Schrift).
    expect(tooltip?.classList.contains("kartenzeichen-label")).toBe(true);

    // Linke Kante eines Leaflet-Elements: entweder translate3d(X…) oder (in jsdom
    // ohne 3D-Transform) das inline-left, jeweils plus margin-left (der Anker).
    const px = (v: string) => Number.parseFloat(v) || 0;
    const leftEdge = (el: HTMLElement) => {
      const t = /translate3d\((-?\d+(?:\.\d+)?)px/.exec(el.style.transform);
      const base = t ? Number(t[1]) : px(el.style.left);
      return base + px(el.style.marginLeft);
    };
    const iconRight = leftEdge(icon!) + px(icon!.style.width); // iconSize.x = 40
    const tooltipLeft = leftEdge(tooltip!);

    // Die Beschriftung beginnt rechts der rechten Symbolkante – keine Überlappung.
    expect(tooltipLeft).toBeGreaterThanOrEqual(iconRight);

    adapter.destroy();
    container.remove();
  });

  it("shows a Bezeichnung containing HTML as text, also after it changes", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: 800 });
    Object.defineProperty(container, "clientHeight", { value: 600 });
    document.body.appendChild(container);
    const adapter = leafletMapAdapterFactory.create(container, {
      initialView: { lat: 53.55, lng: 9.99, zoom: 13 },
      tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
      attribution: "©",
    });
    const spec = { lat: 53.55, lng: 9.99, iconUrl: "data:image/svg+xml,A" };
    const tooltip = () =>
      container.querySelector<HTMLElement>(".leaflet-tooltip-right");

    adapter.setMarker("s1", { ...spec, label: "<img src=x onerror=alert(1)>" });
    expectTooltipText(tooltip(), "<img src=x onerror=alert(1)>");

    adapter.setMarker("s1", { ...spec, label: "<b>neu</b>" });
    expectTooltipText(tooltip(), "<b>neu</b>");

    adapter.destroy();
    container.remove();
  });
});
