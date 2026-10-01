import { useState } from "react";
import type { MapView } from "./view";

/**
 * Ein Ziel für den Kartenausschnitt. Bei `zoomInOnly` zoomt die Karte auf
 * mindestens `zoom`, aber nie heraus.
 */
export interface FocusTarget extends MapView {
  zoomInOnly?: boolean;
}

/**
 * Steuert den Kartenausschnitt einer Kartenseite: das Springen zu einem Punkt
 * (`jumpTo`) und den Rücksprung zum Standard-Ausschnitt des Einsatzes
 * (`returnToDefaultView`). `focusTarget` wird an die Karte durchgereicht.
 */
export function useMapFocus(operationDefaultView: MapView | null) {
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);

  const jumpTo = (lat: number, lng: number) =>
    setFocusTarget({ lat, lng, zoom: 16, zoomInOnly: true });

  // Immer ein frisches Objekt setzen, damit der Ausschnitt auch bei
  // wiederholtem Klick erneut auf den Standard springt.
  const returnToDefaultView = () => {
    if (operationDefaultView) setFocusTarget({ ...operationDefaultView });
  };

  return { focusTarget, jumpTo, returnToDefaultView };
}
