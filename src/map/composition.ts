/** Großzügige Obergrenze je Freitextfeld – nur gegen Missbrauch, nicht fachlich.
 *  Client-sicher hier, damit Formular-Eingabe und Server-Validierung dieselbe
 *  Grenze teilen. */
export const MAX_COMPOSITION_FIELD_LENGTH = 200;

/** Die DV-102-Achsen, aus denen ein taktisches Zeichen erzeugt wird. */
export const COMPOSITION_AXES = [
  "grundzeichen",
  "organisation",
  "fachaufgabe",
  "einheit",
  "verwaltungsstufe",
  "funktion",
  "symbol",
  "text",
] as const;

export type SymbolComposition = Partial<
  Record<(typeof COMPOSITION_AXES)[number], string>
>;
