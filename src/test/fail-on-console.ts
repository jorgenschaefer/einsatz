import { format } from "node:util";
import { afterEach, beforeEach } from "vitest";

// Ein grüner Testlauf ist ein stiller Testlauf: console.error/warn (etwa
// Reacts act()-Warnungen oder geloggte Fehler) lassen den Test scheitern.
// Tests, die bewusst loggen, fangen die Ausgabe mit
// `vi.spyOn(console, "error").mockImplementation(() => {})` ab und prüfen sie.
const unexpected: string[] = [];

for (const method of ["error", "warn"] as const) {
  const original = console[method];
  console[method] = (...args: unknown[]) => {
    unexpected.push(`console.${method}: ${format(...args)}`);
    original(...args);
  };
}

beforeEach(() => {
  unexpected.length = 0;
});

afterEach(() => {
  if (unexpected.length > 0) {
    throw new Error(`Unerwartete Konsolenausgabe:\n${unexpected.join("\n")}`);
  }
});
