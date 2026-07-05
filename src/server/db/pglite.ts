import { PGlite } from "@electric-sql/pglite";
import type { Db, Queryable, Transaction } from "./db";

/** In-Process-PostgreSQL (PGlite) als {@link Db} – ausschließlich für Tests. */
export function createPGliteDb(): Db {
  const pg = new PGlite();

  const asQueryable = (runner: {
    query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  }): Queryable => ({
    async query<R>(text: string, params?: readonly unknown[]) {
      const result = await runner.query(text, params ? [...params] : undefined);
      return { rows: result.rows as R[] };
    },
  });

  return {
    query: asQueryable(pg).query,
    async exec(sql: string) {
      await pg.exec(sql);
    },
    async transaction<T>(fn: (tx: Transaction) => Promise<T>) {
      return pg.transaction(async (tx) =>
        fn({
          ...asQueryable(tx),
          async exec(sql: string) {
            await tx.exec(sql);
          },
        }),
      ) as Promise<T>;
    },
    async close() {
      await pg.close();
    },
  };
}
