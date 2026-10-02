import { randomBytes, randomUUID } from "node:crypto";
import {
  MAX_COMPOSITION_FIELD_LENGTH,
  type SymbolComposition,
} from "@/map/composition";
import type { Queryable } from "@/server/db/db";
import { assertLatLng, ValidationError } from "@/server/validation";

/** Die bekannten Achsen einer {@link SymbolComposition}. */
const COMPOSITION_KEYS: ReadonlySet<string> = new Set([
  "grundzeichen",
  "organisation",
  "fachaufgabe",
  "einheit",
  "verwaltungsstufe",
  "funktion",
  "symbol",
  "text",
]);

/**
 * Prüft an der Action-Grenze **nur die Form** einer Zeichen-Komposition: ein
 * Objekt mit ausschließlich bekannten Schlüsseln und String-Werten (mit
 * Längenobergrenze). Bewusst **keine** Prüfung gegen die erlaubten Werte von
 * `@taktische-zeichen/core` – `text`/`symbol` sind frei, und künftige Symbolwerte
 * sollen nicht fälschlich abgelehnt werden.
 */
export function assertComposition(composition: SymbolComposition): void {
  if (
    typeof composition !== "object" ||
    composition === null ||
    Array.isArray(composition)
  ) {
    throw new ValidationError("Ungültige Zeichen-Komposition.");
  }
  for (const [key, value] of Object.entries(composition)) {
    if (!COMPOSITION_KEYS.has(key)) {
      throw new ValidationError("Ungültige Zeichen-Komposition.");
    }
    if (value === undefined) continue; // optionales Feld, nicht gesetzt
    if (
      typeof value !== "string" ||
      value.length > MAX_COMPOSITION_FIELD_LENGTH
    ) {
      throw new ValidationError("Ungültige Zeichen-Komposition.");
    }
  }
}

export type PositionSource = "manual" | "device";

export interface MapSymbol {
  id: string;
  operationId: string;
  composition: SymbolComposition;
  lat: number;
  lng: number;
  deviceLinkToken: string | null;
  positionSource: PositionSource;
  reportedAt: Date | null;
}

interface MapSymbolRow {
  id: string;
  operation_id: string;
  composition: SymbolComposition;
  lat: number;
  lng: number;
  device_link_token: string | null;
  position_source: PositionSource;
  reported_at: string | Date | null;
}

const toMapSymbol = (row: MapSymbolRow): MapSymbol => ({
  id: row.id,
  operationId: row.operation_id,
  composition: row.composition,
  lat: row.lat,
  lng: row.lng,
  deviceLinkToken: row.device_link_token,
  positionSource: row.position_source,
  reportedAt: row.reported_at ? new Date(row.reported_at) : null,
});

const COLUMNS =
  "id, operation_id, composition, lat, lng, device_link_token, position_source, reported_at";

export async function createMapSymbol(
  db: Queryable,
  input: {
    operationId: string;
    composition: SymbolComposition;
    lat: number;
    lng: number;
  },
): Promise<MapSymbol> {
  assertLatLng(input.lat, input.lng);
  assertComposition(input.composition);
  const { rows } = await db.query<MapSymbolRow>(
    `INSERT INTO map_symbols (id, operation_id, composition, lat, lng)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUMNS}`,
    [
      randomUUID(),
      input.operationId,
      JSON.stringify(input.composition),
      input.lat,
      input.lng,
    ],
  );
  return toMapSymbol(rows[0]);
}

export async function listMapSymbols(
  db: Queryable,
  operationId: string,
): Promise<MapSymbol[]> {
  const { rows } = await db.query<MapSymbolRow>(
    `SELECT ${COLUMNS} FROM map_symbols WHERE operation_id = $1 ORDER BY created_at ASC`,
    [operationId],
  );
  return rows.map(toMapSymbol);
}

export async function moveMapSymbol(
  db: Queryable,
  id: string,
  lat: number,
  lng: number,
): Promise<void> {
  assertLatLng(lat, lng);
  // Manuelles Verschieben setzt die Positionsquelle zurück auf manuell;
  // eine spätere Live-Meldung überschreibt sie wieder.
  await db.query(
    "UPDATE map_symbols SET lat = $2, lng = $3, position_source = 'manual' WHERE id = $1",
    [id, lat, lng],
  );
}

export async function updateMapSymbolComposition(
  db: Queryable,
  id: string,
  composition: SymbolComposition,
): Promise<void> {
  assertComposition(composition);
  await db.query("UPDATE map_symbols SET composition = $2 WHERE id = $1", [
    id,
    JSON.stringify(composition),
  ]);
}

export async function deleteMapSymbol(
  db: Queryable,
  id: string,
): Promise<void> {
  await db.query("DELETE FROM map_symbols WHERE id = $1", [id]);
}

/** Erzeugt (oder ersetzt) den geheimen Gerätelink-Token eines Kartenzeichens und gibt ihn zurück. */
export async function generateDeviceLink(
  db: Queryable,
  id: string,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    "UPDATE map_symbols SET device_link_token = $2 WHERE id = $1",
    [id, token],
  );
  return token;
}

/**
 * Löst einen Gerätelink-Token auf: liefert die Einsatz-Zugehörigkeit
 * (`operationId`) nur, solange der Token gültig und der Einsatz `aktiv` ist –
 * sonst null („kein Zugang"). Dieselbe Bindung wie {@link reportPosition};
 * Grundlage der Abschluss-Seite.
 */
export async function resolveDeviceAccess(
  db: Queryable,
  token: string,
): Promise<{ operationId: string } | null> {
  const { rows } = await db.query<{ operation_id: string }>(
    `SELECT ms.operation_id
       FROM map_symbols AS ms
       JOIN operations AS o ON ms.operation_id = o.id
      WHERE ms.device_link_token = $1 AND o.status = 'active'`,
    [token],
  );
  return rows[0] ? { operationId: rows[0].operation_id } : null;
}

/**
 * Meldet eine Live-Position über den Gerätelink-Token. Nur zulässig, wenn der
 * Token gültig ist und der Einsatz `aktiv` ist; die Meldung überschreibt die
 * manuelle Position (Positionsquelle wird `device`). Liefert wie
 * {@link resolveDeviceAccess} die Einsatz-Zugehörigkeit, sonst null („kein
 * Zugang") – so kann der Aufrufer ohne zweite Abfrage das SSE-Publish auslösen.
 */
export async function reportPosition(
  db: Queryable,
  token: string,
  lat: number,
  lng: number,
  now: Date = new Date(),
): Promise<{ operationId: string } | null> {
  const { rows } = await db.query<{ operation_id: string }>(
    `UPDATE map_symbols AS ms
        SET lat = $2, lng = $3, position_source = 'device', reported_at = $4
       FROM operations AS o
      WHERE ms.device_link_token = $1 AND ms.operation_id = o.id AND o.status = 'active'
      RETURNING ms.operation_id`,
    [token, lat, lng, now.toISOString()],
  );
  return rows[0] ? { operationId: rows[0].operation_id } : null;
}
