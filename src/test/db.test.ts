import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Queryable } from "@/server/db/db";
import { emptyDb, ensureTemplate, freshDb, templateName } from "./db";

const migrations = [
  { name: "001_init.sql", sql: "CREATE TABLE a (id int);" },
  { name: "002_more.sql", sql: "CREATE TABLE b (id int);" },
];

const tableExists = async (db: Queryable, table: string) => {
  const { rows } = await db.query<{ t: string | null }>(
    "SELECT to_regclass($1) AS t",
    [table],
  );
  return rows[0].t !== null;
};

const databaseExists = async (db: Queryable, name: string) => {
  const { rows } = await db.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [name],
  );
  return rows.length > 0;
};

const currentDatabase = async (db: Queryable) => {
  const { rows } = await db.query<{ name: string }>(
    "SELECT current_database() AS name",
  );
  return rows[0].name;
};

describe("templateName", () => {
  it("is stable for the same migrations", () => {
    expect(templateName(migrations)).toBe(templateName(migrations));
  });

  it("changes when a migration changes", () => {
    const changed = [migrations[0], { ...migrations[1], sql: "-- anders" }];
    expect(templateName(changed)).not.toBe(templateName(migrations));
  });
});

describe("ensureTemplate", () => {
  const dropTemplate = async (db: Queryable, name: string) => {
    await db.query(`ALTER DATABASE "${name}" IS_TEMPLATE false`);
    await db.query(`DROP DATABASE "${name}"`);
  };

  it("builds a missing template once, even when asked concurrently", async () => {
    const db = await freshDb();
    const name = `einsatz_tpl_test_${randomUUID().slice(0, 8)}`;

    await Promise.all([
      ensureTemplate(name, migrations),
      ensureTemplate(name, migrations),
    ]);

    const { rows } = await db.query<{ datistemplate: boolean }>(
      "SELECT datistemplate FROM pg_database WHERE datname = $1",
      [name],
    );
    expect(rows).toEqual([{ datistemplate: true }]);
    await dropTemplate(db, name);
  });

  it("leaves no template behind when a migration fails", async () => {
    const db = await freshDb();
    const name = `einsatz_tpl_test_${randomUUID().slice(0, 8)}`;
    const broken = [{ name: "001_broken.sql", sql: "CREATE TABLE (;" }];

    await expect(ensureTemplate(name, broken)).rejects.toThrow();

    expect(await databaseExists(db, name)).toBe(false);
  });
});

// Die Tests bauen bewusst aufeinander auf (Vitest führt sie der Reihe nach aus).
describe("freshDb", () => {
  let fromPreviousTest: string;

  it("hands out a migrated database", async () => {
    const db = await freshDb();
    fromPreviousTest = await currentDatabase(db);
    expect(await tableExists(db, "users")).toBe(true);
  });

  it("drops the database once its test has finished", async () => {
    const db = await freshDb();
    expect(await databaseExists(db, fromPreviousTest)).toBe(false);
  });

  it("hands out isolated databases", async () => {
    const first = await freshDb();
    const second = await freshDb();
    await first.exec("CREATE TABLE marker (id int)");
    expect(await tableExists(second, "marker")).toBe(false);
  });

  it("tolerates tests that close their database explicitly", async () => {
    const db = await freshDb();
    await db.close();
  });
});

describe("emptyDb", () => {
  it("hands out a database without any tables", async () => {
    const db = await emptyDb();
    const { rows } = await db.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public'",
    );
    expect(rows).toEqual([]);
  });
});
