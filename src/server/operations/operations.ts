import { randomUUID } from "node:crypto";
import type { MapView } from "@/map/view";
import type { Queryable } from "@/server/db/db";

export type { MapView };

export type OperationStatus = "active" | "closed";

export interface Operation {
  id: string;
  name: string;
  description: string | null;
  status: OperationStatus;
  startedAt: Date;
  defaultView: MapView | null;
}

interface OperationRow {
  id: string;
  name: string;
  description: string | null;
  status: OperationStatus;
  started_at: string | Date;
  default_view: MapView | null;
}

const toOperation = (row: OperationRow): Operation => ({
  id: row.id,
  name: row.name,
  description: row.description,
  status: row.status,
  startedAt: new Date(row.started_at),
  defaultView: row.default_view,
});

const COLUMNS = "id, name, description, status, started_at, default_view";

export async function insertOperation(
  db: Queryable,
  input: { name: string; description: string | null },
): Promise<Operation> {
  const { rows } = await db.query<OperationRow>(
    `INSERT INTO operations (id, name, description) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [randomUUID(), input.name, input.description],
  );
  return toOperation(rows[0]);
}

export async function getOperation(
  db: Queryable,
  id: string,
): Promise<Operation | null> {
  const { rows } = await db.query<OperationRow>(
    `SELECT ${COLUMNS} FROM operations WHERE id = $1`,
    [id],
  );
  return rows[0] ? toOperation(rows[0]) : null;
}

export async function listOperations(db: Queryable): Promise<Operation[]> {
  const { rows } = await db.query<OperationRow>(
    `SELECT ${COLUMNS} FROM operations ORDER BY started_at DESC`,
  );
  return rows.map(toOperation);
}

/** Setzt den serverseitigen Standard-Kartenausschnitt eines Einsatzes. */
export async function setDefaultView(
  db: Queryable,
  id: string,
  view: MapView,
): Promise<void> {
  await db.query("UPDATE operations SET default_view = $2 WHERE id = $1", [
    id,
    JSON.stringify(view),
  ]);
}

/**
 * Sperrt die Einsatz-Zeile (`FOR UPDATE`) innerhalb einer Transaktion, damit
 * parallele Anhänge bzw. Statusübergänge nicht dieselbe ETB-Nummer oder
 * denselben Meilenstein doppelt vergeben. Nur innerhalb einer Transaktion
 * aufrufen.
 */
export async function lockOperation(tx: Queryable, id: string): Promise<void> {
  await tx.query("SELECT id FROM operations WHERE id = $1 FOR UPDATE", [id]);
}

export async function setOperationStatus(
  db: Queryable,
  id: string,
  status: OperationStatus,
): Promise<void> {
  await db.query("UPDATE operations SET status = $2 WHERE id = $1", [
    id,
    status,
  ]);
}

/** Löscht einen Einsatz; zugehörige Kartenobjekte und ETB-Einträge kaskadieren. */
export async function deleteOperation(
  db: Queryable,
  id: string,
): Promise<void> {
  await db.query("DELETE FROM operations WHERE id = $1", [id]);
}
