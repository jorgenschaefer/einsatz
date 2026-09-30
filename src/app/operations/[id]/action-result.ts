/**
 * Rückgabe der mutierenden Actions (Einsatz und Nutzerverwaltung): leer bei
 * Erfolg, sonst mit einer `error`-Meldung fürs Panel. Bewusst client-sicher
 * (kein `server-only`), damit die Server-Actions und die Client-Komponenten
 * (Lagekarte, ETB, Nutzerverwaltung, `ConfirmationModal`) denselben Typ
 * teilen, statt ihn je Seite eng nachzubauen.
 */
export interface ActionResult {
  error?: string;
}
