/**
 * Schmale Datenbank-Abstraktion. Zur Laufzeit steht PostgreSQL (`pg`) dahinter,
 * in Tests ein eingebettetes PGlite. Beide sprechen dasselbe parametrisierte
 * SQL ($1, $2 …) und liefern `{ rows }`, sodass Repositories identisch laufen.
 */
export interface Queryable {
  query<R = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: R[] }>;
}

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
