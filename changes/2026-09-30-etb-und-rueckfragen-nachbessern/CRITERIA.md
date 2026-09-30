# Criteria: ETB und Rückfragen nachbessern

## Problem

Beim Erfassen und Korrigieren im ETB und in Rückfragen verliert man am Handy
oder per Tastatur Dinge aus dem Blick, ohne es zu merken:

- Nach dem Speichern bleiben die Chip-Zeilen „Von“ und „An“ waagerecht
  verschoben. Der gerade benutzte Gesprächspartner steht zwar vorne, ist aber
  nicht zu sehen. Wer ihn gleich wieder braucht, muss erst zurückwischen.
- Scheitert das Speichern eines neuen Eintrags oder einer Korrektur, erscheint
  die Meldung ganz oben im ETB. Am Handy liegt sie weit außerhalb des
  sichtbaren Bereichs. Man sieht nur, dass der Eintrag nicht verschwindet, und
  weiß nicht, dass man erneut speichern muss.
- Schließt man eine Rückfrage, die über einem Dialog liegt (Kartenzeichen
  löschen, Gerätelink neu generieren, Bereich löschen, Ansichtslink löschen),
  liegt der Tastaturfokus auf dem Schließen-X des Dialogs darunter. Ein Enter
  schließt dann diesen Dialog, und nicht gespeicherte Eingaben gehen ohne
  Nachfrage verloren.

Stattdessen sieht man nach jedem Speichern, was man als Nächstes braucht, und
bemerkt ein Scheitern dort, wo man gerade arbeitet. Nach einer Rückfrage ist
alles wie vorher, auch der Fokus.

Aufgefallen bei der Abnahme von „Von, An und Weg im ETB“ und „Unwiderrufliche
Aktionen einheitlich bestätigen“ am 2026-09-30: „Von“ stand nach dem Speichern
697 px verschoben, die Fehlermeldung lag am Handy (360 px) 1092 px über dem
sichtbaren Bereich, und nach „Neu generieren“ stand der Fokusring auf dem X.
Einen Vorfall im Einsatz gab es nicht.

## Acceptance criteria

- **AC-1** Nach dem erfolgreichen Speichern eines neuen ETB-Eintrags stehen die Chip-Zeilen „Von“ und „An“ am Anfang: Der erste Chip jeder Zeile ist vollständig zu sehen, auch wenn die Zeile vorher waagerecht verschoben war (360 px).
- **AC-2** Scheitert das Speichern eines neuen Eintrags, bleiben Text, Von, An und Weg erhalten, und die Chip-Zeilen bleiben so verschoben, wie sie waren.
- **AC-3** Scheitert das Speichern eines neuen Eintrags, erscheint die zurückgegebene Fehlermeldung bzw. „Speichern fehlgeschlagen. Bitte erneut versuchen.“ im Formular „Neuer Eintrag“ zwischen Textfeld und der Zeile mit Weg und „Eintrag hinzufügen“. Am Handy (360 px) sind die Meldung und „Eintrag hinzufügen“ danach vollständig zu sehen, ohne dass man scrollt.
- **AC-4** Scheitert das Speichern einer Korrektur, erscheint die Meldung an derselben Stelle im Formular dieser Korrektur, innerhalb des korrigierten Eintrags; Text, Von, An und Weg der Korrektur bleiben erhalten.
- **AC-5** Oben im ETB erscheint keine Meldung zum Speichern mehr. Eine Meldung steht nur im Formular, dessen Speichern scheiterte; sie verschwindet nach dem nächsten erfolgreichen Speichern dieses Formulars, über ihr „×“ und bei einer Korrektur mit „Abbrechen“.
- **AC-6** Am Desktop steht „Neuer Eintrag“ weiter fest unter der scrollenden Liste, die Meldung darin an derselben Stelle wie am Handy.
- **AC-7** Beim Öffnen jeder Rückfrage liegt der Tastaturfokus auf „Abbrechen“.
- **AC-8** Schließt man eine Rückfrage über einem Dialog mit „Abbrechen“, „×“ oder Escape, liegt der Fokus wieder auf dem Knopf, der sie geöffnet hat: „Löschen“ im Kartenzeichen-Dialog, „Gerätelink neu generieren“, „Löschen“ im Bereich-Dialog, der Löschen-Knopf des Ansichtslinks. Der Dialog darunter bleibt offen, seine Eingaben bleiben erhalten.
- **AC-9** Nach erfolgreichem „Neu generieren“ liegt der Fokus auf „Gerätelink neu generieren“.
- **AC-10** Nach erfolgreichem Löschen eines Ansichtslinks liegt der Fokus im Dialog „Ansichtslinks teilen“, und Enter schließt ihn nicht.
- **AC-11** Escape in einer Rückfrage über einem Dialog schließt nur die Rückfrage.
- **AC-12** Schließt man eine Rückfrage, die nicht über einem Dialog liegt, mit „Abbrechen“, „×“ oder Escape, liegt der Fokus wie heute wieder auf dem Knopf, der sie geöffnet hat (z. B. „Entfernen“ im Ebenen-Panel).

