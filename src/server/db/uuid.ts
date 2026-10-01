const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ob `value` eine UUID in der Schreibweise mit Bindestrichen ist, gleich in
 * welcher Groß- und Kleinschreibung. Was das nicht ist, lässt Postgres beim
 * Vergleich mit einer `uuid`-Spalte werfen oder kommt in der App nicht vor.
 */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
