import { randomBytes, randomUUID } from "node:crypto";
import {
  COMPOSITION_AXES,
  MAX_COMPOSITION_FIELD_LENGTH,
  type SymbolComposition,
} from "@/map/composition";
import type { Queryable } from "@/server/db/db";
import { assertLatLng, ValidationError } from "@/server/validation";

const COMPOSITION_KEYS: ReadonlySet<string> = new Set(COMPOSITION_AXES);

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
  operationId: string,
  id: string,
  lat: number,
  lng: number,
): Promise<void> {
  assertLatLng(lat, lng);
  // Manuelles Verschieben setzt die Positionsquelle zurück auf manuell;
  // eine spätere Live-Meldung überschreibt sie wieder.
  const { rows } = await db.query(
    "UPDATE map_symbols SET lat = $3, lng = $4, position_source = 'manual' WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id, lat, lng],
  );
  assertFound(rows);
}

export async function updateMapSymbolComposition(
  db: Queryable,
  operationId: string,
  id: string,
  composition: SymbolComposition,
): Promise<void> {
  assertComposition(composition);
  const { rows } = await db.query(
    "UPDATE map_symbols SET composition = $3 WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id, JSON.stringify(composition)],
  );
  assertFound(rows);
}

export async function deleteMapSymbol(
  db: Queryable,
  operationId: string,
  id: string,
): Promise<void> {
  const { rows } = await db.query(
    "DELETE FROM map_symbols WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id],
  );
  assertFound(rows);
}

/** Erzeugt (oder ersetzt) den geheimen Gerätelink-Token eines Kartenzeichens und gibt ihn zurück. */
export async function generateDeviceLink(
  db: Queryable,
  operationId: string,
  id: string,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const { rows } = await db.query(
    "UPDATE map_symbols SET device_link_token = $3 WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id, token],
  );
  assertFound(rows);
  return token;
}

/** Entfernt den Gerätelink eines Kartenzeichens; der alte Link gibt danach keinen Zugang mehr. */
export async function removeDeviceLink(
  db: Queryable,
  operationId: string,
  id: string,
): Promise<void> {
  const { rows } = await db.query(
    "UPDATE map_symbols SET device_link_token = NULL WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id],
  );
  assertFound(rows);
}

/** Entfernt alle Gerätelinks eines Einsatzes (beim Abschließen). */
export async function removeAllDeviceLinks(
  db: Queryable,
  operationId: string,
): Promise<void> {
  await db.query(
    "UPDATE map_symbols SET device_link_token = NULL WHERE operation_id = $1",
    [operationId],
  );
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
 * manuelle Position (Positionsquelle wird `device`). Eine Meldung weniger als
 * 5 Sekunden nach der zuletzt gespeicherten wird verworfen (`stored: false`);
 * die Bedingung steht im UPDATE selbst, damit zwei gleichzeitige Meldungen sie
 * nicht beide erfüllen. Liefert wie {@link resolveDeviceAccess} die
 * Einsatz-Zugehörigkeit, sonst null („kein Zugang").
 */
export async function reportPosition(
  db: Queryable,
  token: string,
  lat: number,
  lng: number,
  now: Date = new Date(),
): Promise<{ operationId: string; stored: boolean } | null> {
  const { rows } = await db.query<{ operation_id: string }>(
    `UPDATE map_symbols AS ms
        SET lat = $2, lng = $3, position_source = 'device', reported_at = $4
       FROM operations AS o
      WHERE ms.device_link_token = $1 AND ms.operation_id = o.id AND o.status = 'active'
        AND (ms.reported_at IS NULL OR ms.reported_at <= $4::timestamptz - interval '5 seconds')
      RETURNING ms.operation_id`,
    [token, lat, lng, now.toISOString()],
  );
  if (rows[0]) return { operationId: rows[0].operation_id, stored: true };
  const access = await resolveDeviceAccess(db, token);
  return access && { ...access, stored: false };
}

/** Kein Kartenzeichen dieser ID im genannten Einsatz – nie dort gewesen oder schon gelöscht. */
function assertFound(rows: unknown[]): void {
  if (rows.length === 0) {
    throw new ValidationError("Kartenzeichen nicht gefunden.");
  }
}
