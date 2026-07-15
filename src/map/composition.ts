/** Großzügige Obergrenze je Freitextfeld – nur gegen Missbrauch, nicht fachlich.
 *  Client-sicher hier, damit Formular-Eingabe und Server-Validierung dieselbe
 *  Grenze teilen. */
export const MAX_COMPOSITION_FIELD_LENGTH = 200;

/** Die DV-102-Achsen, aus denen ein taktisches Zeichen erzeugt wird. */
export interface SymbolComposition {
  grundzeichen?: string;
  organisation?: string;
  fachaufgabe?: string;
  einheit?: string;
  verwaltungsstufe?: string;
  funktion?: string;
  symbol?: string;
  text?: string;
}
