import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./leaflet-adapter.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet-imageoverlay-rotated";
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
  rotationFromHandle,
  scaleMFromCorner,
} from "./image-overlay";
import { parseKml } from "./kml-layer";
import {
  areaSignature,
  imageSignature,
  kmlSignature,
  markerVisualSignature,
} from "./layer-signature";
import { createSearchHitPin } from "./search-hit-pin";
import { type LatLng, MAX_TILE_ZOOM, type MapView } from "./view";

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

const filledAreaStyle = (color: string, opacity: number): L.PathOptions => ({
  color,
  fillColor: color,
  fillOpacity: opacity,
  opacity: 1,
  weight: 2,
});

function applyAreaStyle(layer: L.Path, spec: AreaSpec) {
  layer.setStyle(
    spec.geometry.shape === "line"
      ? { color: spec.color, opacity: spec.opacity, weight: 3 }
      : filledAreaStyle(spec.color, spec.opacity),
  );
  if (spec.label)
    layer.bindTooltip(spec.label, { permanent: true, direction: "center" });
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
      radius: Math.round((layer as L.Circle).getRadius()),
    };
  }
  const latlngs = (layer as L.Polyline).getLatLngs();
  const ring =
    (shape === "polygon"
      ? (latlngs[0] as L.LatLng[])
      : (latlngs as L.LatLng[])) ?? [];
  return { shape, points: toPoints(ring) };
}

/** Kantenlänge (px) eines Kartenzeichen-Markers. */
const MARKER_SIZE = 40;

/**
 * Leaflet-Implementierung des {@link MapAdapter}. Spricht zusammen mit
 * `kml-layer.ts` und `search-hit-pin.ts` als einziger Ort direkt mit Leaflet;
 * wird nur clientseitig (dynamisch) geladen.
 */
export const leafletMapAdapterFactory: MapAdapterFactory = {
  create(container, options) {
    const map = L.map(container).setView(
      [options.initialView.lat, options.initialView.lng],
      options.initialView.zoom,
    );
    // Zoom unten rechts über der Attribution – oben liegt die schwebende Suche,
    // darüber die Spalte der Kartenknöpfe.
    map.zoomControl.setPosition("bottomright");

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
    // Container-Größe anderweitig (z. B. beim Öffnen des Kartenpanels),
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

    const iconFor = (spec: MarkerSpec) =>
      L.icon({
        iconUrl: spec.iconUrl,
        iconSize: [MARKER_SIZE, MARKER_SIZE],
        iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
        // Das Bezeichnungs-Tooltip (direction "right") setzt am Anker an. Ohne
        // Versatz läge es über dem Symbol; um die rechte Symbolhälfte plus 6 px
        // für den Tooltip-Pfeil nach rechts rücken, damit die Beschriftung
        // vollständig neben dem Zeichen steht.
        tooltipAnchor: [MARKER_SIZE / 2 + 6, 0],
      });

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

    const searchHitPin = createSearchHitPin(map);

    let circlePreview: { circle: L.Circle; follow: () => void } | null = null;
    function stopCirclePreview() {
      if (!circlePreview) return;
      map.off("move", circlePreview.follow);
      circlePreview.circle.remove();
      circlePreview = null;
    }

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
      startCirclePreview: (spec) => {
        stopCirclePreview();
        const circle = L.circle(map.getCenter(), {
          ...filledAreaStyle(spec.color, spec.opacity),
          radius: spec.radius,
          interactive: false,
        }).addTo(map);
        const follow = () => circle.setLatLng(map.getCenter());
        map.on("move", follow);
        circlePreview = { circle, follow };
      },
      stopCirclePreview,
      setSearchHit: searchHitPin.set,
      clearSearchHit: searchHitPin.clear,
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
