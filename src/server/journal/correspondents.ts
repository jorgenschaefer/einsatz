import type { Queryable } from "@/server/db/db";

/**
 * Die Gesprächspartner des Gesamteinsatzes: seine Stellen und Von/An der
 * aktuellen Fassung aller gültigen Einträge. Werte, die sich nur in Groß- und
 * Kleinschreibung unterscheiden, sind einer, in der Schreibweise der jüngsten
 * Verwendung. Die Reihenfolge ist nicht festgelegt.
 */
export async function listCorrespondents(
  db: Queryable,
  operationId: string,
): Promise<string[]> {
  const { rows } = await db.query<{ correspondent: string }>(
    `SELECT DISTINCT ON (lower(correspondent)) correspondent
       FROM (
         SELECT name AS correspondent, named_at AS used_at
           FROM stations WHERE operation_id = $1
         UNION ALL
         SELECT party, COALESCE(edited_at, created_at)
           FROM journal_entries, unnest(ARRAY[sender, recipient]) AS party
          WHERE operation_id = $1 AND state = 'gueltig' AND party IS NOT NULL
       ) AS uses
      ORDER BY lower(correspondent), used_at DESC`,
    [operationId],
  );
  return rows.map((row) => row.correspondent);
}
