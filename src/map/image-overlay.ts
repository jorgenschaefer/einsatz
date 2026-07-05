import type { MapView } from "./view";

/** Platzierung eines Bild-Overlays: per Auge auf die Karte eingepasst. */
export interface ImagePlacement {
  centerLat: number;
  centerLng: number;
  /** Breite des Bildes auf der Karte in Metern (Skalierung). */
  scaleM: number;
  rotationDeg: number;
  /** 0–1. */
  opacity: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

const DEFAULT_SCALE_M = 1000;
const FALLBACK_CENTER = { lat: 51.1657, lng: 10.4515 }; // Mitte Deutschlands

/** Startplatzierung eines neuen Bild-Overlays: mittig auf dem aktuellen Kartenausschnitt. */
export function defaultImagePlacement(view: MapView | null): ImagePlacement {
  const center = view ?? FALLBACK_CENTER;
  return {
    centerLat: center.lat,
    centerLng: center.lng,
    scaleM: DEFAULT_SCALE_M,
    rotationDeg: 0,
    opacity: 1,
  };
}

export interface ImageCorners {
  topLeft: LatLng;
  topRight: LatLng;
  bottomLeft: LatLng;
}

const METERS_PER_DEGREE = 111320;

const metersPerDegLng = (lat: number): number =>
  METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180);

/**
 * Bildkoordinaten (x nach rechts, y nach oben, in Metern vom Mittelpunkt) in
 * geografische Koordinaten überführen – gedreht im Uhrzeigersinn um `rotationDeg`.
 * Äquirektanguläre Näherung; genügt fürs Einpassen „per Auge".
 */
function fromImageFrame(
  placement: ImagePlacement,
  x: number,
  y: number,
): LatLng {
  const theta = (placement.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const rx = x * cos + y * sin;
  const ry = -x * sin + y * cos;
  return {
    lat: placement.centerLat + ry / METERS_PER_DEGREE,
    lng: placement.centerLng + rx / metersPerDegLng(placement.centerLat),
  };
}

/** Umkehrung von {@link fromImageFrame}: geografischer Punkt → Bildkoordinaten. */
function toImageFrame(
  placement: ImagePlacement,
  point: LatLng,
): { x: number; y: number } {
  const theta = (placement.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const rx =
    (point.lng - placement.centerLng) * metersPerDegLng(placement.centerLat);
  const ry = (point.lat - placement.centerLat) * METERS_PER_DEGREE;
  return { x: rx * cos - ry * sin, y: rx * sin + ry * cos };
}

/**
 * Berechnet die drei Eckpunkte (oben-links/-rechts, unten-links) eines
 * Bild-Overlays aus Mittelpunkt, Breite in Metern, Seitenverhältnis (Breite/Höhe)
 * und Drehung (im Uhrzeigersinn).
 */
export function imageOverlayCorners(
  placement: ImagePlacement,
  aspect: number,
): ImageCorners {
  const halfW = placement.scaleM / 2;
  const halfH = placement.scaleM / aspect / 2;
  return {
    topLeft: fromImageFrame(placement, -halfW, halfH),
    topRight: fromImageFrame(placement, halfW, halfH),
    bottomLeft: fromImageFrame(placement, -halfW, -halfH),
  };
}

export interface ImageOverlayHandles {
  topLeft: LatLng;
  topRight: LatLng;
  bottomLeft: LatLng;
  bottomRight: LatLng;
  /** Verschiebe-Griff im Mittelpunkt. */
  center: LatLng;
  /** Dreh-Griff mittig über der Oberkante. */
  rotate: LatLng;
}

/**
 * Alle Griffpunkte fürs interaktive Bearbeiten: vier Ecken (Skalieren),
 * Mittelpunkt (Verschieben) und Dreh-Griff.
 */
export function imageOverlayHandles(
  placement: ImagePlacement,
  aspect: number,
): ImageOverlayHandles {
  const halfW = placement.scaleM / 2;
  const halfH = placement.scaleM / aspect / 2;
  return {
    ...imageOverlayCorners(placement, aspect),
    bottomRight: fromImageFrame(placement, halfW, -halfH),
    center: { lat: placement.centerLat, lng: placement.centerLng },
    rotate: fromImageFrame(placement, 0, halfH + placement.scaleM * 0.15),
  };
}

/**
 * Neue Breite (`scaleM`) aus der gezogenen Ecke: gleichmäßig um den Mittelpunkt,
 * Seitenverhältnis fest. Der Abstand der Ecke zum Mittelpunkt bestimmt die Skala
 * (drehungsunabhängig); mindestens 1 m.
 */
export function scaleMFromCorner(
  placement: ImagePlacement,
  aspect: number,
  corner: LatLng,
): number {
  const { x, y } = toImageFrame(placement, corner);
  const diagonal = Math.hypot(x, y);
  const halfDiagonalPerScale = Math.hypot(0.5, 0.5 / aspect);
  return Math.max(1, diagonal / halfDiagonalPerScale);
}

/**
 * Neue Drehung (Grad, im Uhrzeigersinn) aus der Position des Dreh-Griffs relativ
 * zum Mittelpunkt. Norden = 0°, Osten = 90°.
 */
export function rotationFromHandle(
  placement: ImagePlacement,
  handle: LatLng,
): number {
  const east =
    (handle.lng - placement.centerLng) * metersPerDegLng(placement.centerLat);
  const north = (handle.lat - placement.centerLat) * METERS_PER_DEGREE;
  const deg = (Math.atan2(east, north) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}
