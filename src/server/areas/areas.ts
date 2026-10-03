import { randomUUID } from "node:crypto";
import type { AreaGeometry, AreaStyle } from "@/map/area";
import type { Queryable } from "@/server/db/db";
import {
  assertLatLng,
  assertOpacity,
  assertRadius,
  ValidationError,
} from "@/server/validation";

/** Prüft die Stützpunkte bzw. Mittelpunkt+Radius einer Bereichsgeometrie. */
function assertAreaGeometry(geometry: AreaGeometry): void {
  if (geometry.shape === "circle") {
    assertLatLng(geometry.center.lat, geometry.center.lng);
    assertRadius(geometry.radius);
    return;
  }
  for (const point of geometry.points) {
    assertLatLng(point.lat, point.lng);
  }
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
  assertAreaGeometry(input.geometry);
  assertOpacity(input.opacity);
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
  assertOpacity(style.opacity);
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
