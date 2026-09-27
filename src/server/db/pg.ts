import { Pool } from "pg";
import { createPgDb, type Db } from "./db";

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

/** {@link Db} auf Basis von PostgreSQL für die Laufzeit (`DATABASE_URL`). */
export function getDb(): Db {
  const db = createPgDb(getPool());
  return {
    ...db,
    async close() {
      await db.close();
      globalForDb.einsatzPool = undefined;
    },
  };
}
