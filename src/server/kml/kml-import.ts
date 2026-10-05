import type { Queryable } from "@/server/db/db";
import { requireOperation } from "@/server/operations/operations";
import { trimmedName } from "@/server/validation";
import { createFetchBudget } from "./fetch-budget";
import {
  assertKmlDocument,
  enforceKmlSizeLimit,
  fetchKmlFromUrl,
  resolveKmlNetworkLinks,
} from "./kml-fetch";
import { embedKmlIcons } from "./kml-icons";
import { createKmlOverlay } from "./kml-overlays";

/** Bindet eine hochgeladene KML-Datei als KML-Ebene des Einsatzes ein; `name`
 *  ist ihr Dateiname. */
export async function addKmlFile(
  db: Queryable,
  input: { operationId: string; name: unknown; content: string },
): Promise<void> {
  const name = trimmedName(input.name, "Der Dateiname");
  enforceKmlSizeLimit(input.content);
  assertKmlDocument(input.content, "Die Datei ist keine KML- oder KMZ-Datei.");
  await requireOperation(db, input.operationId);
  // KMZ-Dateien aus Google „Meine Karten“ enthalten oft nur einen
  // NetworkLink; dessen Ziel serverseitig auflösen, damit Geometrie erscheint.
  await createKmlOverlay(db, {
    operationId: input.operationId,
    sourceType: "file",
    sourceUrl: null,
    name,
    content: await resolveKmlFile(input.content),
  });
}

/** Lädt eine KML-URL zum Einbinden oder „Neu laden“, mit eigenem Budget, und
 *  bettet ihre Symbole ein. */
export async function loadKmlFromUrl(url: string): Promise<string> {
  const budget = createFetchBudget();
  return embedKmlIcons(await fetchKmlFromUrl(url, budget), budget);
}

/** Löst die NetworkLinks einer hochgeladenen KML-Datei auf, lehnt das Ergebnis
 *  über 20 MB ab und bettet dann die Symbole ein, mit eigenem Budget. */
export async function resolveKmlFile(content: string): Promise<string> {
  const budget = createFetchBudget();
  const resolved = await resolveKmlNetworkLinks(content, budget);
  enforceKmlSizeLimit(resolved);
  return embedKmlIcons(resolved, budget);
}
