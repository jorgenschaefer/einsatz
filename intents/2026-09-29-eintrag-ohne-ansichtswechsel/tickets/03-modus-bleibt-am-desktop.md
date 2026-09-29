---
solution:  02-SOLUTION.md
satisfies: AC-5
after:     01-seitenleiste-am-desktop
status:    done
attempts:  1
---

## Build

Ein Karten-Modus (Platzieren, Zeichnen, Kreis verschieben, Bild-Overlay
bearbeiten) endet nur noch, wenn die Karte verschwindet. Am Desktop bleibt er
beim Wechsel in der Seitenleiste bestehen. Am Smartphone endet er wie heute
beim Wechsel weg von der Karte, und künftig auch, wenn das Fenster unter
48 em schmaler wird, während die Seitenleiste ETB oder Stärke zeigt.

## Done when

> **AC-5** Ein Wechsel zwischen „Lagekarte", „ETB" und „Stärke" ändert am
> Desktop weder den Kartenausschnitt noch beendet er einen Karten-Modus. Am
> Smartphone beendet ein Wechsel, der die Karte ausblendet, den Modus wie
> heute.

Randfall aus der Lösung, den dieses Ticket trägt:

> **Karten-Modus und Seitenleiste.** Ist am Desktop ein Kartenzeichen zum
> Platzieren gewählt und schreibt die Führungskraft dann ins ETB, bleibt der
> Modus mit seinem Streifen auf der Karte bestehen. Der nächste Klick auf die
> Karte platziert das Zeichen (AC-5). Ein Karten-Modus endet, sobald die
> Karte verschwindet: am Smartphone durch einen Wechsel weg von „Lagekarte",
> und ebenso, wenn das Fenster unter die Schwelle schmaler wird, während die
> Seitenleiste ETB oder Stärke zeigt. (Vom Nutzer beim Schneiden
> freigegeben.)

## Context

Heute beendet `switchMainView` in `src/map/SituationWorkspace.tsx` bei jedem
Wechsel der Hauptansicht den Karten-Modus (`endMode()`), damit ein späterer
Tap auf die wieder gezeigte Karte nicht unerwartet ein Zeichen platziert. Nach
Ticket 01 bleibt die Karte am Desktop bei jedem Wechsel sichtbar, samt
Modusstreifen (`ModeBand`) oben auf der Karte. Die Regel ist dort also
überflüssig und reißt einen kurzen ETB-Eintrag mitten in einen Modus hinein
ab (Intent C-3: danach ohne weiteren Klick an der Karte weiterarbeiten).

