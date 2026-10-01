---
criteria:  CRITERIA.md
closes:    AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
advances:
after:
status:    ready
attempts:  0
---

## Build
Nach dem Speichern im ETB sieht man, was man als Nächstes braucht: Die
Chip-Zeilen „Von“ und „An“ stehen nach erfolgreichem Speichern wieder am
Anfang, und eine Fehlermeldung beim Speichern steht im Formular, dessen
Speichern scheiterte, statt oben im ETB.

## Done when
> **AC-1** Nach dem erfolgreichen Speichern eines neuen ETB-Eintrags stehen die Chip-Zeilen „Von“ und „An“ am Anfang: Der erste Chip jeder Zeile ist vollständig zu sehen, auch wenn die Zeile vorher waagerecht verschoben war (360 px).

> **AC-2** Scheitert das Speichern eines neuen Eintrags, bleiben Text, Von, An und Weg erhalten, und die Chip-Zeilen bleiben so verschoben, wie sie waren.

> **AC-3** Scheitert das Speichern eines neuen Eintrags, erscheint die zurückgegebene Fehlermeldung bzw. „Speichern fehlgeschlagen. Bitte erneut versuchen.“ im Formular „Neuer Eintrag“ zwischen Textfeld und der Zeile mit Weg und „Eintrag hinzufügen“. Am Handy (360 px) sind die Meldung und „Eintrag hinzufügen“ danach vollständig zu sehen, ohne dass man scrollt.

> **AC-4** Scheitert das Speichern einer Korrektur, erscheint die Meldung an derselben Stelle im Formular dieser Korrektur, innerhalb des korrigierten Eintrags; Text, Von, An und Weg der Korrektur bleiben erhalten.

> **AC-5** Oben im ETB erscheint keine Meldung zum Speichern mehr. Eine Meldung steht nur im Formular, dessen Speichern scheiterte; sie verschwindet nach dem nächsten erfolgreichen Speichern dieses Formulars, über ihr „×“ und bei einer Korrektur mit „Abbrechen“.

> **AC-6** Am Desktop steht „Neuer Eintrag“ weiter fest unter der scrollenden Liste, die Meldung darin an derselben Stelle wie am Handy.

## Nudges
> `JournalPanel` hält je einen Fehlerzustand für „Neuer Eintrag“ und für die offene Korrektur und gibt ihn an `EntryForm`; `EntryForm` zeigt ihn.

> Den Rücksprung der Chip-Zeilen auslösen, wenn `EntryForm` nach erfolgreichem Speichern leert, nicht über `value === null` in `EntryRouteChips`: Auch Abwählen per Tipp setzt `null`.

> Scheitert das Speichern von „Neuer Eintrag“, den Formularbereich so ins Bild scrollen, wie `scrollToEnd` in `JournalPanel` es mit `newEntryRef` schon tut (`block: "end"`).

## Context
- `src/journal/EntryForm.tsx`: Text, Von, An und Weg für „Neuer Eintrag“ und
  für die Korrektur. `submit` ruft `onSubmit`; nur wenn das `true` liefert,
  leert es Text, Von und An und schließt die Felder „andere …“
  (`setOtherOpen(NO_OTHER_OPEN)`). Die Knopfzeile ist die `Group` mit
  `EntryChannelSelect` und dem Absenden-Knopf (bei der Korrektur zusätzlich
  „Abbrechen“).
- `src/journal/EntryRouteFields.tsx`: `EntryRouteChips` rendert die Chips in
  `.entry-route-chips-row` (`overflow-x: auto`, `entry-route-fields.css`). Die
  Zeile wird nie zurückgescrollt. Die Reihenfolge ändert sich nach dem
  Speichern, weil `JournalPanel` `memory.remember(content)` ruft.
- `src/app/operations/[id]/JournalPanel.tsx`: ein `error`-Zustand für
  `addEntry` und `correctEditedEntry`, gezeigt als `Alert` mit `×` ganz oben
  im Panel. `SAVE_ERROR` ist der Text bei einem geworfenen Fehler; ein
  zurückgegebenes `{ error }` wird wörtlich gezeigt. Die Korrektur ist ein
  `EntryForm` mit `compact` im Eintrag, „Neuer Eintrag“ eines in
  `.journal-new-entry` (`scroll.newEntryRef`). Annullieren läuft über
  `ConfirmationModal` und zeigt seine Fehler dort; das bleibt so.
- `useScrollToEnd` in derselben Datei: `scrollToEnd(listEnd, newEntry)` ruft
  `newEntry.scrollIntoView({ block: "end" })`. Am Desktop steht
  `.journal-new-entry` fest unter der scrollenden `.journal-entries`
  (`src/map/situation-workspace.css`).
- Agreed design: ein roter `Alert` mit `role="alert"` und „×“ zwischen
  Textfeld und Knopfzeile, für beide Formulare gleich. Specimen:
  https://claude.ai/artifact/TJNzixHgczo8srr1g6dqYe, Kopie in
  `../specimens/fehlermeldung-im-formular.html`. **Agreed; build to this, do
  not redesign.** Die Chip-Zeilen springen ohne Animation an den Anfang.
- Tests: `JournalPanel.test.tsx` („surfaces a save error and keeps the draft
  when adding fails“, „scrolling to the latest entry“ mit gespyten
  `scrollIntoView`), `JournalPanel.correct.test.tsx` („surfaces a save error
  when a correction fails“, „surfaces a returned {error} …“),
  `JournalPanel.other.test.tsx` („keeps the fields open with their input when
  adding fails“). Fixtures in `JournalPanel.fixtures.tsx`. jsdom misst kein
  Layout, `scrollLeft` lässt sich aber setzen und lesen.

