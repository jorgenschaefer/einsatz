import { readdirSync } from "node:fs";
import type { Db } from "@/server/db/db";

/**
 * Jede Zeile jeder Tabelle des public-Schemas außer `schema_migrations`, je
 * Tabelle geordnet: Zwei gleiche Schnappschüsse heißen, dass nichts
 * gespeichert, geändert oder gelöscht wurde.
 */
export async function snapshotDb(db: Db): Promise<Record<string, unknown[]>> {
  const { rows: tables } = await db.query<{ name: string }>(
    `SELECT table_name AS name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       AND table_name <> 'schema_migrations'
     ORDER BY table_name`,
  );
  const snapshot: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    const { rows } = await db.query<{ row: unknown }>(
      `SELECT to_jsonb(t) AS row FROM "${name}" t ORDER BY 1`,
    );
    snapshot[name] = rows.map(({ row }) => row);
  }
  return snapshot;
}

/** {@link snapshotDb} and every file and directory under `uploadsDir`. */
export async function snapshotDbAndUploads(db: Db, uploadsDir: string) {
  return {
    tables: await snapshotDb(db),
    uploads: readdirSync(uploadsDir, {
      recursive: true,
      encoding: "utf8",
    }).toSorted(),
  };
}
