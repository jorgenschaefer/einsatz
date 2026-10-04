import { beforeEach, describe, expect, it } from "vitest";
import type { MapAdapter } from "./adapter";
import { mountLeafletMap } from "./leaflet-map.fixtures";

/** Leaflet's tooltip pane (Bezeichnungen, labels of Bereiche), from leaflet.css. */
const TOOLTIP_PANE_Z_INDEX = 650;

const HIT = { lat: 53.55, lng: 9.99 };
const OTHER_HIT = { lat: 53.56, lng: 10.01 };

let container: HTMLDivElement;
let adapter: MapAdapter;

beforeEach(() => {
  ({ adapter, container } = mountLeafletMap());
});

const pins = () => container.querySelectorAll<HTMLElement>(".search-hit");
const paneOf = (el: Element) => el.closest<HTMLElement>(".leaflet-pane");
const translate = (el: HTMLElement) => el.style.transform || el.style.left;

describe("leaflet Suchtreffer", () => {
  it("draws one unlabelled pin that lets taps through", () => {
    adapter.setSearchHit(HIT);

    expect(pins()).toHaveLength(1);
    const [pin] = pins();
    expect(pin.textContent).toBe("");
    expect(pin.classList.contains("leaflet-interactive")).toBe(false);
    expect(paneOf(pin)?.style.pointerEvents).toBe("none");
  });

  it("puts the tip of the pin on the position", () => {
    adapter.setSearchHit(HIT);

    const [pin] = pins();
    const svg = pin.querySelector("svg")!;
    const [minX, minY, viewWidth, viewHeight] = svg
      .getAttribute("viewBox")!
      .split(" ")
      .map(Number);
    const scaleX = Number(svg.getAttribute("width")) / viewWidth;
    const scaleY = Number(svg.getAttribute("height")) / viewHeight;
    // The path's tip is at (0, 0) in the viewBox; Leaflet anchors the icon
    // by shifting it with negative margins.
    expect(-Number.parseFloat(pin.style.marginLeft)).toBe(-minX * scaleX);
    expect(-Number.parseFloat(pin.style.marginTop)).toBe(-minY * scaleY);
  });

  it("stands above Bezeichnungen and Bereichsbeschriftungen", () => {
    adapter.setMarker("s1", {
      ...HIT,
      iconUrl: "data:image/svg+xml,A",
      label: "83/1",
    });
    adapter.setArea("a1", {
      geometry: { shape: "circle", center: HIT, radius: 100 },
      color: "#e2001a",
      opacity: 0.4,
      label: "Deich",
    });
    adapter.setSearchHit(HIT);

    const labels = container.querySelectorAll(".leaflet-tooltip");
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(paneOf(label)?.classList).toContain("leaflet-tooltip-pane");
    }
    expect(Number(paneOf(pins()[0])?.style.zIndex)).toBeGreaterThan(
      TOOLTIP_PANE_Z_INDEX,
    );
  });

  it("moves the one pin to the next Suchtreffer", () => {
    adapter.setSearchHit(HIT);
    adapter.setSearchHit(OTHER_HIT);
    adapter.setMarker("s1", {
      ...OTHER_HIT,
      iconUrl: "data:image/svg+xml,A",
    });

    expect(pins()).toHaveLength(1);
    const marker = container.querySelector<HTMLElement>(
      ".leaflet-marker-icon:not(.search-hit)",
    );
    expect(translate(pins()[0])).toBe(translate(marker!));
  });

  it("removes the pin when the Suchtreffer is cleared", () => {
    adapter.setSearchHit(HIT);
    expect(pins()).toHaveLength(1);
    adapter.clearSearchHit();
    expect(pins()).toHaveLength(0);
  });

  it("clears without a pin drawn", () => {
    adapter.clearSearchHit();
    adapter.setSearchHit(HIT);
    expect(pins()).toHaveLength(1);
  });
});
