---
criteria:  CRITERIA.md
closes:
advances:
after:
status:    done
attempts:  1
---

## Build
Die Tests von `JournalPanel` nach Thema auf mehrere Dateien aufteilen, mit
gemeinsamen Hilfsfunktionen in einer Fixtures-Datei. Das Verhalten ändert sich
nicht. Die folgenden Tickets fügen dem ETB viele Tests hinzu, und
`src/app/operations/[id]/JournalPanel.test.tsx` hat schon heute rund 700 Zeilen.

## Done when
`src/app/operations/[id]/JournalPanel.test.tsx` ist aufgeteilt in:

- `src/app/operations/[id]/JournalPanel.fixtures.tsx` (neu): die Hilfsfunktionen `entry`, `panelProps`, `setup` und `chooseAction`, exportiert.
- `src/app/operations/[id]/JournalPanel.test.tsx`: Anzeige der Einträge, Filter „Automatische ausblenden“, neuer Eintrag, Fehler beim Hinzufügen, Layout und Scrollen.
- `src/app/operations/[id]/JournalPanel.annul.test.tsx` (neu): Annullieren und seine Rückfrage.
- `src/app/operations/[id]/JournalPanel.correct.test.tsx` (neu): Korrigieren, frühere Fassungen, Korrekturzeitpunkt.

Jeder bisherige Test steht unverändert in genau einer dieser Dateien, kein
Test fehlt, keiner ist neu. Das Verhalten ist unverändert und `npm run check`
ist grün.

## Nudges

## Context
Vorbild ist die Aufteilung der Workspace-Tests (Commit `8d8ebf7`,
„Split the workspace tests by topic“): `src/map/SituationWorkspace.fixtures.tsx`
hält die gemeinsamen Hilfen, die Tests liegen in
`SituationWorkspace.<thema>.test.tsx`.

`JournalPanel.test.tsx` besteht heute aus Imports, den Hilfen `entry()`,
`panelProps()`, `setup()`, `chooseAction()` (Zeilen 1–59) und einem
`describe("JournalPanel", …)` mit rund 45 Tests. Welcher Test zu welchem Thema
gehört, ergibt sich aus seinem Titel. Lässt sich ein Test keinem Thema klar
zuordnen, kommt er in `JournalPanel.test.tsx`.

## Plan
1. **Fixtures herauslösen.** `entry`, `panelProps`, `setup`, `chooseAction` in
   `src/app/operations/[id]/JournalPanel.fixtures.tsx` (neu) verschieben und
   exportieren; `JournalPanel.test.tsx` importiert sie von dort.
   *Beweis:* `npx vitest run src/app/operations/[id]/JournalPanel` ist grün
   und zählt so viele Tests wie vorher.
2. **Annullieren-Tests verschieben** nach
   `src/app/operations/[id]/JournalPanel.annul.test.tsx` (neu), unter
   `describe("JournalPanel – Annullieren", …)`.
   *Beweis:* dieselbe Testzahl, grün.
3. **Korrigieren-Tests verschieben** nach
   `src/app/operations/[id]/JournalPanel.correct.test.tsx` (neu), unter
   `describe("JournalPanel – Korrigieren", …)`, einschließlich der Tests zu
   früheren Fassungen und zum Korrekturzeitpunkt.
   *Beweis:* dieselbe Testzahl, grün.
4. **Aufräumen.** Imports, die in einer Datei nicht mehr gebraucht werden,
   entfernen (Biome meldet sie).
   *Beweis:* `npm run check` ist grün. Die Summe der Tests über die vier
   Dateien ist gleich der Zahl vor Schritt 1.

## Not here
Keine neuen Tests und keine Änderung an `JournalPanel.tsx`. Von, An und Weg
beginnen in `02-weg-und-kopfzeile`.

## Left standing
- Review-Nit nicht umgesetzt: Die verschobenen Tests stehen unter
  `describe("JournalPanel – Annullieren", …)` bzw.
  `describe("JournalPanel – Korrigieren", …)`, so wie der Plan es vorgibt. Damit
  ändern sich die vollständigen Testnamen (äußerer `describe`) der 20
  verschobenen Tests, anders als beim Vorbild `8d8ebf7`, das überall
  `describe("SituationWorkspace", …)` beibehielt. Die Testtitel selbst und die
  Testkörper sind unverändert.
- Grenzfälle, die nach der Regel „nicht klar zuzuordnen“ in
  `JournalPanel.test.tsx` geblieben sind: „offers only „Annullieren …“ for a
  gesamtstärke-gemeldet entry …“, „offers no actions for an annulled
  gesamtstärke-gemeldet entry“, „shows no correct/annul buttons on an entry
  until its menu is opened“, „renders an annulled entry struck through …“ und
  „offers no correct/annul actions on an annulled entry“.
- Dass kein Test fehlt oder sich geändert hat, beweist kein automatischer Test.
  Geprüft habe ich es so: Die Titel der 45 Tests sind vorher und nachher gleich.
  Die sortierten, nicht leeren Zeilen der alten Datei ab dem `describe` stimmen
  mit denen der drei neuen Dateien überein, bis auf Imports und
  `describe`-Kopfzeilen.
