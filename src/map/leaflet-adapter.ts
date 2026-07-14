import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./leaflet-adapter.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet-imageoverlay-rotated";
import { kml as kmlToGeoJson } from "@tmcw/togeojson";
import type {
  AreaSpec,
  ImageOverlaySpec,
  MapAdapter,
  MapAdapterFactory,
  MarkerSpec,
} from "./adapter";
import type { AreaGeometry, AreaShape } from "./area";
import {
  type ImagePlacement,
  imageOverlayCorners,
  imageOverlayHandles,
  type LatLng,
  rotationFromHandle,
  scaleMFromCorner,
} from "./image-overlay";
import {
  areaSignature,
  imageSignature,
  kmlSignature,
  markerVisualSignature,
} from "./layer-signature";
import { type MapView, MAX_TILE_ZOOM } from "./view";

/** Vom Plugin ergänzt: platziert ein (dreh-/scherbares) Bild über drei Ecken. */
type RotatedImageOverlayFactory = (
  imageUrl: string,
  topLeft: L.LatLngExpression,
  topRight: L.LatLngExpression,
  bottomLeft: L.LatLngExpression,
  options?: { opacity?: number },
) => L.ImageOverlay;

const toPoints = (latlngs: L.LatLng[]) =>
  latlngs.map((p) => ({ lat: p.lat, lng: p.lng }));

function applyAreaStyle(layer: L.Path, spec: AreaSpec) {
  if (spec.geometry.shape === "line") {
    layer.setStyle({ color: spec.color, opacity: spec.opacity, weight: 3 });
  } else {
    layer.setStyle({
      color: spec.color,
      fillColor: spec.color,
      fillOpacity: spec.opacity,
      opacity: 1,
      weight: 2,
    });
  }
  if (spec.label)
    layer.bindTooltip(spec.label, { permanent: true, direction: "center" });
  const { onClick } = spec;
  if (onClick) layer.on("click", () => onClick());
}

function areaLayer(spec: AreaSpec): L.Path {
  const g = spec.geometry;
  if (g.shape === "circle")
    return L.circle([g.center.lat, g.center.lng], { radius: g.radius });
  const points = g.points.map((p) => [p.lat, p.lng] as [number, number]);
  return g.shape === "polygon" ? L.polygon(points) : L.polyline(points);
}

const GEOMAN_SHAPE: Record<AreaShape, "Polygon" | "Line" | "Circle"> = {
  polygon: "Polygon",
  line: "Line",
  circle: "Circle",
};

export function extractGeometry(
  shape: AreaShape,
  layer: L.Layer,
): AreaGeometry {
  if (shape === "circle") {
    const c = (layer as L.Circle).getLatLng();
    return {
      shape: "circle",
      center: { lat: c.lat, lng: c.lng },
      radius: (layer as L.Circle).getRadius(),
    };
  }
  const latlngs = (layer as L.Polyline).getLatLngs();
  const ring =
    (shape === "polygon"
      ? (latlngs[0] as L.LatLng[])
      : (latlngs as L.LatLng[])) ?? [];
  return { shape, points: toPoints(ring) };
}

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

/**
 * Leaflet-Implementierung des {@link MapAdapter}. Der einzige Ort, der direkt
 * mit Leaflet spricht; wird nur clientseitig (dynamisch) geladen.
 */
