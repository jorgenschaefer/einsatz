import { describe, expect, it } from "vitest";
import { emptyDb } from "@/test/db";
import type { Db } from "./db";
import { loadMigrations, migrate } from "./migrations";

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

  describe("case-insensitive usernames", () => {
    const UNIQUE_USERNAMES = "016_username_lower_unique.sql";
    const migrationsBefore = () =>
      loadMigrations().filter((m) => m.name < UNIQUE_USERNAMES);

    async function insertUsers(db: Db, ...usernames: string[]) {
      for (const username of usernames) {
        await db.query(
          `INSERT INTO users (id, username, password_hash, role)
           VALUES (gen_random_uuid(), $1, 'x', 'user')`,
          [username],
        );
      }
    }

    async function indexExists(db: Db) {
      const { rows } = await db.query<{ t: string | null }>(
        "SELECT to_regclass('users_username_lower_idx') AS t",
      );
      return rows[0].t !== null;
    }

    it("refuses to migrate while usernames collide, naming them", async () => {
      const db = await emptyDb();
      await migrate(db, migrationsBefore());
      await insertUsers(db, "Anna", "anna", "bob");

      const result = migrate(db);
      await expect(result).rejects.toThrow(/Anna, anna/);
      await expect(result).rejects.toThrow(/umbenennen oder löschen/);
      expect(await indexExists(db)).toBe(false);
    });

    it("adds the index when no usernames collide", async () => {
      const db = await emptyDb();
      await migrate(db, migrationsBefore());
      await insertUsers(db, "anna", "bob");

      await migrate(db);
      expect(await indexExists(db)).toBe(true);
    });
  });

  it("ends every existing session when session tokens become hashes", async () => {
    const db = await emptyDb();
    await migrate(
      db,
      loadMigrations().filter((m) => m.name < "017_session_token_hash.sql"),
    );
    await db.query(
      `INSERT INTO users (id, username, password_hash, role)
       VALUES ('00000000-0000-0000-0000-000000000001', 'anna', 'x', 'user')`,
    );
    await db.query(
      `INSERT INTO sessions (token, user_id, expires_at)
       VALUES ('plain', '00000000-0000-0000-0000-000000000001', now() + interval '1 hour')`,
    );

    await migrate(db);

    const { rows } = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM sessions",
    );
    expect(rows[0].count).toBe(0);
  });
});
