/** Fachliche Validierungsfehler (z. B. leere Pflichtfelder), vom Aufrufer als
 *  Formularfehler behandelbar – abgegrenzt von unerwarteten Serverfehlern. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Prüft, ob lat/lng endliche Zahlen in gültigen WGS84-Grenzen sind. */
export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Erzwingt gültige Koordinaten; wirft sonst {@link ValidationError}. */
export function assertLatLng(lat: number, lng: number): void {
  if (!isValidLatLng(lat, lng)) {
    throw new ValidationError("Ungültige Koordinaten.");
  }
}

/** Erzwingt Deckkraft im Bereich 0–1. */
export function assertOpacity(opacity: number): void {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new ValidationError("Die Deckkraft muss zwischen 0 und 1 liegen.");
  }
}

/** Erzwingt einen positiven, endlichen Radius (Meter). */
export function assertRadius(radius: number): void {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new ValidationError("Der Radius muss größer als 0 sein.");
  }
}
