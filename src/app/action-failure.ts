import { unstable_rethrow } from "next/navigation";
import type { ActionResult } from "@/app/action-result";

/** Meldung, wenn der Aufruf einer Action auf dem Client wirft. */
export const ACTION_FAILED = "Das hat nicht geklappt. Bitte erneut versuchen.";

/**
 * Wartet eine Action ab: Wirft sie, wird daraus `ACTION_FAILED`; navigiert
 * sie (etwa zur Anmeldung), liefert sie `null`, und der Aufrufer zeigt nichts.
 */
export async function settleAction<R extends ActionResult>(
  action: () => Promise<R>,
): Promise<R | ActionResult | null> {
  try {
    return await action();
  } catch (thrown) {
    if (isNextNavigation(thrown)) return null;
    return { error: ACTION_FAILED };
  }
}

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
