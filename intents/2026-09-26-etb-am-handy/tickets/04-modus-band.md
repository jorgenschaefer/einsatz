---
solution:  02-SOLUTION.md
satisfies: AC-18, AC-19
after:     01-hauptansichten-mit-leiste
status:    ready
attempts:  0
---

## Build
While a symbol is armed, an area is drawn or an image overlay is edited, a
band under the search names the mode with Abbrechen/Fertig; switching the main
view ends the mode.

## Done when
> **AC-18** Solange ein Kartenzeichen zum Platzieren gewählt ist, ein Bereich gezeichnet oder ein Bild-Overlay bearbeitet wird, zeigt die Karte oben ein Band mit dem Modus („Kartenzeichen platzieren", „Bereich zeichnen", „Bild-Overlay bearbeiten") und einem Knopf „Abbrechen" bzw. beim Bild-Overlay „Fertig". Das Band sitzt direkt unter der Suche. Deckkraft, Ersetzen und Löschen des Bild-Overlays bleiben im Panel Ebenen; es während des Bearbeitens zu öffnen, beendet den Modus nicht.

> **AC-19** Ein Wechsel der Hauptansicht bricht Platzieren und Zeichnen ab und beendet das Bearbeiten eines Bild-Overlays.

The third part of the edge case „Fenster wird über 768 px hinweg verbreitert
oder verschmälert" – „Ein Modus auf der Karte läuft weiter." – is owned here.

## Context
`useMapMode` (`src/map/useMapMode.ts`) holds the one mode: `quick`,
`custom` (symbol armed), `draw` (incl. redraw), `imageEdit`, `idle`, with
`reset()`. Today the only sign of an armed mode and the only way to cancel it
is inside the panels (quick-select `aria-pressed`, area shape buttons,
`ImageOverlayEditor` „Fertig" → `stopEditImage`). The search sits at the top
left of the map in `SituationWorkspace.tsx`. After 01 the main view can be
switched; nothing cancels a mode then, so a later tap on the map would place a
symbol.

## Plan
1. **Mode band.** New `src/map/ModeBand.tsx` (+ test): given the mode label
   and an action label, renders the band with one button. In
   `SituationWorkspace.tsx` it sits directly under the search: quick/custom →
   „Kartenzeichen platzieren" + „Abbrechen" (`resetMode`), draw → „Bereich
   zeichnen" + „Abbrechen" (`resetMode`), imageEdit → „Bild-Overlay
   bearbeiten" + „Fertig" (`stopEditImage`). Proof: workspace tests for each
   mode: band text appears on arming, the button ends the mode (quick-select
   no longer pressed / `cancelDrawing` on the fake adapter / image editor
   gone).
2. **Ebenen during image edit.** Proof: test "keeps editing the image overlay
   when the Ebenen tab is opened" (band still shown, editor visible).
3. **Switching ends the mode.** The main-view `onSelect` calls `resetMode`
   (and `stopEditImage` for image edit). Proof: tests "cancels an armed symbol
   when switching to the ETB" (after switching back no band, quick-select not
   pressed) and "ends image editing when switching the main view".
4. **Width change keeps the mode.** Proof: test "keeps an armed symbol when
   the width crosses 768 px" (fire a change on the stubbed media query; band
   still shown).
5. **Browser check** at 360 × 640: band readable in one row under the
   search, no horizontal scroll.
6. `npm run check`.

## Not here
Closing the sheet when a mode starts (06, AC-8). The map controls and
panels (06). Improving the drawing and placing tools themselves on the phone
(non-goal, excluded by the intent).
