"use client";

import { useSyncExternalStore } from "react";

/** Ab dieser Breite gilt die Desktop-Form (Karte links, Seitenleiste rechts). */
const DESKTOP_QUERY = "(min-width: 48em)";

/**
 * Ist das Fenster mindestens 48 em breit? `null`, solange die Breite
 * unbekannt ist (Server-Rendering, Hydration); dann entscheidet CSS.
 */
export function useIsDesktop(): boolean | null {
  return useSyncExternalStore(subscribe, isDesktop, () => null);
}

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isDesktop() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}