## Agreed design

Die Fehlermeldung ist ein roter `Alert` mit `role="alert"` und „×“ im
`EntryForm`, zwischen Textfeld und der Zeile mit Weg und Knöpfen – für
„Neuer Eintrag“ und für die Korrektur gleich. Specimen:
[Artifact](https://claude.ai/artifact/TJNzixHgczo8srr1g6dqYe), Kopie in
[`specimens/fehlermeldung-im-formular.html`](specimens/fehlermeldung-im-formular.html).

**Agreed; build to this, do not redesign.**

Die Chip-Zeilen springen nach erfolgreichem Speichern ohne Animation an den
Anfang. `ConfirmationModal` merkt sich beim Öffnen das fokussierte Element und
fokussiert es nach dem Schließen wieder; gibt es das Element nicht mehr, den
Dialog darunter, falls es einen gibt. „Abbrechen“ trägt `data-autofocus`.

## Nudges

- `JournalPanel` hält je einen Fehlerzustand für „Neuer Eintrag“ und für die offene Korrektur und gibt ihn an `EntryForm`; `EntryForm` zeigt ihn.
- Den Rücksprung der Chip-Zeilen auslösen, wenn `EntryForm` nach erfolgreichem Speichern leert, nicht über `value === null` in `EntryRouteChips`: Auch Abwählen per Tipp setzt `null`.
- Der Fokus wird allein in `ConfirmationModal` zurückgegeben, erst nachdem der Dialog darunter seine Fokusfalle wieder aktiviert hat (z. B. am Ende der Ausblendung); die Aufrufer bleiben unverändert.
- Ist das gemerkte Element nicht mehr im Dokument, den `role="dialog"`-Container des darunterliegenden Dialogs fokussieren (er hat `tabIndex=-1`); ohne Dialog darunter nichts eigens tun.
- Scheitert das Speichern von „Neuer Eintrag“, den Formularbereich so ins Bild scrollen, wie `scrollToEnd` in `JournalPanel` es mit `newEntryRef` schon tut (`block: "end"`).
- Der Branch `einsatz-actions-vereinheitlichen` löst `isNextNavigation` aus `ConfirmationModal` heraus; das hier nicht vorwegnehmen und bei einem Konflikt dessen Stand übernehmen.

## Out of scope

- Die Gestaltung des Freitext-Wegs.
- Wohin der Fokus geht, wenn der öffnende Knopf nach dem Schließen fehlt und kein Dialog darunter liegt (z. B. nach dem Annullieren eines ETB-Eintrags).
- Wohin der Fokus geht, wenn nach Erfolg auch der Dialog darunter schließt (Kartenzeichen löschen, Bereich löschen).
- Andere Fehlertexte.

## Ruled out

- **Toast am Bildschirmrand** – ein zweites Muster für Fehler; bisher stehen sie dort, wo man arbeitet.
- **Meldung oben im Formular** – bei offener Tastatur am Handy wieder außer Sicht.
- **Meldung oben im ETB lassen und hinscrollen** – reißt einen von der Eingabe weg.
- **Rückfragen aus `Modal.Stack` nehmen** – Escape schlösse beide Dialoge.
- **`data-autofocus` am öffnenden Knopf** – der bekäme den Fokus schon beim Öffnen des Dialogs darunter.
- **Chip-Zeile beim Antippen nicht mitscrollen lassen** – hilft nicht, wenn man selbst gewischt hat.
