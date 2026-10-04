/** Ob `source` ein `"use server"`-Modul ist: die Direktive ist seine erste Anweisung. */
export function isServerActionModule(source: string): boolean {
  return USE_SERVER_FIRST.test(source);
}

/** Die Direktive, davor nur Leerraum und Kommentare. */
const USE_SERVER_FIRST =
  /^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*["']use server["']/;
