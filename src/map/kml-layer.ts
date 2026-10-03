import { kml as kmlToGeoJson } from "@tmcw/togeojson";
import L from "leaflet";
import "./kml-layer.css";

// Basisgröße (px) eines KML-Symbols bei <scale>1; togeojson liefert nur den
// Skalierungsfaktor, keine Pixelmaße.
const KML_ICON_BASE = 32;

// Kreis für Punkte ohne Bild: Tippfläche (px) und Außenradius (px) aus 7 px
// Fläche und 2,5 px weißem Rand (`.kml-point-circle` in `kml-layer.css`),
// aufgerundet; das Popup setzt dort an statt mitten im Kreis.
const KML_POINT_TAP_AREA = 32;
const KML_CIRCLE_RADIUS = 10;

// Leaflets Standardfarbe für Pfade, also auch die ungestylter KML-Linien.
const KML_DEFAULT_COLOR = "#3388ff";

/**
 * Wandelt KML-Text in eine Leaflet-GeoJSON-Ebene. Punkte mit verwertbarem
 * `<IconStyle>`-Bild erhalten ihr Symbol, alle anderen einen Kreis.
 * Fehlerhaftes XML (DOMParser liefert dann ein <parsererror>, statt zu werfen)
 * und Parse-Ausnahmen ergeben null, damit ein kaputtes Overlay die Lagekarte
 * nicht abstürzen lässt.
 */
export function parseKml(content: string): L.GeoJSON | null {
  try {
    const doc = new DOMParser().parseFromString(content, "text/xml");
    if (doc.querySelector("parsererror")) return null;
    return L.geoJSON(kmlToGeoJson(doc), {
      style: (feature) => kmlPathStyle(feature?.properties ?? {}),
      pointToLayer: (feature, latlng) => {
        const props = feature.properties ?? {};
        const opts = kmlIconOptions(props);
        return L.marker(latlng, {
          icon: opts ? L.icon(opts) : kmlPointCircle(props),
        });
      },
      onEachFeature: (feature, layer) => {
        const popup = kmlPopupContent(feature.properties ?? {});
        if (popup) layer.bindPopup(popup);
      },
    });
  } catch {
    return null;
  }
}

/**
 * Übersetzt die von togeojson gelieferten Style-Properties eines KML-Features in
 * Leaflet-Pfadoptionen (Linien/Polygone). Nur vorhandene Werte werden gesetzt,
 * damit ungestylte Features den Leaflet-Standardstil behalten statt auf
 * `undefined` überschrieben zu werden. togeojson liefert Farben bereits als
 * `#rrggbb` und die Opazität als 0..1.
 */
function kmlPathStyle(props: Record<string, unknown>): L.PathOptions {
  const style: L.PathOptions = {};
  if (typeof props.stroke === "string") style.color = props.stroke;
  if (typeof props["stroke-width"] === "number")
    style.weight = props["stroke-width"];
  if (typeof props["stroke-opacity"] === "number")
    style.opacity = props["stroke-opacity"];
  if (typeof props.fill === "string") style.fillColor = props.fill;
  if (typeof props["fill-opacity"] === "number")
    style.fillOpacity = props["fill-opacity"];
  return style;
}

/**
 * Baut aus den von togeojson gelieferten Punkt-Eigenschaften die Leaflet-Icon-
 * Optionen. `null`, wenn kein eingebettetes Bild vorliegt – dann wird der Punkt
 * ein Kreis. Nur `data:`-URLs: Der Server bettet Symbole von http(s)-Adressen
 * beim Einbinden ein, damit der Browser nichts von fremden Hosts lädt; ein
 * Symbol, das noch eine solche Adresse trägt, wurde nicht eingebettet. `icon`
 * kann bei `<IconStyle><color>` auch eine Farbe statt einer URL enthalten.
 */
