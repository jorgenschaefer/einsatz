import { unstable_rethrow } from "next/navigation";

/** Meldung, wenn der Aufruf einer Action auf dem Client wirft. */
export const ACTION_FAILED = "Das hat nicht geklappt. Bitte erneut versuchen.";

/**
 * Eine Server-Action, die `redirect` ruft, lehnt auf dem Client mit einem
 * Redirect-Fehler ab, nachdem der Router die Navigation angestoßen hat.
 * `unstable_rethrow` ist die öffentliche API, die ihn erkennt. Sie erkennt
 * auch `notFound`, `forbidden` und `unauthorized`; die navigieren aus einer
 * Server-Action aber nicht, der Aufrufer bliebe gesperrt. Actions, deren
 * Fehler so behandelt werden, dürfen sie deshalb nicht rufen.
 */
export function isNextNavigation(error: unknown): boolean {
  try {
    unstable_rethrow(error);
    return false;
  } catch {
    return true;
  }
}