export const leafletMapAdapterFactory: MapAdapterFactory = {
  create(container, options) {
    const map = L.map(container).setView(
      [options.initialView.lat, options.initialView.lng],
      options.initialView.zoom,
    );
    // Zoom nach unten links – oben links liegt die schwebende Suche.
    map.zoomControl.setPosition("bottomleft");

    // Auf der Vollbild-Karte gibt es keinen Footer; Impressum und Datenschutz
    // stehen daher als Präfix in der Attributionsleiste (unten rechts, neben
    // OpenStreetMap/MapTiler) statt der voreingestellten Leaflet-Kennung.
    map.attributionControl.setPrefix(
      '<a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a>',
    );

    L.tileLayer(options.tileUrl, {
      attribution: options.attribution,
      maxZoom: MAX_TILE_ZOOM,
    }).addTo(map);

    // Leaflet vermisst den Container nur bei window-resize neu. Ändert sich die
    // Container-Größe anderweitig (z. B. beim Ein-/Ausklappen der Seitenleiste),
    // bliebe sonst ein ungefüllter grauer Streifen – daher selbst beobachten.
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => map.invalidateSize());
    resizeObserver?.observe(container);

    const currentView = (): MapView => {
      const center = map.getCenter();
      return { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
    };

    const emitViewChange = () => options.onViewChange?.(currentView());
    map.on("moveend", emitViewChange);
    map.on("zoomend", emitViewChange);
    const { onMapClick } = options;
    if (onMapClick) {
      map.on("click", (e) =>
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
      );
    }

    const markers = new Map<string, L.Marker>();
    const areas = new Map<string, L.Path>();
    const kmlLayers = new Map<string, L.GeoJSON>();
    const imageLayers = new Map<string, L.ImageOverlay>();
    // Zuletzt gerenderte Signaturen je id – erlaubt das Überspringen
    // unveränderter Ebenen bei jedem Reconcile (kein Flackern/Neuladen).
    const markerSigs = new Map<string, string>();
    const areaSigs = new Map<string, string>();
    const kmlSigs = new Map<string, string>();
    const imageSigs = new Map<string, string>();
    // Zuletzt gesetzte Bild-Spec je id – für die Griffe im Bearbeiten-Modus.
    const imageSpecs = new Map<string, ImageOverlaySpec>();

    const rotatedImageOverlay = (
      L.imageOverlay as unknown as { rotated: RotatedImageOverlayFactory }
    ).rotated;
    const renderImageOverlay = (spec: ImageOverlaySpec): L.ImageOverlay => {
      const c = imageOverlayCorners(spec.placement, spec.aspect);
      return rotatedImageOverlay(
        spec.imageUrl,
        [c.topLeft.lat, c.topLeft.lng],
        [c.topRight.lat, c.topRight.lng],
        [c.bottomLeft.lat, c.bottomLeft.lng],
        { opacity: spec.placement.opacity },
      );
    };

    // --- Bearbeiten-Modus: Griffe zum Verschieben/Skalieren/Drehen eines Overlays ---
    type Repositionable = {
      reposition: (
        tl: L.LatLngExpression,
        tr: L.LatLngExpression,
        bl: L.LatLngExpression,
      ) => void;
    };
    let editing: { id: string; onChange: (p: ImagePlacement) => void } | null =
      null;
    const handleMarkers: L.Marker[] = [];
    const cornerIcon = L.divIcon({
      className: "overlay-handle overlay-handle--corner",
      iconSize: [14, 14],
    });
    const rotateIcon = L.divIcon({
      className: "overlay-handle overlay-handle--rotate",
      iconSize: [18, 18],
    });
    const moveIcon = L.divIcon({
      className: "overlay-handle overlay-handle--move",
      iconSize: [22, 22],
    });

    /** Zeichnet das Overlay während einer Geste live an der neuen Platzierung. */
    const previewPlacement = (placement: ImagePlacement) => {
      if (!editing) return;
      const spec = imageSpecs.get(editing.id);
      const layer = imageLayers.get(editing.id);
      if (!spec || !layer) return;
      const c = imageOverlayCorners(placement, spec.aspect);
      (layer as unknown as Repositionable).reposition(
        [c.topLeft.lat, c.topLeft.lng],
        [c.topRight.lat, c.topRight.lng],
        [c.bottomLeft.lat, c.bottomLeft.lng],
      );
    };

    const clearHandles = () => {
      for (const m of handleMarkers) m.remove();
      handleMarkers.length = 0;
    };

    const addHandle = (
      point: LatLng,
      icon: L.DivIcon,
      compute: (pos: LatLng) => ImagePlacement,
    ) => {
      const marker = L.marker([point.lat, point.lng], {
        draggable: true,
        icon,
        keyboard: false,
        zIndexOffset: 2000,
      }).addTo(map);
      const at = () => {
        const p = marker.getLatLng();
        return compute({ lat: p.lat, lng: p.lng });
      };
      marker.on("drag", () => previewPlacement(at()));
      marker.on("dragend", () => editing?.onChange(at()));
      handleMarkers.push(marker);
    };

    const renderHandles = () => {
      clearHandles();
      if (!editing) return;
      const spec = imageSpecs.get(editing.id);
      const layer = imageLayers.get(editing.id);
      if (!spec || !layer) return;
      const h = imageOverlayHandles(spec.placement, spec.aspect);
      const scaleFrom = (pos: LatLng): ImagePlacement => ({
        ...spec.placement,
        scaleM: scaleMFromCorner(spec.placement, spec.aspect, pos),
      });
      for (const corner of [
        h.topLeft,
        h.topRight,
        h.bottomRight,
        h.bottomLeft,
      ]) {
        addHandle(corner, cornerIcon, scaleFrom);
      }
      addHandle(h.rotate, rotateIcon, (pos) => ({
        ...spec.placement,
        rotationDeg: rotationFromHandle(spec.placement, pos),
      }));
      // Verschiebe-Griff in der Mitte: setzt den Mittelpunkt direkt. So bleibt die
      // Bildfläche selbst frei, damit die Karte überall per Drag schwenkbar ist.
      addHandle(h.center, moveIcon, (pos) => ({
        ...spec.placement,
        centerLat: pos.lat,
        centerLng: pos.lng,
      }));
    };

    const geoman = map as unknown as {
      pm: {
        enableDraw: (s: string, o?: unknown) => void;
        disableDraw: () => void;
      };
    };

    const iconFor = (spec: MarkerSpec) => {
      const size = spec.iconSize ?? [40, 40];
      const anchor = spec.iconAnchor ?? [20, 20];
      return L.icon({
        iconUrl: spec.iconUrl,
        iconSize: size,
        iconAnchor: anchor,
        // Das Bezeichnungs-Tooltip (direction "right") setzt an diesem Punkt an.
        // Ohne Versatz läge es über dem Symbol; um die halbe rechte Symbolhälfte
        // (size.x - anchor.x) plus 6 px für den Tooltip-Pfeil nach rechts rücken,
        // damit die Beschriftung vollständig neben dem Zeichen steht.
        tooltipAnchor: [size[0] - anchor[0] + 6, 0],
      });
    };

    // Bezeichnung als permanentes Label rechts neben dem Marker (statt im Symbol).
    // Eigene Klasse: kastenlos mit weißem Halo statt weißem Kasten (siehe CSS).
    const applyLabel = (marker: L.Marker, label: string | undefined) => {
      marker.unbindTooltip();
      if (label)
        marker.bindTooltip(label, {
          permanent: true,
          direction: "right",
          className: "kartenzeichen-label",
        });
    };

    const adapter: MapAdapter = {
      getView: currentView,
      setView: (view) => {
        map.setView([view.lat, view.lng], view.zoom);
      },
      setMarker: (id, spec) => {
        const existing = markers.get(id);
        if (existing) {
          existing.setLatLng([spec.lat, spec.lng]); // günstig, immer
          const sig = markerVisualSignature(spec);
          if (markerSigs.get(id) !== sig) {
            // Nur bei geändertem Icon/Deckkraft/Label neu setzen (setIcon allokiert).
            existing.setIcon(iconFor(spec));
            existing.setOpacity(spec.opacity ?? 1);
            applyLabel(existing, spec.label);
            markerSigs.set(id, sig);
          }
          return;
        }
        const marker = L.marker([spec.lat, spec.lng], {
          icon: iconFor(spec),
          draggable: spec.draggable ?? false,
          opacity: spec.opacity ?? 1,
        }).addTo(map);
        applyLabel(marker, spec.label);
        const { onDragEnd, onClick } = spec;
        if (onDragEnd) {
          marker.on("dragend", () => {
            const p = marker.getLatLng();
            onDragEnd({ lat: p.lat, lng: p.lng });
          });
        }
        if (onClick) {
          marker.on("click", () => onClick());
        }
        markers.set(id, marker);
        markerSigs.set(id, markerVisualSignature(spec));
      },
      removeMarker: (id) => {
        const marker = markers.get(id);
        if (marker) {
          marker.remove();
          markers.delete(id);
          markerSigs.delete(id);
        }
      },
      setArea: (id, spec) => {
        const sig = areaSignature(spec);
        if (areaSigs.get(id) === sig && areas.has(id)) return; // unverändert
        areas.get(id)?.remove();
        const layer = areaLayer(spec);
        applyAreaStyle(layer, spec);
        layer.addTo(map);
        areas.set(id, layer);
        areaSigs.set(id, sig);
      },
      removeArea: (id) => {
        areas.get(id)?.remove();
        areas.delete(id);
        areaSigs.delete(id);
      },
      setKmlOverlay: (id, spec) => {
        const sig = kmlSignature(spec);
        if (kmlSigs.get(id) === sig) return; // unverändert (sichtbar wie unsichtbar)
        kmlSigs.set(id, sig);
        kmlLayers.get(id)?.remove();
        kmlLayers.delete(id);
        if (!spec.visible) return;
        const layer = parseKml(spec.content);
        if (layer) {
          layer.addTo(map);
          kmlLayers.set(id, layer);
        }
      },
      removeKmlOverlay: (id) => {
        kmlLayers.get(id)?.remove();
        kmlLayers.delete(id);
        kmlSigs.delete(id);
      },
      setImageOverlay: (id, spec) => {
        imageSpecs.set(id, spec);
        const sig = imageSignature(spec);
        if (imageSigs.get(id) === sig) return; // unverändert
        imageSigs.set(id, sig);
        imageLayers.get(id)?.remove();
        imageLayers.delete(id);
        if (!spec.visible) return;
        const layer = renderImageOverlay(spec);
        layer.addTo(map);
        imageLayers.set(id, layer);
        // Nach dem Neuaufbau der Ebene die Griffe neu setzen (neue Instanz).
        if (editing?.id === id) renderHandles();
      },
      removeImageOverlay: (id) => {
        imageLayers.get(id)?.remove();
        imageLayers.delete(id);
        imageSigs.delete(id);
        imageSpecs.delete(id);
        if (editing?.id === id) {
          editing = null;
          clearHandles();
        }
      },
      startImageOverlayEdit: (id, onChange) => {
        editing = { id, onChange };
        renderHandles();
      },
      stopImageOverlayEdit: () => {
        editing = null;
        clearHandles();
      },
      startDrawing: (shape, onComplete) => {
        map.once("pm:create", (e: { layer: L.Layer }) => {
          const geometry = extractGeometry(shape, e.layer);
          map.removeLayer(e.layer); // vom Zustand rekonstruiert, nicht von der Zeichnung
          geoman.pm.disableDraw();
          onComplete(geometry);
        });
        geoman.pm.enableDraw(GEOMAN_SHAPE[shape], { snappable: false });
      },
      cancelDrawing: () => {
        map.off("pm:create");
        geoman.pm.disableDraw();
      },
      destroy: () => {
        clearHandles();
        resizeObserver?.disconnect();
        map.off("moveend", emitViewChange);
        map.off("zoomend", emitViewChange);
        map.remove();
      },
    };
    return adapter;
  },
};
