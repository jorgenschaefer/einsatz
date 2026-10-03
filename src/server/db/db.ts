import type { Pool, PoolClient } from "pg";

/**
 * Schmale Datenbank-Abstraktion über PostgreSQL (`pg`). Zur Laufzeit hängt sie
 * am Pool aus `DATABASE_URL`, in Tests an einer eigenen Datenbank je Test
 * (`@/test/db`).
 */
export interface Queryable {
  query<R = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: R[] }>;
}

/** Ob `err` ein Verstoß gegen einen eindeutigen Index ist (PostgreSQL 23505). */
export const isUniqueViolation = (err: unknown): boolean =>
  (err as { code?: string } | null)?.code === "23505";

/** Ausführungskontext innerhalb einer Transaktion: parametrisierte Abfragen
 *  plus mehrteilige Skripte (für DDL in Migrationen). */
export interface Transaction extends Queryable {
  exec(sql: string): Promise<void>;
}

export interface Db extends Queryable {
  /** Führt ein (ggf. mehrteiliges) SQL-Skript ohne Parameter aus – für Migrationen. */
  exec(sql: string): Promise<void>;
  /** Führt `fn` in einer Transaktion aus; wirft `fn`, wird zurückgerollt. */
  transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const clientTransaction = (client: PoolClient): Transaction => ({
  async query<R>(text: string, params?: readonly unknown[]) {
    const result = await client.query(text, params ? [...params] : undefined);
    return { rows: result.rows as R[] };
  },
  async exec(sql: string) {
    await client.query(sql);
  },
});

/** {@link Db} auf Basis eines PostgreSQL-Pools. */
export function createPgDb(pool: Pool): Db {
  return {
    async query<R>(text: string, params?: readonly unknown[]) {
      const result = await pool.query(text, params ? [...params] : undefined);
      return { rows: result.rows as R[] };
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async transaction<T>(fn: (tx: Transaction) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(clientTransaction(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      if (!pool.ended) await pool.end();
    },
  };
}
