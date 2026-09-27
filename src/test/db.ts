import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { inject, onTestFinished } from "vitest";
import type { Db } from "@/server/db/db";
import { createPGliteDb } from "@/server/db/pglite";

/** Lädt eine DB aus einer Vorlage und schließt sie am Testende – jede offene
 *  PGlite-Instanz hält ~260 MB, vergessene close()-Aufrufe füllen den Speicher. */
function fromTemplate(path: string): Db {
  const pg = new PGlite({ loadDataDir: new Blob([readFileSync(path)]) });
  onTestFinished(async () => {
    if (!pg.closed) await pg.close();
  });
  return createPGliteDb(pg);
}

/** Frische, migrierte In-Process-Datenbank für einen Test. */
export async function freshDb(): Promise<Db> {
  return fromTemplate(inject("migratedDbTemplate"));
}

/** Frische In-Process-Datenbank ohne jede Migration. */
export function emptyDb(): Db {
  return fromTemplate(inject("emptyDbTemplate"));
}
