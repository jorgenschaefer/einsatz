import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./db";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

export function loadMigrations(): { name: string; sql: string }[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({
      name,
      sql: readFileSync(join(migrationsDir, name), "utf8"),
    }));
}

/** Wendet alle noch nicht angewandten Migrationen der Reihe nach an (idempotent). */
export async function migrate(
  db: Db,
  migrations = loadMigrations(),
): Promise<void> {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name       text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const { rows } = await db.query<{ name: string }>(
    "SELECT name FROM schema_migrations",
  );
  const applied = new Set(rows.map((r) => r.name));

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    // DDL und Buchung laufen gemeinsam in einer Transaktion, damit keine
    // Migration angewandt, aber unregistriert zurückbleibt (Abbruch dazwischen).
    await db.transaction(async (tx) => {
      await tx.exec(migration.sql);
      await tx.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        migration.name,
      ]);
    });
  }
}
