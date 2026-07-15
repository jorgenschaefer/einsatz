/**
 * Rückgabe der mutierenden Einsatz-Actions: leer bei Erfolg, sonst mit einer
 * `error`-Meldung fürs Panel. Bewusst client-sicher (kein `server-only`), damit
 * die Server-Actions und die Client-Komponenten (Lagekarte, ETB) denselben Typ
 * teilen, statt ihn je Seite eng nachzubauen.
 */
export interface ActionResult {
  error?: string;
}
