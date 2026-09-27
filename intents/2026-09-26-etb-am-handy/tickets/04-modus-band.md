---
solution:  02-SOLUTION.md
satisfies: AC-18, AC-19
after:     01-hauptansichten-mit-leiste
status:    done
attempts:  1
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

## Record

Command: `docker compose -f docker-compose.test.yml up -d && npm run check`
(`tsc --noEmit`, `biome check`, `vitest run`). Result: green, 100 test files
and 694 tests.

Criterion → test (all in `src/map/SituationWorkspace.test.tsx` unless noted):

- **AC-18, the band and its button**:
  - `src/map/ModeBand.test.tsx`: "names the mode and ends it with its one
    button".
  - Schnellauswahl: "shows the Kartenzeichen band while a Schnellauswahl symbol
    is armed and cancels it". After „Abbrechen", KTW is not pressed and the band
    is gone.
  - Erweitert: "shows the Kartenzeichen band while an Erweitert composition is
    armed". This test passed on its first run because the band keys off
    `armedComposition`. A temporary `armedQuickId` mutation made it fail.
  - Drawing: "shows the Bereich band while drawing and cancels the drawing"
    (`cancelDrawing` is called, Polygon is not pressed, the band is gone).
  - Image overlay: "shows the Bild-Overlay band while editing and finishes
    editing from it" (`stopImageOverlayEdit` is called, the Deckkraft slider is
    gone).
  - "shows no mode band while nothing is armed".
- **AC-18, band directly under the search**: the band sits in the same
  absolutely positioned `Stack` as `SearchBar`, with an 8 px gap. Pixel layout
  cannot be observed in jsdom; see the browser check.
- **AC-18, opening Ebenen during image editing keeps the mode**: "keeps editing
  the image overlay when the Ebenen tab is opened". It passed without new code
  because tab changes never touched the mode. It pins behaviour that already
  existed.
- **AC-19**:
  - "cancels an armed symbol when switching to the ETB" (after switching back
    there is no band, KTW is not pressed, and a map click places nothing).
  - "cancels drawing when switching to the ETB".
  - "ends image editing when switching the main view".
  - Boundary: "keeps an armed symbol when the active main view is tapped again".
    Tapping the view that is already shown is not a switch. A temporary mutation
    that removed the guard made this test fail.
- **Edge case, width crosses 768 px and a mode keeps running**: "keeps an armed
  symbol when the width crosses 768 px". It passed without new code because
  nothing listens for the width change. It pins behaviour that already existed.

Implementation:
- New `src/map/ModeBand.tsx`: a toolbar named after the mode, with one button.
- `SituationWorkspace` renders one band per mode under `SearchBar`.
- `stopEditImage` was renamed to `endMode`, since it now ends every mode and not
  only image editing. The band buttons and `switchMainView` all call it.
- Three existing image-editing tests now look for the panel's „Fertig" inside
  the `tabpanel`, because there are two „Fertig" buttons while editing.

Browser check (step 5), run by a subagent with `run-einsatz` in headless
Chromium at 360×640 on a throwaway Einsatz that was deleted afterwards. All
modes pass:
- The search input is at y=52–88. The band is at y=96–134 (x=12, w=336, h=38),
  so it sits 8 px below the search in one row, and the text is not truncated.
- `scrollWidth` was 360 in every state.
- Every button ended its mode.
- Switching to the ETB and back left no band and KTW not pressed.
- Screenshots are in `/tmp/einsatz-shots/`.

Review: one fresh-context `critique` round with no blockers, no should-fix
items and no nits. No second round was needed.

Left standing:
- **Two „Fertig" buttons while an image overlay is edited (a decision for a
  person).** One is in the band, one in `ImageOverlayEditor` in Ebenen. The
  critique raised this as a tradeoff: the panel button is convenient, but it
  duplicates the band and screen readers list „Fertig" twice. AC-18 does not
  require removing it, and the panels are 06's, so I kept it.
- **Band shows through the open sidebar at 360 px (06).** With the transitional
  sidebar open, the map is 0 px wide. The search field and now the band spill
  as a narrow strip (about 24 px) over the sidebar content. The search stub
  already did this before this change. The phone panels/sheet are owned by 06,
  so this goes away there.
- **The band is 16 px wider than the search input.** It spans the search
  container, including the small „⋯" button beside the input. This is cosmetic.
- **Not from this ticket:** Leaflet-draw's hint while drawing is in English
  („Click to place first vertex").
- **A flaky test in a file this change does not touch.** One `npm run check`
  run timed out on `LageansichtShell.test.tsx` "shows an orange connection-lost
  symbol …" (5 s). Isolated reruns passed 6/6 on this tree and on a clean HEAD
  worktree. The final `npm run check` was fully green.

Departure from the plan: none, apart from the `endMode` rename. The plan said
to call "`resetMode` (and `stopEditImage` for image edit)"; `endMode` does both
in one place.