export function kmlIconOptions(
  props: Record<string, unknown>,
): L.IconOptions | null {
  const icon = props.icon;
  if (typeof icon !== "string" || !icon.startsWith("data:")) {
    return null;
  }
  const scale = props["icon-scale"];
  const factor = typeof scale === "number" && scale > 0 ? scale : 1;
  const size = Math.round(KML_ICON_BASE * factor);
  return {
    iconUrl: icon,
    iconSize: [size, size],
    iconAnchor: kmlIconAnchor(props, size),
  };
}

/** Leaflet-Anker (px von oben links) aus einem KML-`<hotSpot>`. KML misst y von
 *  unten; ohne Hotspot bzw. bei unbekannten Einheiten wird zentriert. */
function kmlIconAnchor(
  props: Record<string, unknown>,
  size: number,
): [number, number] {
  const offset = props["icon-offset"];
  const units = props["icon-offset-units"];
  if (
    Array.isArray(offset) &&
    typeof offset[0] === "number" &&
    typeof offset[1] === "number" &&
    Array.isArray(units)
  ) {
    const x = hotspotAxisToPixels(offset[0], units[0], size);
    const yFromBottom = hotspotAxisToPixels(offset[1], units[1], size);
    if (x !== null && yFromBottom !== null) return [x, size - yFromBottom];
  }
  return [size / 2, size / 2];
}

/** Rechnet einen Hotspot-Achsenwert in Pixel um; `null` für nicht unterstützte
 *  Einheiten (dann fällt der Aufrufer auf die Mitte zurück). */
function hotspotAxisToPixels(
  value: number,
  unit: unknown,
  size: number,
): number | null {
  if (unit === "fraction") return value * size;
  if (unit === "pixels") return value;
  return null; // insetPixels/unbekannt: nicht unterstützt
}

/**
 * Kreis für einen KML-Punkt ohne verwertbares Bild: 32-px-Tippfläche, mittig
 * der Kreis in der `<IconStyle>`-Farbe (Größe und Rand: `kml-layer.css`).
 * Die Farbe ist Fremddaten und gilt nur als Hex-Wert; die Deckkraft aus der
 * KML bleibt unbeachtet, der Kreis ist immer voll deckend.
 */
function kmlPointCircle(props: Record<string, unknown>): L.DivIcon {
  const color = props["icon-color"];
  const circle = document.createElement("span");
  circle.className = "kml-point-circle";
  circle.style.backgroundColor =
    typeof color === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)
      ? color
      : KML_DEFAULT_COLOR;
  return L.divIcon({
    className: "kml-point",
    html: circle,
    iconSize: [KML_POINT_TAP_AREA, KML_POINT_TAP_AREA],
    iconAnchor: [KML_POINT_TAP_AREA / 2, KML_POINT_TAP_AREA / 2],
    popupAnchor: [0, -KML_CIRCLE_RADIUS],
  });
}

/**
 * Baut aus den von togeojson gelieferten Properties den Popup-Inhalt eines KML-
 * Placemarks: `name` als Titel, `description` als Absatz darunter. `null`, wenn
 * beides fehlt (dann bleibt das Feature ohne Popup). Der Inhalt wird über
 * `textContent` gesetzt statt als HTML-String – `name`/`description` sind
 * Fremddaten, ein HTML-String würde von Leaflet als `innerHTML` interpretiert
 * (XSS). HTML in der Beschreibung erscheint dadurch bewusst als Klartext.
 */
export function kmlPopupContent(
  props: Record<string, unknown>,
): HTMLElement | null {
  const name = typeof props.name === "string" ? props.name : "";
  const description =
    typeof props.description === "string" ? props.description : "";
  if (!name && !description) return null;

  const container = document.createElement("div");
  if (name) {
    const title = document.createElement("strong");
    title.textContent = name;
    container.appendChild(title);
  }
  if (description) {
    const body = document.createElement("p");
    body.textContent = description;
    container.appendChild(body);
  }
  return container;
}
