"use client";

import { useState } from "react";
import { ACTION_FAILED, isNextNavigation } from "@/app/action-failure";
import type { ActionResult } from "@/app/action-result";

/**
 * Führt eine Action aus und hält dabei `busy` und die Meldung fürs Panel.
 * Beim Start verschwindet die Meldung einer früheren Action. Wirft der
 * Aufruf, zeigt er `ACTION_FAILED`; navigiert er (etwa zur Anmeldung), liefert
 * `run` `null`, zeigt nichts und bleibt `busy`, bis die Seite ersetzt ist.
 * Erfolg ist also nur ein Ergebnis ohne `error`.
 */
export function useActionRunner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (
    action: () => Promise<ActionResult>,
  ): Promise<ActionResult | null> => {
    setBusy(true);
    setError(null);
    let result: ActionResult;
    try {
      result = await action();
    } catch (thrown) {
      if (isNextNavigation(thrown)) return null;
      result = { error: ACTION_FAILED };
    }
    setError(result.error ?? null);
    setBusy(false);
    return result;
  };

  return { busy, error, setError, run };
}
