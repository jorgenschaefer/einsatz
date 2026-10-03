import { randomUUID } from "node:crypto";
import type { AreaGeometry, AreaStyle } from "@/map/area";
import type { Queryable } from "@/server/db/db";
import {
  assertHexColor,
  assertLatLng,
  assertObject,
  assertOpacity,
  assertRadius,
  assertText,
  assertUuid,
  ValidationError,
} from "@/server/validation";

const MAX_LABEL_LENGTH = 200;

const MIN_AREA_POINTS = { polygon: 3, line: 2 } as const;

const TOO_FEW_POINTS = {
  polygon: `Ein Polygon braucht mindestens ${MIN_AREA_POINTS.polygon} Punkte.`,
  line: `Eine Linie braucht mindestens ${MIN_AREA_POINTS.line} Punkte.`,
};

const INVALID_GEOMETRY = "Ungültige Bereichsgeometrie.";

/**
 * Prüft eine Bereichsgeometrie, wie sie vom Client kommt: eine der drei
 * Formen, Stützpunkte bzw. Mittelpunkt+Radius mit gültigen Koordinaten.
 */
function assertAreaGeometry(geometry: AreaGeometry): void {
  assertObject(geometry, INVALID_GEOMETRY);
  switch (geometry.shape) {
    case "circle":
      assertPoint(geometry.center);
      assertRadius(geometry.radius);
      return;
    case "polygon":
    case "line":
      assertPoints(geometry.shape, geometry.points);
      return;
    default:
      throw new ValidationError("Unbekannte Bereichsform.");
  }
}

function assertPoints(shape: "polygon" | "line", points: unknown): void {
  if (!Array.isArray(points)) throw new ValidationError(INVALID_GEOMETRY);
  if (points.length < MIN_AREA_POINTS[shape]) {
    throw new ValidationError(TOO_FEW_POINTS[shape]);
  }
  for (const point of points) assertPoint(point);
}

function assertPoint(point: unknown): void {
  assertObject(point, "Ungültige Koordinaten.");
  assertLatLng(point.lat as number, point.lng as number);
}

/** Prüft Farbe, Deckkraft und Beschriftung eines Bereichs. */
function assertAreaStyle(style: AreaStyle): void {
  assertObject(style, "Ungültige Darstellung des Bereichs.");
  assertHexColor(style.color);
  assertOpacity(style.opacity);
  assertText(style.label, "Die Beschriftung", MAX_LABEL_LENGTH);
}

export interface Area {
  id: string;
  operationId: string;
  geometry: AreaGeometry;
  color: string;
  opacity: number;
  label: string;
}

interface AreaRow {
  id: string;
  operation_id: string;
  geometry: AreaGeometry;
  color: string;
  opacity: number;
  label: string;
}

const toArea = (row: AreaRow): Area => ({
  id: row.id,
  operationId: row.operation_id,
  geometry: row.geometry,
  color: row.color,
  opacity: row.opacity,
  label: row.label,
});

const COLUMNS = "id, operation_id, geometry, color, opacity, label";

export async function createArea(
  db: Queryable,
  input: { operationId: string; geometry: AreaGeometry } & AreaStyle,
): Promise<Area> {
  assertUuid(input.operationId);
  assertAreaGeometry(input.geometry);
  assertAreaStyle(input);
  const { rows } = await db.query<AreaRow>(
    `INSERT INTO areas (id, operation_id, geometry, color, opacity, label)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [
      randomUUID(),
      input.operationId,
      JSON.stringify(input.geometry),
      input.color,
      input.opacity,
      input.label,
    ],
  );
  return toArea(rows[0]);
}

export async function listAreas(
  db: Queryable,
  operationId: string,
): Promise<Area[]> {
  const { rows } = await db.query<AreaRow>(
    `SELECT ${COLUMNS} FROM areas WHERE operation_id = $1 ORDER BY created_at ASC`,
    [operationId],
  );
  return rows.map(toArea);
}

export async function updateAreaStyle(
  db: Queryable,
  operationId: string,
  id: string,
  style: AreaStyle,
): Promise<void> {
  assertUuid(operationId);
  assertUuid(id);
  assertAreaStyle(style);
  const { rows } = await db.query(
    "UPDATE areas SET color = $3, opacity = $4, label = $5 WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id, style.color, style.opacity, style.label],
  );
  assertFound(rows);
}

export async function updateAreaGeometry(
  db: Queryable,
  operationId: string,
  id: string,
  geometry: AreaGeometry,
): Promise<void> {
  assertUuid(operationId);
  assertUuid(id);
  assertAreaGeometry(geometry);
  const { rows } = await db.query(
    "UPDATE areas SET geometry = $3 WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id, JSON.stringify(geometry)],
  );
  assertFound(rows);
}

export async function deleteArea(
  db: Queryable,
  operationId: string,
  id: string,
): Promise<void> {
  assertUuid(operationId);
  assertUuid(id);
  const { rows } = await db.query(
    "DELETE FROM areas WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id],
  );
  assertFound(rows);
}

/** Kein Bereich dieser ID im genannten Einsatz – nie dort gewesen oder schon gelöscht. */
function assertFound(rows: unknown[]): void {
  if (rows.length === 0) throw new ValidationError("Bereich nicht gefunden.");
}
