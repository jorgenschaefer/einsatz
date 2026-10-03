import type L from "leaflet";
import { describe, expect, it } from "vitest";
import { kmlIconOptions, kmlPopupContent, parseKml } from "./kml-layer";
import { mountPlainLeafletMap } from "./leaflet-map.fixtures";

const DATA_PIN = "data:image/png;base64,AA";

const kmlWithIcon = (href: string) => `<?xml version="1.0"?>
  <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
    <Style id="s"><IconStyle><Icon>
      <href>${href}</href>
    </Icon></IconStyle></Style>
    <Placemark><styleUrl>#s</styleUrl>
      <Point><coordinates>9.99,53.55,0</coordinates></Point>
    </Placemark>
  </Document></kml>`;

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
    const content = popup?.getContent() as HTMLElement | undefined;
    expect(content?.textContent).toContain("Sammelplatz");
  });

  it("binds no popup when the placemark has neither name nor description", () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
        <Placemark><Point><coordinates>9.99,53.55,0</coordinates></Point></Placemark>
      </Document></kml>`;
    const feature = parseKml(kml)?.getLayers()[0] as L.Marker;
    expect(feature.getPopup()).toBeUndefined();
  });

  it("applies LineStyle and PolyStyle colors to the path", () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
        <Style id="s">
          <LineStyle><color>ff0000ff</color><width>4</width></LineStyle>
          <PolyStyle><color>7f00ff00</color></PolyStyle>
        </Style>
        <Placemark><styleUrl>#s</styleUrl>
          <Polygon><outerBoundaryIs><LinearRing><coordinates>
            9,53 9,54 10,54 9,53
          </coordinates></LinearRing></outerBoundaryIs></Polygon>
        </Placemark>
      </Document></kml>`;
    const path = parseKml(kml)?.getLayers()[0] as L.Polygon;
    expect(path.options.color).toBe("#ff0000");
    expect(path.options.weight).toBe(4);
    expect(path.options.fillColor).toBe("#00ff00");
    expect(path.options.fillOpacity).toBeCloseTo(0.498, 2);
  });

  it("leaves the Leaflet default style for an unstyled path", () => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
        <Placemark>
          <Polygon><outerBoundaryIs><LinearRing><coordinates>
            9,53 9,54 10,54 9,53
          </coordinates></LinearRing></outerBoundaryIs></Polygon>
        </Placemark>
      </Document></kml>`;
    const path = parseKml(kml)?.getLayers()[0] as L.Polygon;
    // Leaflet-Standardfarbe bleibt, kein erzwungenes undefined-Override.
    expect(path.options.color).toBe("#3388ff");
  });

  it("renders a point's embedded IconStyle icon onto the marker", () => {
    const marker = parseKml(kmlWithIcon(DATA_PIN))?.getLayers()[0] as L.Marker;
    expect(marker.options.icon?.options.iconUrl).toBe(DATA_PIN);
  });

  it("draws the circle and loads nothing for an icon from an http(s) address", () => {
    const { map, container } = mountPlainLeafletMap();

    parseKml(kmlWithIcon("https://example.com/pin.png"))?.addTo(map);

    expect(container.querySelector(".kml-point-circle")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("parseKml point without a usable icon", () => {
  const circleOf = (iconStyle: string) => {
    const kml = `<?xml version="1.0"?>
      <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
        <Style id="s">${iconStyle}</Style>
        <Placemark><styleUrl>#s</styleUrl>
          <Point><coordinates>9.99,53.55,0</coordinates></Point>
        </Placemark>
      </Document></kml>`;
    const marker = parseKml(kml)?.getLayers()[0] as L.Marker;
    const options = marker.options.icon?.options as L.DivIconOptions;
    const html = options?.html;
    expect(html).toBeInstanceOf(HTMLElement);
    return html as HTMLElement;
  };

  it("fills the circle with the IconStyle color", () => {
    const circle = circleOf("<IconStyle><color>ff4a9e2e</color></IconStyle>");
    expect(circle.style.backgroundColor).toBe("rgb(46, 158, 74)");
  });

  it("falls back to the default KML line color without an IconStyle color", () => {
    expect(circleOf("").style.backgroundColor).toBe("rgb(51, 136, 255)");
  });

  it("stays fully opaque when the KML color is transparent", () => {
    const circle = circleOf("<IconStyle><color>004a9e2e</color></IconStyle>");
    expect(circle.style.backgroundColor).toBe("rgb(46, 158, 74)");
    expect(circle.style.opacity).toBe("");
  });

  it("falls back to the default color for a color that is not hex", () => {
    const circle = circleOf(
      `<IconStyle><color>zz"&gt;&lt;b</color></IconStyle>`,
    );
    expect(circle.style.backgroundColor).toBe("rgb(51, 136, 255)");
    expect(circle.querySelector("b")).toBeNull();
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

  it("treats HTML in the description as text, not markup (no XSS)", () => {
    // KML-Beschreibungen tragen in der Praxis oft HTML/CDATA – muss Klartext bleiben.
    const el = kmlPopupContent({ description: "<img src=x onerror=alert(1)>" });
    expect(el?.querySelector("img")).toBeNull();
    expect(el?.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});

describe("kmlIconOptions", () => {
  it("returns null when there is no icon or the icon is a color", () => {
    expect(kmlIconOptions({})).toBeNull();
    expect(kmlIconOptions({ icon: "#ff0000" })).toBeNull();
  });

  it("returns null for an icon from an http(s) address", () => {
    expect(kmlIconOptions({ icon: "https://x/pin.png" })).toBeNull();
    expect(kmlIconOptions({ icon: "http://x/pin.png" })).toBeNull();
  });

  it("uses a default 32px centered icon for an embedded icon", () => {
    expect(kmlIconOptions({ icon: DATA_PIN })).toEqual({
      iconUrl: DATA_PIN,
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
      icon: DATA_PIN,
      "icon-offset": [0.5, 0],
      "icon-offset-units": ["fraction", "fraction"],
    });
    expect(opts?.iconAnchor).toEqual([16, 32]);
  });

  it("converts a pixel hotspot to a top-left anchor", () => {
    const opts = kmlIconOptions({
      icon: DATA_PIN,
      "icon-offset": [10, 5],
      "icon-offset-units": ["pixels", "pixels"],
    });
    expect(opts?.iconAnchor).toEqual([10, 27]);
  });

  it("falls back to center for unsupported hotspot units", () => {
    const opts = kmlIconOptions({
      icon: DATA_PIN,
      "icon-offset": [4, 4],
      "icon-offset-units": ["insetPixels", "insetPixels"],
    });
    expect(opts?.iconAnchor).toEqual([16, 16]);
  });
});

describe.each([
  ["without an IconStyle", ""],
  [
    "with a relative icon href",
    "<IconStyle><Icon><href>pin.png</href></Icon></IconStyle>",
  ],
])("a KML point %s", (_, style) => {
  const kmlWithPoint = `<?xml version="1.0"?>
    <kml xmlns="http://www.opengis.net/kml/2.2"><Document>
      <Style id="s">${style}</Style>
      <Placemark><name>Sammelplatz</name><styleUrl>#s</styleUrl>
        <Point><coordinates>9.99,53.55,0</coordinates></Point>
      </Placemark>
    </Document></kml>`;

  /** Draws the point on a map and returns its marker element. */
  function drawPoint() {
    const { map, container } = mountPlainLeafletMap();
    parseKml(kmlWithPoint)?.addTo(map);
    const marker = container.querySelector<HTMLElement>(".leaflet-marker-icon");
    return { container, marker };
  }

  const click = (el: HTMLElement | null) =>
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

  it("is drawn as a circle without loading any image", () => {
    const { container, marker } = drawPoint();

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
    const { marker } = drawPoint();

    expect(marker?.style.width).toBe("32px");
    expect(marker?.style.height).toBe("32px");
    expect(marker?.style.marginLeft).toBe("-16px");
    expect(marker?.style.marginTop).toBe("-16px");
  });

  it("opens the popup with the name when clicked", () => {
    const { container, marker } = drawPoint();

    click(marker);

    expect(
      container.querySelector(".leaflet-popup-content")?.textContent,
    ).toContain("Sammelplatz");
  });

  it("points the popup tip at the top of the circle, not into it", () => {
    const { container, marker } = drawPoint();

    click(marker);

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
    const popup = container.querySelector<HTMLElement>(".leaflet-popup");
    const pointY = layerY(marker!);
    const tipY = layerY(popup!) - px(popup!.style.bottom) - 7;
    expect(pointY - tipY).toBeGreaterThanOrEqual(19 / 2);
  });
});
