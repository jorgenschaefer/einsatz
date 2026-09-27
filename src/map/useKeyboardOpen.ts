"use client";

import { useSyncExternalStore } from "react";

/**
 * Ab diesem Höhenverlust des sichtbaren Viewports gilt die Bildschirmtastatur
 * als offen. Fokus taugt nicht als Signal: Android schließt die Tastatur mit
 * „Zurück", ohne dem Textfeld den Fokus zu nehmen.
 */
const KEYBOARD_MIN_HEIGHT = 150;

/** Ist am Handy die Bildschirmtastatur offen? Ohne `visualViewport` nie. */
export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, isKeyboardOpen, () => false);
}

function subscribe(onChange: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", onChange);
  return () => viewport?.removeEventListener("resize", onChange);
}

function isKeyboardOpen() {
  const viewport = window.visualViewport;
  if (!viewport) return false;
  return window.innerHeight - viewport.height > KEYBOARD_MIN_HEIGHT;
}
