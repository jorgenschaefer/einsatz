import L from "leaflet";
import { describe, expect, it } from "vitest";
import {
  extractGeometry,
  kmlIconOptions,
  kmlPopupContent,
  parseKml,
} from "./leaflet-adapter";

describe("extractGeometry", () => {
  it("reads a circle's center and radius", () => {
    const layer = L.circle([53.55, 9.99], { radius: 250 });
    expect(extractGeometry("circle", layer)).toEqual({
      shape: "circle",
      center: { lat: 53.55, lng: 9.99 },
      radius: 250,
    });
  });

  it("reads a polygon's outer ring", () => {
    const layer = L.polygon([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
    expect(extractGeometry("polygon", layer)).toEqual({
      shape: "polygon",
      points: [
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
        { lat: 5, lng: 6 },
      ],
    });
  });

  it("reads a line's points as a flat list, not a ring", () => {
    const layer = L.polyline([
      [1, 2],
      [3, 4],
    ]);
    expect(extractGeometry("line", layer)).toEqual({
      shape: "line",
      points: [
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
      ],
    });
  });

  it("falls back to no points for an empty polygon ring", () => {
    const layer = L.polygon([] as L.LatLngExpression[]);
    expect(extractGeometry("polygon", layer)).toEqual({
      shape: "polygon",
      points: [],
    });
  });
});

describe("parseKml", () => {
  it("parses valid KML into a non-empty GeoJSON layer", () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
        <Placemark><Point><coordinates>9.99,53.55,0</coordinates></Point></Placemark>
      </Document></kml>`;
    const layer = parseKml(kml);
    expect(layer).not.toBeNull();
    expect(layer?.getLayers().length).toBeGreaterThan(0);
  });

  it("returns null for malformed XML", () => {
    expect(parseKml("<kml><unclosed>")).toBeNull();
  });

  it("binds a popup carrying the placemark name", () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
        <Placemark><name>Sammelplatz</name>
          <Point><coordinates>9.99,53.55,0</coordinates></Point>
        </Placemark>
      </Document></kml>`;
    const feature = parseKml(kml)?.getLayers()[0] as L.Marker;
    const popup = feature.getPopup();
    expect(popup).toBeDefined();
    expect((popup?.getContent() as HTMLElement).textContent).toContain(
      "Sammelplatz",
    );
  });

  it("binds no popup when the placemark has neither name nor description", () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
        <Placemark><Point><coordinates>9.99,53.55,0</coordinates></Point></Placemark>
      </Document></kml>`;
    const feature = parseKml(kml)?.getLayers()[0] as L.Marker;
    expect(feature.getPopup()).toBeUndefined();
  });

  it("renders a point's IconStyle icon href onto the marker", () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
        <Style id="s"><IconStyle><Icon>
          <href>https://example.com/pin.png</href>
        </Icon></IconStyle></Style>
        <Placemark><styleUrl>#s</styleUrl>
          <Point><coordinates>9.99,53.55,0</coordinates></Point>
        </Placemark>
      </Document></kml>`;
    const marker = parseKml(kml)?.getLayers()[0] as L.Marker;
    expect(marker.options.icon?.options.iconUrl).toBe(
      "https://example.com/pin.png",
    );
  });
});

describe("kmlPopupContent", () => {
  it("returns null when neither name nor description is present", () => {
    expect(kmlPopupContent({})).toBeNull();
  });

  it("shows the name in the popup element", () => {
    const el = kmlPopupContent({ name: "Sammelplatz" });
    expect(el?.textContent).toContain("Sammelplatz");
  });

  it("shows both name and description", () => {
    const el = kmlPopupContent({
      name: "Sammelplatz",
      description: "Am Nordtor",
    });
    expect(el?.textContent).toContain("Sammelplatz");
    expect(el?.textContent).toContain("Am Nordtor");
  });

  it("treats HTML in the name as text, not markup (no XSS)", () => {
    const el = kmlPopupContent({ name: "<img src=x onerror=alert(1)>" });
    expect(el?.querySelector("img")).toBeNull();
    expect(el?.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});

describe("kmlIconOptions", () => {
  it("returns null when there is no icon or the icon is a color", () => {
    expect(kmlIconOptions({})).toBeNull();
    expect(kmlIconOptions({ icon: "#ff0000" })).toBeNull();
  });

  it("uses a default 32px centered icon for a plain href", () => {
    expect(kmlIconOptions({ icon: "https://x/pin.png" })).toEqual({
      iconUrl: "https://x/pin.png",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  });

  it("scales the icon size by icon-scale", () => {
    const opts = kmlIconOptions({
      icon: "data:image/png;base64,AA",
      "icon-scale": 2,
    });
    expect(opts?.iconSize).toEqual([64, 64]);
    expect(opts?.iconAnchor).toEqual([32, 32]);
  });

  it("converts a fractional hotspot to a top-left anchor", () => {
    // KML misst y von unten; unten-Mitte (0.5, 0) → Leaflet-Anker [16, 32].
    const opts = kmlIconOptions({
      icon: "https://x/pin.png",
      "icon-offset": [0.5, 0],
      "icon-offset-units": ["fraction", "fraction"],
    });
    expect(opts?.iconAnchor).toEqual([16, 32]);
  });

  it("converts a pixel hotspot to a top-left anchor", () => {
    const opts = kmlIconOptions({
      icon: "https://x/pin.png",
      "icon-offset": [10, 5],
      "icon-offset-units": ["pixels", "pixels"],
    });
    expect(opts?.iconAnchor).toEqual([10, 27]);
  });

  it("falls back to center for unsupported hotspot units", () => {
    const opts = kmlIconOptions({
      icon: "https://x/pin.png",
      "icon-offset": [4, 4],
      "icon-offset-units": ["insetPixels", "insetPixels"],
    });
    expect(opts?.iconAnchor).toEqual([16, 16]);
  });
});