Nach Ticket 01 gibt es `isDesktop` (`useIsDesktop()`, `null` vor dem Mount)
und zwei Wege, die Ansicht zu wechseln: die Leistenknöpfe (`switchMainView`)
und am Desktop die Kartenknöpfe, die die Seitenleiste auf „Lagekarte"
stellen. **Beide Wege** dürfen am Desktop den Modus nicht beenden. Die
Lösung verlässt sich darauf („Zurück kommt man über ‚Lagekarte' oder den
Kartenknopf").

Modi kommen aus `useMapMode()` (`armedQuickId`, `armedCustom`, `drawShape`,
`redrawAreaId`, `movingCircleId`, `editingImageId`, `reset`).

## Plan

1. **Regel: Modus endet, wenn die Karte verschwindet.** Eine benannte
   Ableitung „Karte sichtbar" (`isDesktop === true || mainView === "map"`)
   in `SituationWorkspace.tsx`. `switchMainView` ruft `endMode()` nur noch,
   wenn die Karte nach dem Wechsel nicht mehr sichtbar ist; derselbe Weg
   gilt für den Kartenknopf am Desktop. Beweis: Tests mit
   `stubMatchMedia(true)`: Schnellauswahl-Zeichen scharf stellen → „ETB" →
   Modusstreifen „Kartenzeichen platzieren" ist noch da, und ein Klick auf
   die Karte (über `captured.options`) ruft `onPlace` auf; ebenso über
   „Stärke" und zurück über einen Kartenknopf; `adapter.setView` wird dabei
   nicht aufgerufen. Mit `stubMatchMedia(false)`: der bestehende Test, dass
   ein Wechsel weg von der Karte den Modus beendet, bleibt grün.
2. **Schwelle nach unten beendet den Modus.** Ein Effekt beendet den Modus,
   wenn „Karte sichtbar" von wahr auf falsch wechselt, also wenn `isDesktop`
   auf `false` fällt, während `mainView` nicht `"map"` ist. Beweis: Test mit
   `stubMatchMedia(true)`, Modus scharf, „ETB", `fireChange(false)` →
   Modusstreifen weg; nach „Lagekarte" platziert ein Klick auf die Karte
   nichts. Gegenprobe: `fireChange(false)` bei gezeigter „Lagekarte" lässt
   den Modus stehen.
3. Wenn Schritt 2 die Regel aus Schritt 1 vollständig abdeckt (der Effekt
   feuert auch beim Wechsel am Smartphone), `endMode()` aus
   `switchMainView` entfernen, sodass es nur eine Stelle gibt. Beweis: alle
   Tests aus 1 und 2 grün.
4. `npm run check` grün.

## Not here

- Das Layout und die Kartenknöpfe, die die Seitenleiste auf „Lagekarte"
  stellen: Ticket 01.
- Fokus und festes Eingabefeld im ETB: Ticket 02.
- Die Bedienelemente eines Modus aus seinem Panel (Deckkraft, Ersetzen,
  Formwahl) bleiben unsichtbar, solange die Seitenleiste ETB oder Stärke
  zeigt; das ist in der Lösung als Tradeoff hingenommen und wird hier nicht
  geändert.

## Record

**Criteria → tests** (all in `src/map/SituationWorkspace.test.tsx`)

- **AC-5, desktop, mode kept** — „a map mode beside the sidebar on the desktop" › „keeps an armed symbol across the ETB and places it with the next map click" (the band stays, a map click calls `onPlace`, `adapter.setView` is not called), „keeps an armed symbol across the Stärke and back via a map button" (the same, returning through the „Bereiche" map button), „keeps drawing across the ETB" (`cancelDrawing` not called), „keeps image editing across the ETB" (`stopImageOverlayEdit` not called). „moving a circle" › „switching to the ETB keeps moving beside the sidebar".
- **AC-5, phone, mode ends** — „cancels an armed symbol when switching to the ETB on a phone", „cancels drawing when switching to the ETB on a phone", „ends image editing when switching the main view on a phone", „moving a circle" › „switching to the ETB ends moving on a phone". The first three are the existing tests, renamed. They run under the default phone `matchMedia` from the test setup.
- **Edge case, narrowing below 48 em** — „ends an armed symbol when the window narrows to a phone while the ETB is shown". The counter-check is the existing „keeps an armed symbol when the width crosses 768 px" (Lagekarte shown, so the mode stays).
- A mutation check confirmed that the new rule carries the phone behaviour. Removing its `endMode()` makes all five phone and narrowing tests go red.

**Command**: `npm run check` (test Postgres container up): green, 116 files, 1093 tests.

**Departures from the plan**

- Steps 2 and 3 are one rule. There is no `useEffect`: `SituationWorkspace` derives `mapShown` (`isMapShown(isDesktop, mainView)`), keeps the previous value in state, and calls `endMode()` during render when it drops from shown to hidden. This is React's "adjust state when a prop changes" pattern. A `useEffect` would have needed the unstable `endMode` as a dependency. `switchMainView` no longer calls `endMode()`, so desktop switches through the bar and through the map buttons leave the mode alone.
- `isMapShown` treats `isDesktop === null` as shown (`!== false`), not `=== true` as the plan wrote. That is the existing rule for the map's inline `display`, which now uses the same helper, so there is one definition of "map shown". No mode can be active before mount.
- The existing desktop test „moving a circle" › „switching to the ETB ends moving" pinned the old rule, which AC-5 reverses. It became a desktop „keeps moving" test plus a phone „ends moving" test.

**Left standing**

- Review (1 round): no blockers, no should-fix. Both nits are fixed: a misplaced JSDoc, and the phone-only switch tests now say „on a phone". No second round was run, because the first came back clean.
- Not checked in the browser. The change has no CSS or layout part, and everything it does is visible to the Vitest tests above.
- The ticket-01 Record item („a desktop test that an active map mode survives adding an ETB entry / a Stärkemeldung") is covered here: „keeps an armed symbol across the ETB …" arms a mode, switches to the ETB and places with the next click. It does not submit an ETB entry in between; submitting does not touch the map mode.