## Plan
1. **Red: Chip-Zeilen nach dem Speichern (AC-1, AC-2).** In
   `JournalPanel.route.test.tsx` die `scrollLeft` beider
   `.entry-route-chips-row` im Formular „Neuer Eintrag“ auf z. B. 200 setzen,
   Text eingeben, „Eintrag hinzufügen“. Erwartung: beide Zeilen stehen auf 0.
   Dazu ein Test mit `onAdd`, das wirft: Beide Zeilen behalten 200, Text, Von,
   An und Weg sind erhalten. Beweis: Der erste Test ist rot, der zweite grün.
2. **Rücksprung bauen.** `EntryForm` zählt erfolgreiche Speicherungen in einem
   State, der in `submit` nach dem Leeren hochgezählt wird. Den Zähler als
   `key` an beide `EntryRouteChips` geben: Ein neues Mounten setzt die Zeile auf
   den Anfang, und der ganze Zustand liegt ohnehin in `EntryForm`. Falls das
   neue Mounten im Test oder im Browser stört (Fokus, Flackern), stattdessen
   einen Ref auf `.entry-route-chips-row` und `scrollLeft = 0` in einem Effekt
   auf den Zähler. Dateien: `src/journal/EntryForm.tsx`, ggf.
   `src/journal/EntryRouteFields.tsx`. Beweis: Tests aus 1 grün.
3. **Red: Meldung im Formular (AC-3 bis AC-6).** Die bestehenden Fehler-Tests
   umschreiben und ergänzen:
   - In `JournalPanel.test.tsx`: Wirft `onAdd`, steht genau ein `alert`, und
     zwar in `.journal-new-entry`. Im DOM liegt es nach dem Textfeld und vor
     „Eintrag hinzufügen“ (`compareDocumentPosition`). Es zeigt „Speichern
     fehlgeschlagen. Bitte erneut versuchen.“. Liefert `onAdd`
     `{ error: "…" }`, steht dieser Text dort.
   - Nach dem nächsten erfolgreichen Speichern ist kein `alert` mehr da. Nach
     einem Klick auf das „×“ der Meldung ebenso.
   - Der letzte `scrollIntoView`-Aufruf nach dem Fehler gilt
     `.journal-new-entry` mit `{ block: "end" }` (Spy wie in „scrolling to the
     latest entry“).
   - In `JournalPanel.correct.test.tsx`: Wirft `onCorrect`, steht das `alert`
     im korrigierten Eintrag (`[data-entry]`), zwischen dessen Textfeld und
     „Speichern“, und nicht in „Neuer Eintrag“. Text, Von, An und Weg der
     Korrektur bleiben. Nach „Abbrechen“ und erneutem „Korrigieren“ ist die
     Meldung weg.
   - Ein Fehler in „Neuer Eintrag“ erscheint nicht in einer offenen Korrektur
     und umgekehrt.
   - Der bestehende Test „keeps Neuer Eintrag and its button outside the
     scrolling list“ bleibt und pinnt AC-6 zusammen mit der Lage im Formular.
   Beweis: Die neuen Erwartungen sind rot.
4. **Fehlerzustände trennen.** In `JournalPanel` `error` durch
   `newEntryError` und `correctionError` ersetzen. Das obere `Alert` fällt weg.
   `correctionError` wird beim Öffnen einer Korrektur und bei „Abbrechen“
   geleert. `EntryForm` bekommt `error: string | null` und `onDismissError`
   und zeigt den `Alert` (`color="red"`, `role="alert"`, `withCloseButton`)
   zwischen `Textarea` und Knopfzeile. Dateien: `JournalPanel.tsx`,
   `src/journal/EntryForm.tsx`. Beweis: Tests aus 3 bis auf das Scrollen grün,
   die übrigen JournalPanel-Tests grün.
5. **Nach einem Fehler ins Bild scrollen.** Ein Effekt in `JournalPanel` auf
   `newEntryError`: Ist er gesetzt, `scroll.newEntryRef.current
   ?.scrollIntoView({ block: "end" })`. Er läuft nach dem Rendern, das
   `Alert` ist also schon da. Beweis: Scroll-Test aus 3 grün.
6. **Im Browser prüfen** (Skill `run-einsatz`, 360 px und Desktop): Chips
   wischen, speichern, die Zeilen stehen vorne. Einen Speicherfehler erzeugen
   (z. B. Dev-Server im Netzwerk-Tab offline): Meldung und „Eintrag
   hinzufügen“ sind ohne Scrollen ganz zu sehen. Dasselbe für eine Korrektur.
   Am Desktop steht das Formular fest unter der Liste. Was nur so geprüft
   wurde (AC-1 Sichtbarkeit, AC-3 „ohne Scrollen“, AC-6 Layout), kommt unter
   `## Left standing`.
7. `npm run check` grün.

Entschieden: Der Rücksprung kommt über einen neuen `key` (Schritt 2). Das
lässt sich leicht ändern und betrifft keine andere Stelle.

## Not here
- Fokus in Rückfragen, auch beim Annullieren im ETB: Ticket
  `02-fokus-in-rueckfragen`.
- Die Gestaltung des Freitext-Wegs (das „×“ im Feld, die Breite, umbrechende
  Knöpfe in der Korrektur) ist out of scope.
- Andere Fehlertexte sind out of scope. `SAVE_ERROR` und die
  zurückgegebenen Meldungen bleiben wörtlich.
- `ConfirmationModal` und seine Fehleranzeige nicht anfassen.

## Left standing
