---
solution:  02-SOLUTION.md
satisfies: AC-5
after:     01-seitenleiste-am-desktop
status:    ready
attempts:  0
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
