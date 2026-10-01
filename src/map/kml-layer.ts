import { kml as kmlToGeoJson } from "@tmcw/togeojson";
import L from "leaflet";

// Basisgröße (px) eines KML-Symbols bei <scale>1; togeojson liefert nur den
// Skalierungsfaktor, keine Pixelmaße.
const KML_ICON_BASE = 32;

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

/**
 * Baut aus den von togeojson gelieferten Punkt-Eigenschaften die Leaflet-Icon-
 * Optionen. `null`, wenn kein verwertbares Bild vorliegt – dann bleibt der
 * Standardmarker. `icon` kann bei `<IconStyle><color>` eine Farbe statt einer
 * URL enthalten; daher nur echte URL-/Data-Verweise akzeptieren.
 */
export function kmlIconOptions(
  props: Record<string, unknown>,
): L.IconOptions | null {
  const icon = props.icon;
  if (typeof icon !== "string" || !/^(https?:\/\/|data:)/.test(icon)) {
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

/**
 * Wandelt KML-Text in eine Leaflet-GeoJSON-Ebene. Punkte mit `<IconStyle>`
 * erhalten ihr Symbol (sonst der Standardmarker). Fehlerhaftes XML (DOMParser
 * liefert dann ein <parsererror>, statt zu werfen) und Parse-Ausnahmen ergeben
 * null, damit ein kaputtes Overlay die Lagekarte nicht abstürzen lässt.
 */
export function parseKml(content: string): L.GeoJSON | null {
  try {
    const doc = new DOMParser().parseFromString(content, "text/xml");
    if (doc.querySelector("parsererror")) return null;
    return L.geoJSON(kmlToGeoJson(doc), {
      style: (feature) => kmlPathStyle(feature?.properties ?? {}),
      pointToLayer: (feature, latlng) => {
        const opts = kmlIconOptions(feature.properties ?? {});
        return opts
          ? L.marker(latlng, { icon: L.icon(opts) })
          : L.marker(latlng);
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
