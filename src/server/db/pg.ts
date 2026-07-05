import { Pool, type PoolClient } from "pg";
import type { Db, Transaction } from "./db";

// Über HMR/Serverstarts hinweg denselben Pool wiederverwenden.
const globalForDb = globalThis as unknown as { einsatzPool?: Pool };

function getPool(): Pool {
  if (!globalForDb.einsatzPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL ist nicht gesetzt.");
    globalForDb.einsatzPool = new Pool({ connectionString });
  }
  return globalForDb.einsatzPool;
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

/** {@link Db} auf Basis von PostgreSQL für die Laufzeit. */
export function getDb(): Db {
  const pool = getPool();
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
      await pool.end();
      globalForDb.einsatzPool = undefined;
    },
  };
}
