import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { onTestFinished } from "vitest";
import { createPgDb, type Db } from "@/server/db/db";
import { loadMigrations, migrate } from "@/server/db/migrations";

/**
 * Test-Datenbanken liegen im Wegwerf-Postgres aus `docker-compose.test.yml`.
 * Jeder Test bekommt eine eigene Datenbank, geklont aus einer migrierten
 * Vorlage – isoliert, parallel lauffähig und ohne Aufräumen zwischen Tests.
 * Alles passiert erst beim ersten Aufruf: Tests ohne DB brauchen keinen Server.
 */
const ADMIN_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://einsatz:einsatz@localhost:5437/postgres";

type Migration = { name: string; sql: string };

const urlFor = (database: string) =>
  Object.assign(new URL(ADMIN_URL), { pathname: `/${database}` }).toString();

let admin: Pool | undefined;

async function adminClient(): Promise<PoolClient> {
  // allowExitOnIdle: der Pool lebt bis zum Ende des Workers und soll ihn nicht aufhalten.
  admin ??= new Pool({ connectionString: ADMIN_URL, allowExitOnIdle: true });
  try {
    return await admin.connect();
  } catch (error) {
    throw new Error(
      `Test-Postgres unter ${ADMIN_URL} nicht erreichbar – starten mit \`docker compose -f docker-compose.test.yml up -d\`.`,
      { cause: error },
    );
  }
}

async function adminQuery(text: string): Promise<void> {
  const client = await adminClient();
  try {
    await client.query(text);
  } finally {
    client.release();
  }
}

/** Name der Vorlage zu einem Migrationsstand: neue Migration, neue Vorlage. */
export function templateName(migrations: Migration[]): string {
  const hash = createHash("sha256");
  for (const { name, sql } of migrations) hash.update(name).update(sql);
  return `einsatz_tpl_${hash.digest("hex").slice(0, 12)}`;
}

/**
 * Legt die Vorlage `name` an, falls es sie noch nicht gibt. Parallele Worker
 * und Testläufe serialisiert ein Advisory-Lock; gebaut wird unter einem
 * Zwischennamen, damit ein abgebrochener Lauf keine halbe Vorlage hinterlässt.
 */
export async function ensureTemplate(
  name: string,
  migrations: Migration[] = loadMigrations(),
): Promise<void> {
  const client = await adminClient();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [name]);
    const { rowCount } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [name],
    );
    if (rowCount) return;

    const building = `${name}_building`;
    await client.query(`DROP DATABASE IF EXISTS "${building}"`);
    await client.query(`CREATE DATABASE "${building}"`);
    const pool = new Pool({ connectionString: urlFor(building) });
    try {
      await migrate(createPgDb(pool), migrations);
    } catch (error) {
      await pool.end();
      await client.query(`DROP DATABASE "${building}"`);
      throw error;
    }
    await pool.end();
    await client.query(`ALTER DATABASE "${building}" RENAME TO "${name}"`);
    await client.query(`ALTER DATABASE "${name}" IS_TEMPLATE true`);
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [name]);
    client.release();
  }
}

/** Neue Datenbank, die am Ende des laufenden Tests wieder gelöscht wird. */
async function createTestDb(options: string): Promise<Db> {
  const name = `einsatz_test_${randomUUID().replaceAll("-", "")}`;
  await adminQuery(`CREATE DATABASE "${name}" ${options}`);
  const pool = new Pool({ connectionString: urlFor(name), max: 5 });
  const db = createPgDb(pool);
  onTestFinished(async () => {
    await db.close();
    await adminQuery(`DROP DATABASE "${name}"`);
  });
  return db;
}

let template: Promise<string> | undefined;

/** Frische, migrierte Datenbank für einen Test. */
export async function freshDb(): Promise<Db> {
  template ??= (async () => {
    const name = templateName(loadMigrations());
    await ensureTemplate(name);
    return name;
  })();
  return createTestDb(`TEMPLATE "${await template}"`);
}

/** Frische Datenbank ohne jede Migration. */
export function emptyDb(): Promise<Db> {
  return createTestDb("");
}
