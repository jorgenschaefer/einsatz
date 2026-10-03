import {
  assertObject,
  trimmedText,
  ValidationError,
} from "@/server/validation";
import type { StrengthValues } from "@/strength/strength";

const MAX_STATION_NAME_LENGTH = 200;

/** Der Name einer Stelle, getrimmt; nicht leer, höchstens 200 Zeichen. */
export function requireStationName(raw: unknown): string {
  const name = trimmedText(raw, "Der Name der Stelle", MAX_STATION_NAME_LENGTH);
  if (!name) {
    throw new ValidationError("Der Name der Stelle darf nicht leer sein.");
  }
  return name;
}

const MAX_COUNT = 9999;
const MAX_NOTE_LENGTH = 2000;
const INVALID_COUNTS =
  "Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen.";

/** Die Werte einer Stärkemeldung; die Notiz getrimmt, eine leere `null`. */
export function requireStrengthValues(values: unknown): StrengthValues {
  assertObject(values, INVALID_COUNTS);
  const counts = [
    values.leaders,
    values.subLeaders,
    values.crew,
    values.additionalPersonnel,
  ];
  if (!counts.every(isCount)) throw new ValidationError(INVALID_COUNTS);
  const [leaders, subLeaders, crew, additionalPersonnel] = counts;
  return {
    leaders,
    subLeaders,
    crew,
    additionalPersonnel,
    note: requireNote(values.note),
  };
}

function isCount(n: unknown): n is number {
  return (
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_COUNT
  );
}

function requireNote(note: unknown): string | null {
  if (note === null) return null;
  return trimmedText(note, "Die Notiz", MAX_NOTE_LENGTH) || null;
}
