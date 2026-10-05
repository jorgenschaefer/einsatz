import { describe, expect, it } from "vitest";
import type { MarkerSpec } from "./adapter";
import { mountLeafletMap } from "./leaflet-map.fixtures";
import { markerVisualSignature } from "./leaflet-markers";
import { expectTooltipText } from "./tooltip.fixtures";

describe("markerVisualSignature", () => {
  const marker = (over: Partial<MarkerSpec> = {}): MarkerSpec => ({
    lat: 53.55,
    lng: 9.99,
    iconUrl: "data:image/svg+xml,A",
    opacity: 1,
    ...over,
  });

  it("ignores callback identity and position", () => {
    expect(markerVisualSignature(marker({ onClick: () => {} }))).toBe(
      markerVisualSignature(marker({ onClick: () => {}, lat: 10, lng: 20 })),
    );
  });

  it("changes when the icon, opacity or label changes", () => {
    expect(markerVisualSignature(marker())).not.toBe(
      markerVisualSignature(marker({ iconUrl: "data:image/svg+xml,B" })),
    );
    expect(markerVisualSignature(marker())).not.toBe(
      markerVisualSignature(marker({ opacity: 0.4 })),
    );
    expect(markerVisualSignature(marker())).not.toBe(
      markerVisualSignature(marker({ label: "83/1" })),
    );
  });
});

describe("leaflet marker label", () => {
  const spec = { lat: 53.55, lng: 9.99, iconUrl: "data:image/svg+xml,A" };

  it("places the Bezeichnung tooltip to the right of the symbol icon", () => {
    const { adapter, container } = mountLeafletMap();
    adapter.setMarker("s1", { ...spec, label: "83/1" });

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
  });

  it("shows a Bezeichnung containing HTML as text, also after it changes", () => {
    const { adapter, container } = mountLeafletMap();
    const tooltip = () =>
      container.querySelector<HTMLElement>(".leaflet-tooltip-right");

    adapter.setMarker("s1", { ...spec, label: "<img src=x onerror=alert(1)>" });
    expectTooltipText(tooltip(), "<img src=x onerror=alert(1)>");

    adapter.setMarker("s1", { ...spec, label: "<b>neu</b>" });
    expectTooltipText(tooltip(), "<b>neu</b>");
  });
});

describe("leaflet marker drag", () => {
  const spec = { lat: 53.55, lng: 9.99, iconUrl: "data:image/svg+xml,A" };
  // Leaflet erkennt die linke Taste an `which`, das jsdom nicht setzt.
  const mouse = (type: string, target: Element, x: number) => {
    const event = new MouseEvent(type, { bubbles: true, clientX: x });
    Object.defineProperty(event, "which", { value: 1 });
    target.dispatchEvent(event);
  };

  it("keeps the dragged position when an update arrives mid-drag", () => {
    const { adapter, container } = mountLeafletMap();
    const dropped: { lat: number; lng: number }[] = [];
    const draggable = {
      ...spec,
      draggable: true,
      onDragEnd: (p: { lat: number; lng: number }) => dropped.push(p),
    };
    adapter.setMarker("s1", draggable);
    const icon = container.querySelector<HTMLElement>(".leaflet-marker-icon");

    mouse("mousedown", icon!, 100);
    mouse("mousemove", icon!, 200);
    adapter.setMarker("s1", draggable);
    mouse("mouseup", icon!, 200);

    expect(dropped).toHaveLength(1);
    expect(dropped[0].lng).toBeGreaterThan(spec.lng);
  });

  it("follows updates again once the drag has ended", () => {
    const { adapter, container } = mountLeafletMap();
    const draggable = { ...spec, draggable: true, onDragEnd: () => {} };
    adapter.setMarker("s1", draggable);
    const icon = container.querySelector<HTMLElement>(".leaflet-marker-icon");
    mouse("mousedown", icon!, 100);
    mouse("mousemove", icon!, 200);
    mouse("mouseup", icon!, 200);
    const left = () => icon!.style.left;
    const droppedAt = left();

    adapter.setMarker("s1", draggable);

    expect(left()).not.toBe(droppedAt);
  });
});
