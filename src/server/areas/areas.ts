import { randomUUID } from "node:crypto";
import type { AreaGeometry, AreaStyle } from "@/map/area";
import type { Queryable } from "@/server/db/db";
import { assertLatLng, assertOpacity, assertRadius } from "@/server/validation";

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
  id: string,
  style: AreaStyle,
): Promise<void> {
  assertOpacity(style.opacity);
  await db.query(
    "UPDATE areas SET color = $2, opacity = $3, label = $4 WHERE id = $1",
    [id, style.color, style.opacity, style.label],
  );
}

export async function updateAreaGeometry(
  db: Queryable,
  id: string,
  geometry: AreaGeometry,
): Promise<void> {
  assertAreaGeometry(geometry);
  await db.query("UPDATE areas SET geometry = $2 WHERE id = $1", [
    id,
    JSON.stringify(geometry),
  ]);
}

export async function deleteArea(db: Queryable, id: string): Promise<void> {
  await db.query("DELETE FROM areas WHERE id = $1", [id]);
}
