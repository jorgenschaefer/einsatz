import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { TestProject } from "vitest/node";
import { migrate } from "@/server/db/migrations";
import { createPGliteDb } from "@/server/db/pglite";

declare module "vitest" {
  export interface ProvidedContext {
    emptyDbTemplate: string;
    migratedDbTemplate: string;
  }
}

/**
 * Vitest-globalSetup: Ein neues PGlite braucht ~3 s für `initdb`, das Laden
 * eines fertigen Datenverzeichnisses nur einen Bruchteil davon. Deshalb einmal
 * pro Testlauf ein leeres und ein migriertes Datenverzeichnis erzeugen, aus
 * denen jeder Test seine eigene, isolierte DB lädt (siehe `@/test/db`).
 */
export default async function setup(project: TestProject) {
  const dir = mkdtempSync(join(tmpdir(), "einsatz-db-templates-"));
  const dump = async (pg: PGlite, name: string) => {
    const path = join(dir, name);
    const blob = await pg.dumpDataDir("none");
    writeFileSync(path, new Uint8Array(await blob.arrayBuffer()));
    return path;
  };

  const pg = new PGlite();
  project.provide("emptyDbTemplate", await dump(pg, "empty.tar"));
  await migrate(createPGliteDb(pg));
  project.provide("migratedDbTemplate", await dump(pg, "migrated.tar"));
  await pg.close();

  return () => rmSync(dir, { recursive: true, force: true });
}
