import { randomBytes, randomUUID } from "node:crypto";
import type { Queryable } from "@/server/db/db";
import { assertText, assertUuid, ValidationError } from "@/server/validation";

export interface ViewLink {
  id: string;
  operationId: string;
  token: string;
  label: string;
  createdAt: Date;
}

interface ViewLinkRow {
  id: string;
  operation_id: string;
  token: string;
  label: string;
  created_at: string | Date;
}

const toViewLink = (row: ViewLinkRow): ViewLink => ({
  id: row.id,
  operationId: row.operation_id,
  token: row.token,
  label: row.label,
  createdAt: new Date(row.created_at),
});

const COLUMNS = "id, operation_id, token, label, created_at";

const MAX_LABEL_LENGTH = 200;

/** Erzeugt einen Ansichtslink mit geheimem Token für einen Einsatz. */
export async function createViewLink(
  db: Queryable,
  input: { operationId: string; label: string },
): Promise<ViewLink> {
  assertUuid(input.operationId);
  assertText(input.label, "Die Bezeichnung", MAX_LABEL_LENGTH);
  const token = randomBytes(32).toString("base64url");
  const { rows } = await db.query<ViewLinkRow>(
    `INSERT INTO view_links (id, operation_id, token, label)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNS}`,
    [randomUUID(), input.operationId, token, input.label],
  );
  return toViewLink(rows[0]);
}

export async function listViewLinks(
  db: Queryable,
  operationId: string,
): Promise<ViewLink[]> {
  const { rows } = await db.query<ViewLinkRow>(
    `SELECT ${COLUMNS} FROM view_links WHERE operation_id = $1 ORDER BY created_at ASC`,
    [operationId],
  );
  return rows.map(toViewLink);
}

export async function deleteViewLink(
  db: Queryable,
  operationId: string,
  id: string,
): Promise<void> {
  assertUuid(operationId);
  assertUuid(id);
  const { rows } = await db.query(
    "DELETE FROM view_links WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id],
  );
  if (rows.length === 0) {
    throw new ValidationError("Ansichtslink nicht gefunden.");
  }
}

/** Löscht alle Ansichtslinks eines Einsatzes (beim Abschließen). */
export async function deleteAllViewLinks(
  db: Queryable,
  operationId: string,
): Promise<void> {
  await db.query("DELETE FROM view_links WHERE operation_id = $1", [
    operationId,
  ]);
}

/**
 * Löst einen Ansichtslink-Token auf: liefert die Einsatz-Zugehörigkeit
 * (`operationId`) nur, solange der Token gültig und der Einsatz `aktiv` ist –
 * sonst null („kein Zugang"). Gleiche Bindung wie {@link resolveDeviceAccess},
 * aber ohne Standortmeldung.
 */
export async function resolveViewAccess(
  db: Queryable,
  token: string,
): Promise<{ operationId: string } | null> {
  const { rows } = await db.query<{ operation_id: string }>(
    `SELECT vl.operation_id
       FROM view_links AS vl
       JOIN operations AS o ON vl.operation_id = o.id
      WHERE vl.token = $1 AND o.status = 'active'`,
    [token],
  );
  return rows[0] ? { operationId: rows[0].operation_id } : null;
}
