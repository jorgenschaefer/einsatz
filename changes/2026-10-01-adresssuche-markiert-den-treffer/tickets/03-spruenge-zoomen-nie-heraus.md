---
criteria:  CRITERIA.md
closes:    AC-12, AC-13
advances:
after:
status:    ready
attempts:  0
---

## Build
Jeder Sprung zu einem Punkt – aus der Suche, aus den Panels, zur eigenen
Position, bei Auswahl in der Ansicht – zoomt auf mindestens 16, aber nie heraus.

## Done when
> **AC-12** Die Wahl eines Treffers zentriert die Karte auf ihn. Ist die Karte weiter herausgezoomt als Zoomstufe 16, zoomt sie auf 16; ist sie auf 16 oder näher, bleibt die Zoomstufe.

> **AC-13** Für jeden anderen Sprung zu einem Punkt gilt dasselbe wie in AC-12: Springen aus dem Kartenzeichen- und dem Bereichs-Panel, Sprung zur eigenen Position in der Geräteansicht und Auswahl eines Kartenzeichens in der Ansicht.

## Nudges
> AC-12 und AC-13 an einer Stelle umsetzen, über die alle Sprünge laufen (heute setzt `useMapFocus.jumpTo` das Ziel, `SituationMap` wendet es mit `setView` an und kennt die aktuelle Zoomstufe).

## Context
- `src/map/useMapFocus.ts`: `jumpTo(lat, lng)` setzt `focusTarget` auf
  `{ lat, lng, zoom: 16 }`; `returnToDefaultView()` setzt ihn auf den
  Standard-Ausschnitt des Einsatzes – der darf weiter herauszoomen und bleibt
  unverändert.
- `src/map/SituationMap.tsx` (Effekt „Auf ein Suchergebnis springen", Zeile
  ~227) wendet `focusTarget` mit `adapter.setView` an; nur dort ist die aktuelle
  Zoomstufe bekannt (`adapter.getView().zoom`).
- Alle Sprünge laufen über `jumpTo`: Suche (`SearchBar`), Kartenzeichen- und
  Bereichs-Panel (`jumpFromPanel` in `SituationWorkspace.tsx`), eigene Position
  (`DeviceView.tsx`, Zeile ~76), Auswahl eines Kartenzeichens in der Ansicht
  (`ViewLinkView.tsx`).
- Die Fake-Adapter liefern `getView` mit Zoom 1; Tests überschreiben
  `adapter.getView` für Zoom 18. Bestehende Erwartungen auf `zoom: 16` bleiben
  so gültig.

## Plan
1. **Tests, rot**, je an der Stelle, wo der Nutzer handelt, jeweils mit
   `getView` auf Zoom 10 (→ `setView` mit 16) und auf Zoom 18 (→ `setView` mit
   18, auf den Punkt zentriert):
   - Suche, Adresse und Einsatzobjekt: neue Tests in
     `SituationWorkspace.symbols.test.tsx` neben den vorhandenen Suchtests
     (Zeile ~180; AC-12);
   - Kartenzeichen- und Bereichs-Panel: `SituationWorkspace.panels.test.tsx`;
   - eigene Position: `DeviceView.test.tsx`;
   - Auswahl eines Kartenzeichens: `ViewLinkView.test.tsx` (AC-13).
   - Gegenprobe in `SituationWorkspace.panels.test.tsx`: Rückkehr zum
     Standard-Ausschnitt zoomt auch von 18 auf dessen Zoom heraus.
   Beweis: die neuen Fälle mit Zoom 18 schlagen fehl.
2. **Art des Sprungs im Ziel.** In `useMapFocus.ts` einen Typ `FocusTarget`
   (`MapView` plus `zoomInOnly?: boolean`); `jumpTo` setzt `zoomInOnly: true`,
   `returnToDefaultView` nicht. `SituationMap`s Prop `focusTarget` nimmt
   `FocusTarget`. Beweis: `tsc --noEmit` grün.
3. **Regel anwenden.** Im Fokus-Effekt von `SituationMap.tsx`: bei
   `zoomInOnly` die Zoomstufe `max(target.zoom, adapter.getView().zoom)`,
   sonst `target.zoom`; `zoomInOnly` geht nicht an `setView`. Bestehender Test
   „jumps the map to a focus target via setView" in `SituationMap.test.tsx`
   bleibt grün. Beweis: Tests aus Schritt 1 grün.
4. **Im Browser prüfen** (Skill `run-einsatz`): auf Zoom 18 eine Adresse wählen
   – Zoom bleibt; auf Zoom 12 – Zoom wird 16.
5. `npm run check` grün.

## Not here
- Suchtreffer: `01-suchtreffer-auf-der-karte`; Trefferliste:
  `02-trefferliste-schliesst-nach-der-wahl`.
- Der Sprung beim Verschieben eines Kreises (`movingCircleId`) läuft nicht
  über `jumpTo` und bleibt, wie er ist.

## Left standing
