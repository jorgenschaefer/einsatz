"use client";

import { useState } from "react";
import { ACTION_FAILED, isNextNavigation } from "@/app/action-failure";
import type { ActionResult } from "@/app/action-result";

/**
 * Fehlerkanal für die Karten-Interaktionen ohne eigenes Panel (Platzieren,
 * Zeichnen, Kreis verschieben); wird als Alert über der Karte gezeigt.
 *
 * Dialoge und Panels zeigen die Fehler ihrer Actions selbst. Karten-
 * Interaktionen ohne Panel laufen über `runMapAction`: ein zurückgegebener
 * {error} landet im mapError-Alert, eine geworfene Ausnahme (kein
 * ValidationError – z. B. DB-/Netzfehler, die operationAction weiterwirft) im
 * gleichen Kanal mit ACTION_FAILED. Ein Redirect (etwa zur Anmeldung bei
 * abgelaufener Sitzung) zeigt nichts, die Seite wird ersetzt. Bewusst ohne
 * Fehleranzeige bleiben nur die strukturell stets gültigen: onMove (Drag auf
 * gültige Koordinaten) und „Gerätelink erzeugen".
 */
export function useMapActionError(closeSheetOnPhone: () => void) {
  const [mapError, setMapError] = useState<string | null>(null);

  const runMapAction = async <R extends ActionResult>(
    op: () => Promise<R>,
  ): Promise<R | undefined> => {
    setMapError(null);
    try {
      const result = await op();
      if (result.error) showMapError(result.error);
      return result;
    } catch (thrown) {
      if (!isNextNavigation(thrown)) showMapError(ACTION_FAILED);
      return undefined;
    }
  };
  // Der Fehler steht unten auf der Karte; am Handy läge er sonst unter dem Blatt.
  const showMapError = (error: string) => {
    setMapError(error);
    closeSheetOnPhone();
  };

  return {
    mapError,
    dismissMapError: () => setMapError(null),
    runMapAction,
  };
}

export type RunMapAction = ReturnType<typeof useMapActionError>["runMapAction"];
