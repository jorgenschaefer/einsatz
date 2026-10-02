"use client";

import { useNotifyingActionRunner } from "@/app/useNotifyingActionRunner";
import { SITUATION_MAP } from "./notification-sources";

/**
 * Fehlerkanal für die Karten-Interaktionen ohne eigenes Panel (Platzieren,
 * Zeichnen, Kreis verschieben): ihr Fehler steht als Benachrichtigung „Karte“.
 *
 * `runMapAction` liefert einen zurückgegebenen {error} wie die Action, eine
 * geworfene Ausnahme als {error: ACTION_FAILED} und eine Navigation (etwa zur
 * Anmeldung bei abgelaufener Sitzung) als `null`, ohne etwas zu zeigen.
 * Bewusst ohne Fehleranzeige bleiben nur die strukturell stets gültigen: onMove
 * (Drag auf gültige Koordinaten) und „Gerätelink erzeugen".
 */
export function useMapActionError() {
  const { run, closeError } = useNotifyingActionRunner(SITUATION_MAP);
  return { runMapAction: run, closeMapError: closeError };
}

export type RunMapAction = ReturnType<typeof useMapActionError>["runMapAction"];
