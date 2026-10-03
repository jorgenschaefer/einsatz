import { createFetchBudget } from "./fetch-budget";
import { fetchKmlFromUrl, resolveKmlNetworkLinks } from "./kml-fetch";

/** Lädt eine KML-URL zum Einbinden oder „Neu laden“, mit eigenem Budget. */
export function loadKmlFromUrl(url: string): Promise<string> {
  return fetchKmlFromUrl(url, createFetchBudget());
}

/** Löst die NetworkLinks einer hochgeladenen KML-Datei auf, mit eigenem Budget. */
export function resolveKmlFile(content: string): Promise<string> {
  return resolveKmlNetworkLinks(content, createFetchBudget());
}
