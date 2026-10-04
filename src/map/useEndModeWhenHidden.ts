import { useState } from "react";

/**
 * Verschwindet die Karte (Wechsel am Handy, Fenster schmaler als 48 em),
 * endet jeder Karten-Modus, sonst platziert ein späterer Tap auf die wieder
 * gezeigte Karte unerwartet ein Zeichen.
 */
export function useEndModeWhenHidden(mapShown: boolean, endMode: () => void) {
  const [mapWasShown, setMapWasShown] = useState(mapShown);
  if (mapShown !== mapWasShown) {
    setMapWasShown(mapShown);
    if (!mapShown) endMode();
  }
}
