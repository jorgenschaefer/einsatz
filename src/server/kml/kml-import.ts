import { createFetchBudget } from "./fetch-budget";
import {
  enforceKmlSizeLimit,
  fetchKmlFromUrl,
  resolveKmlNetworkLinks,
} from "./kml-fetch";
import { embedKmlIcons } from "./kml-icons";

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
