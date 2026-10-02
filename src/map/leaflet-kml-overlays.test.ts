import { afterEach, describe, expect, it } from "vitest";
import type { MapAdapter } from "./adapter";
import { leafletMapAdapterFactory } from "./leaflet-adapter";

const kmlWithPoint = (style: string) => `<?xml version="1.0"?>
  <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
    <Style id="s">${style}</Style>
    <Placemark><name>Sammelplatz</name><styleUrl>#s</styleUrl>
      <Point><coordinates>9.99,53.55,0</coordinates></Point>
    </Placemark>
  </Document></kml>`;

let adapter: MapAdapter;
let container: HTMLDivElement;

function drawKml(content: string) {
  container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: 800 });
  Object.defineProperty(container, "clientHeight", { value: 600 });
  document.body.appendChild(container);
  adapter = leafletMapAdapterFactory.create(container, {
    initialView: { lat: 53.55, lng: 9.99, zoom: 13 },
    tileUrl: "https://tiles.example/{z}/{x}/{y}.png",
    attribution: "©",
  });
  adapter.setKmlOverlay("k1", { content, visible: true });
}

afterEach(() => {
  adapter.destroy();
  container.remove();
});

describe.each([
  ["without an IconStyle", ""],
  [
    "with a relative icon href",
    "<IconStyle><Icon><href>pin.png</href></Icon></IconStyle>",
  ],
])("a KML point %s", (_, style) => {
  it("is drawn as a circle without loading any image", () => {
    drawKml(kmlWithPoint(style));

    const marker = container.querySelector<HTMLElement>(".leaflet-marker-icon");
    expect(marker).not.toBeNull();
    expect(marker?.tagName).not.toBe("IMG");
    expect(
      container.querySelector(
        ".leaflet-marker-pane img, .leaflet-shadow-pane img, img[src*='marker-']",
      ),
    ).toBeNull();
    expect(marker?.querySelector(".kml-point-circle")).not.toBeNull();
  });

  it("has a 32 px tap area centred on the point", () => {
    drawKml(kmlWithPoint(style));

    const marker = container.querySelector<HTMLElement>(".leaflet-marker-icon");
    expect(marker?.style.width).toBe("32px");
    expect(marker?.style.height).toBe("32px");
    expect(marker?.style.marginLeft).toBe("-16px");
    expect(marker?.style.marginTop).toBe("-16px");
  });

  it("opens the popup with the name when clicked", () => {
    drawKml(kmlWithPoint(style));

    container
      .querySelector<HTMLElement>(".leaflet-marker-icon")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(
      container.querySelector(".leaflet-popup-content")?.textContent,
    ).toContain("Sammelplatz");
  });

  it("points the popup tip at the top of the circle, not into it", () => {
    drawKml(kmlWithPoint(style));

    container
      .querySelector<HTMLElement>(".leaflet-marker-icon")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Layer y of an element: translate3d(…, Y) or, in jsdom without 3D
    // transforms, the inline top. The popup hangs from its `bottom`, and
    // Leaflet's default 7 px offset is the height of its tip.
    const px = (v: string) => Number.parseFloat(v) || 0;
    const layerY = (el: HTMLElement) => {
      const t = /translate3d\([^,]+,\s*(-?\d+(?:\.\d+)?)px/.exec(
        el.style.transform,
      );
      return t ? Number(t[1]) : px(el.style.top);
    };
    const marker = container.querySelector<HTMLElement>(".leaflet-marker-icon");
    const popup = container.querySelector<HTMLElement>(".leaflet-popup");
    const pointY = layerY(marker!);
    const tipY = layerY(popup!) - px(popup!.style.bottom) - 7;
    expect(pointY - tipY).toBeGreaterThanOrEqual(19 / 2);
  });
});
