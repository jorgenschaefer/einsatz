import { randomUUID } from "node:crypto";
import type { Queryable } from "@/server/db/db";
import { trimmedName, ValidationError } from "@/server/validation";

export type KmlSourceType = "file" | "url";

export interface KmlOverlay {
  id: string;
  operationId: string;
  sourceType: KmlSourceType;
  sourceUrl: string | null;
  name: string;
  content: string;
  visible: boolean;
}

interface KmlRow {
  id: string;
  operation_id: string;
  source_type: KmlSourceType;
  source_url: string | null;
  name: string;
  content: string;
  visible: boolean;
}

const toOverlay = (row: KmlRow): KmlOverlay => ({
  id: row.id,
  operationId: row.operation_id,
  sourceType: row.source_type,
  sourceUrl: row.source_url,
  name: row.name,
  content: row.content,
  visible: row.visible,
});

const COLUMNS =
  "id, operation_id, source_type, source_url, name, content, visible";

/**
 * Legt eine KML-Ebene an. `name` ist der Name, wie ihn der Nutzer gegeben hat;
 * ohne Namen heißt die Ebene wie ihre Adresse bzw. „KML-Datei“.
 */
export async function createKmlOverlay(
  db: Queryable,
  input: {
    operationId: string;
    sourceType: KmlSourceType;
    sourceUrl: string | null;
    name: unknown;
    content: string;
  },
): Promise<KmlOverlay> {
  const name = trimmedName(input.name) || (input.sourceUrl ?? "KML-Datei");
  const { rows } = await db.query<KmlRow>(
    `INSERT INTO kml_overlays (id, operation_id, source_type, source_url, name, content)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [
      randomUUID(),
      input.operationId,
      input.sourceType,
      input.sourceUrl,
      name,
      input.content,
    ],
  );
  return toOverlay(rows[0]);
}

export async function listKmlOverlays(
  db: Queryable,
  operationId: string,
): Promise<KmlOverlay[]> {
  const { rows } = await db.query<KmlRow>(
    `SELECT ${COLUMNS} FROM kml_overlays WHERE operation_id = $1 ORDER BY created_at ASC`,
    [operationId],
  );
  return rows.map(toOverlay);
}

export async function setKmlVisibility(
  db: Queryable,
  operationId: string,
  id: string,
  visible: boolean,
): Promise<void> {
  const { rows } = await db.query(
    "UPDATE kml_overlays SET visible = $3 WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id, visible],
  );
  assertFound(rows);
}

export async function updateKmlContent(
  db: Queryable,
  operationId: string,
  id: string,
  content: string,
): Promise<void> {
  const { rows } = await db.query(
    "UPDATE kml_overlays SET content = $3 WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id, content],
  );
  assertFound(rows);
}

export async function deleteKmlOverlay(
  db: Queryable,
  operationId: string,
  id: string,
): Promise<void> {
  const { rows } = await db.query(
    "DELETE FROM kml_overlays WHERE operation_id = $1 AND id = $2 RETURNING id",
    [operationId, id],
  );
  assertFound(rows);
}

/**
 * Lädt ein URL-Overlay neu: holt (nur bei URL-Quelle) den Inhalt erneut über
 * `fetcher` und ersetzt den zwischengespeicherten Inhalt. Datei-Quellen können
 * nicht neu geladen werden.
 */
export async function reloadKmlOverlay(
  db: Queryable,
  operationId: string,
  id: string,
  fetcher: (url: string) => Promise<string>,
): Promise<void> {
  const overlay = await getKmlOverlay(db, operationId, id);
  if (!overlay) throw new ValidationError(NOT_FOUND);
  if (overlay.sourceType !== "url" || !overlay.sourceUrl) {
    throw new ValidationError("Nur URL-Quellen können neu geladen werden.");
  }
  await updateKmlContent(db, operationId, id, await fetcher(overlay.sourceUrl));
}

async function getKmlOverlay(
  db: Queryable,
  operationId: string,
  id: string,
): Promise<KmlOverlay | null> {
  const { rows } = await db.query<KmlRow>(
    `SELECT ${COLUMNS} FROM kml_overlays WHERE operation_id = $1 AND id = $2`,
    [operationId, id],
  );
  return rows[0] ? toOverlay(rows[0]) : null;
}

const NOT_FOUND = "KML-Overlay nicht gefunden.";

/** Keine KML-Ebene dieser ID im genannten Einsatz – nie dort gewesen oder schon gelöscht. */
function assertFound(rows: unknown[]): void {
  if (rows.length === 0) throw new ValidationError(NOT_FOUND);
}
