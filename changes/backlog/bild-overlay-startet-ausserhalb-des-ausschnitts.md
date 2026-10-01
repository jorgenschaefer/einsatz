---
effort: S
complexity: S
utility: M
---

# Neues Bild-Overlay startet außerhalb des aktuellen Ausschnitts

Lädt man im Panel „Ebenen" ein Bild-Overlay hoch, legt es sich nicht in den
Ausschnitt, den man gerade sieht, sondern auf den Standard-Ausschnitt des
Einsatzes. Hat der Einsatz keinen, landet es auf dem allgemeinen
Rückfall-Ausschnitt mitten in Deutschland. Man sieht nach dem Hochladen
nichts, und auch „Bearbeiten" holt das Bild nicht heran: Die Griffe liegen
neben dem Bild, also ebenfalls außerhalb, und es lässt sich nicht ins Bild
ziehen. Bleibt nur, den Standard-Ausschnitt auf die gewünschte Stelle zu
setzen, das Bild zu löschen und neu hochzuladen.

Der Grund: `uploadImageOverlayAction`
(`src/app/operations/[id]/image-overlay-actions.ts`) ruft
`defaultImagePlacement(operation.defaultView ?? null)` auf. Der Kommentar
von `defaultImagePlacement` (`src/map/image-overlay.ts`) verspricht dagegen
„mittig auf dem aktuellen Kartenausschnitt". Aufgefallen bei der Abnahme von
„Adresssuche markiert den Treffer" am 2026-10-01.

Gewünscht: Ein neues Bild-Overlay startet mittig auf dem Ausschnitt, den die
Person beim Hochladen sieht.
