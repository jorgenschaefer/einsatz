import { isUuid } from "@/server/db/uuid";

/** Fachliche Validierungsfehler (z. B. leere Pflichtfelder), vom Aufrufer als
 *  Formularfehler behandelbar – abgegrenzt von unerwarteten Serverfehlern. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Erzwingt eine UUID als Id. Ohne diese Prüfung ließe eine falsche Id
 * Postgres beim Vergleich mit einer `uuid`-Spalte werfen.
 */
export function assertUuid(value: unknown): asserts value is string {
  if (typeof value !== "string" || !isUuid(value)) {
    throw new ValidationError("Ungültige ID.");
  }
}

/**
 * Erzwingt Text von höchstens `max` Zeichen (UTF-16-Einheiten). `field` ist
 * das Feld mit Artikel, wie es in der Meldung steht, etwa „Die Beschriftung“.
 */
export function assertText(
  value: unknown,
  field: string,
  max: number,
): asserts value is string {
  if (typeof value !== "string") {
    throw new ValidationError(`${field} muss Text sein.`);
  }
  if (value.length > max) {
    throw new ValidationError(
      `${field} darf höchstens ${max.toLocaleString("de-DE")} Zeichen lang sein.`,
    );
  }
}

/** Erzwingt `true` oder `false`; `field` wie bei {@link assertText}. */
export function assertBoolean(
  value: unknown,
  field: string,
): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new ValidationError(`${field} muss wahr oder falsch sein.`);
  }
}

/** Erzwingt ein Objekt (kein `null`, kein Array); sonst `message`. */
export function assertObject(
  value: unknown,
  message: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError(message);
  }
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Erzwingt eine Farbe als `#` und sechs Hex-Ziffern. */
export function assertHexColor(value: unknown): asserts value is string {
  if (typeof value !== "string" || !HEX_COLOR.test(value)) {
    throw new ValidationError(
      "Die Farbe muss # und sechs Hex-Ziffern sein, etwa #e2001a.",
    );
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

/** Erzwingt eine positive, endliche Skalierung (Bildbreite in Metern). */
export function assertScale(scale: number): void {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new ValidationError("Die Skalierung muss größer als 0 sein.");
  }
}

const MAX_NAME_LENGTH = 200;

/**
 * Ein vom Nutzer gegebener Name, getrimmt; leer, wenn keiner gegeben ist.
 * Lehnt alles ab, was kein Text oder länger als 200 Zeichen ist.
 */
export function trimmedName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : value;
  assertText(name, "Der Name", MAX_NAME_LENGTH);
  return name;
}
