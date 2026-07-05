export interface LatLngPoint {
  lat: number;
  lng: number;
}

export type AreaShape = "polygon" | "line" | "circle";

/** Geometrie eines Bereichs: Fläche/Linienzug über Stützpunkte oder Kreis. */
export type AreaGeometry =
  | { shape: "polygon"; points: LatLngPoint[] }
  | { shape: "line"; points: LatLngPoint[] }
  | { shape: "circle"; center: LatLngPoint; radius: number };

/** Mittelpunkt eines Bereichs: Kreiszentrum bzw. Mittel der Stützpunkte. */
export function areaCenter(geometry: AreaGeometry): LatLngPoint {
  if (geometry.shape === "circle") return geometry.center;
  const { points } = geometry;
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

export interface AreaStyle {
  color: string;
  /** Deckkraft 0–1; wirkt bei Polygon/Kreis auf die Füllung, bei der Linie auf den Strich. */
  opacity: number;
  label: string;
}
