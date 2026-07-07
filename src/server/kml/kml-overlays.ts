import { randomUUID } from "node:crypto";
import type { Queryable } from "@/server/db/db";
import { ValidationError } from "@/server/validation";

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

export async function createKmlOverlay(
  db: Queryable,
  input: {
    operationId: string;
    sourceType: KmlSourceType;
    sourceUrl: string | null;
    name: string;
    content: string;
  },
): Promise<KmlOverlay> {
  const { rows } = await db.query<KmlRow>(
    `INSERT INTO kml_overlays (id, operation_id, source_type, source_url, name, content)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [
      randomUUID(),
      input.operationId,
      input.sourceType,
      input.sourceUrl,
      input.name,
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

async function getKmlOverlay(
  db: Queryable,
  id: string,
): Promise<KmlOverlay | null> {
  const { rows } = await db.query<KmlRow>(
    `SELECT ${COLUMNS} FROM kml_overlays WHERE id = $1`,
    [id],
  );
  return rows[0] ? toOverlay(rows[0]) : null;
}

export async function setKmlVisibility(
  db: Queryable,
  id: string,
  visible: boolean,
): Promise<void> {
  await db.query("UPDATE kml_overlays SET visible = $2 WHERE id = $1", [
    id,
    visible,
  ]);
}

export async function updateKmlContent(
  db: Queryable,
  id: string,
  content: string,
): Promise<void> {
  await db.query("UPDATE kml_overlays SET content = $2 WHERE id = $1", [
    id,
    content,
  ]);
}

export async function deleteKmlOverlay(
  db: Queryable,
  id: string,
): Promise<void> {
  await db.query("DELETE FROM kml_overlays WHERE id = $1", [id]);
}

/**
 * Lädt ein URL-Overlay neu: holt (nur bei URL-Quelle) den Inhalt erneut über
 * `fetcher` und ersetzt den zwischengespeicherten Inhalt. Datei-Quellen können
 * nicht neu geladen werden.
 */
export async function reloadKmlOverlay(
  db: Queryable,
  id: string,
  fetcher: (url: string) => Promise<string>,
): Promise<void> {
  const overlay = await getKmlOverlay(db, id);
  if (!overlay) throw new ValidationError("KML-Overlay nicht gefunden.");
  if (overlay.sourceType !== "url" || !overlay.sourceUrl) {
    throw new ValidationError("Nur URL-Quellen können neu geladen werden.");
  }
  await updateKmlContent(db, id, await fetcher(overlay.sourceUrl));
}
