import L from "leaflet";
import type { AreaSpec, CirclePreviewSpec } from "./adapter";
import type { AreaGeometry, AreaShape } from "./area";
import { areaSignature } from "./layer-signature";

/**
 * Die Bereiche auf der Karte, per id gesetzt und entfernt, dazu das Zeichnen
 * einer neuen Form und der Vorschau-Kreis beim Verschieben eines Kreises.
 */
export function createAreaLayers(map: L.Map) {
  const areas = new Map<string, L.Path>();
  // Zuletzt gerenderte Signatur je id – erlaubt das Überspringen
  // unveränderter Bereiche bei jedem Reconcile (kein Flackern).
  const areaSigs = new Map<string, string>();
  const geoman = map as unknown as {
    pm: {
      enableDraw: (s: string, o?: unknown) => void;
      disableDraw: () => void;
    };
  };

  let circlePreview: { circle: L.Circle; follow: () => void } | null = null;
  function stopCirclePreview() {
    if (!circlePreview) return;
    map.off("move", circlePreview.follow);
    circlePreview.circle.remove();
    circlePreview = null;
  }

  return {
    set(id: string, spec: AreaSpec) {
      const sig = areaSignature(spec);
      if (areaSigs.get(id) === sig && areas.has(id)) return; // unverändert
      areas.get(id)?.remove();
      const layer = areaLayer(spec);
      applyAreaStyle(layer, spec);
      layer.addTo(map);
      areas.set(id, layer);
      areaSigs.set(id, sig);
    },
    remove(id: string) {
      areas.get(id)?.remove();
      areas.delete(id);
      areaSigs.delete(id);
    },
    startDrawing(
      shape: AreaShape,
      onComplete: (geometry: AreaGeometry) => void,
    ) {
      map.once("pm:create", (e: { layer: L.Layer }) => {
        const geometry = extractGeometry(shape, e.layer);
        map.removeLayer(e.layer); // vom Zustand rekonstruiert, nicht von der Zeichnung
        geoman.pm.disableDraw();
        onComplete(geometry);
      });
      geoman.pm.enableDraw(GEOMAN_SHAPE[shape], { snappable: false });
    },
    cancelDrawing() {
      map.off("pm:create");
      geoman.pm.disableDraw();
    },
    startCirclePreview(spec: CirclePreviewSpec) {
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
  };
}

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

const GEOMAN_SHAPE: Record<AreaShape, "Polygon" | "Line" | "Circle"> = {
  polygon: "Polygon",
  line: "Line",
  circle: "Circle",
};

const toPoints = (latlngs: L.LatLng[]) =>
  latlngs.map((p) => ({ lat: p.lat, lng: p.lng }));

function areaLayer(spec: AreaSpec): L.Path {
  const g = spec.geometry;
  if (g.shape === "circle")
    return L.circle([g.center.lat, g.center.lng], { radius: g.radius });
  const points = g.points.map((p) => [p.lat, p.lng] as [number, number]);
  return g.shape === "polygon" ? L.polygon(points) : L.polyline(points);
}

function applyAreaStyle(layer: L.Path, spec: AreaSpec) {
  layer.setStyle(
    spec.geometry.shape === "line"
      ? { color: spec.color, opacity: spec.opacity, weight: 3 }
      : filledAreaStyle(spec.color, spec.opacity),
  );
  if (spec.label)
    layer.bindTooltip(spec.label, { permanent: true, direction: "center" });
}

function filledAreaStyle(color: string, opacity: number): L.PathOptions {
  return {
    color,
    fillColor: color,
    fillOpacity: opacity,
    opacity: 1,
    weight: 2,
  };
}
