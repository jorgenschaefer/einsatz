import type { Db } from "@/server/db/db";
import { migrate } from "@/server/db/migrations";
import { createPGliteDb } from "@/server/db/pglite";

/** Frische, migrierte In-Process-Datenbank für einen Test. */
export async function freshDb(): Promise<Db> {
  const db = createPGliteDb();
  await migrate(db);
  return db;
}
