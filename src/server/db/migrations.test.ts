import { describe, expect, it } from "vitest";
import { emptyDb } from "@/test/db";
import { migrate } from "./migrations";

describe("migrate", () => {
  it("creates the core tables", async () => {
    const db = await emptyDb();
    await migrate(db);

    const { rows } = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const tables = rows.map((r) => r.table_name);
    expect(tables).toEqual(
      expect.arrayContaining([
        "users",
        "sessions",
        "operations",
        "journal_entries",
      ]),
    );
  });

  it("rolls back a migration's DDL when its bookkeeping fails (atomic)", async () => {
    const db = await emptyDb();
    // Zwei Migrationen mit gleichem Namen: die zweite Buchung verletzt den
    // Primärschlüssel von schema_migrations, nachdem ihre DDL lief.
    const migrations = [
      { name: "dup.sql", sql: "CREATE TABLE first_t (id int);" },
      { name: "dup.sql", sql: "CREATE TABLE second_t (id int);" },
    ];
    await expect(migrate(db, migrations)).rejects.toThrow();

    const { rows } = await db.query<{ t: string | null }>(
      "SELECT to_regclass('second_t') AS t",
    );
    expect(rows[0].t).toBeNull(); // DDL mit der fehlgeschlagenen Buchung zurückgerollt
  });

  it("is idempotent when run twice", async () => {
    const db = await emptyDb();
    await migrate(db);
    const countSql = "SELECT count(*)::text AS count FROM schema_migrations";
    const afterFirst = await db.query<{ count: string }>(countSql);

    await expect(migrate(db)).resolves.not.toThrow();
    const afterSecond = await db.query<{ count: string }>(countSql);

    expect(Number(afterFirst.rows[0].count)).toBeGreaterThan(0);
    expect(afterSecond.rows[0].count).toBe(afterFirst.rows[0].count);
  });
});
