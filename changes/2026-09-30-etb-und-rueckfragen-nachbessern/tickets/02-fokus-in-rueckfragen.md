---
criteria:  CRITERIA.md
closes:    AC-7, AC-8, AC-9, AC-10, AC-11, AC-12
advances:
after:
status:    ready
attempts:  0
---

## Build
Nach einer Rückfrage ist der Fokus wieder dort, wo er vorher war, auch wenn
sie über einem anderen Dialog lag. Jede Rückfrage öffnet mit dem Fokus auf
„Abbrechen“.

## Done when
> **AC-7** Beim Öffnen jeder Rückfrage liegt der Tastaturfokus auf „Abbrechen“.

> **AC-8** Schließt man eine Rückfrage über einem Dialog mit „Abbrechen“, „×“ oder Escape, liegt der Fokus wieder auf dem Knopf, der sie geöffnet hat: „Löschen“ im Kartenzeichen-Dialog, „Gerätelink neu generieren“, „Löschen“ im Bereich-Dialog, der Löschen-Knopf des Ansichtslinks. Der Dialog darunter bleibt offen, seine Eingaben bleiben erhalten.

> **AC-9** Nach erfolgreichem „Neu generieren“ liegt der Fokus auf „Gerätelink neu generieren“.

> **AC-10** Nach erfolgreichem Löschen eines Ansichtslinks liegt der Fokus im Dialog „Ansichtslinks teilen“, und Enter schließt ihn nicht.

> **AC-11** Escape in einer Rückfrage über einem Dialog schließt nur die Rückfrage.

> **AC-12** Schließt man eine Rückfrage, die nicht über einem Dialog liegt, mit „Abbrechen“, „×“ oder Escape, liegt der Fokus wie heute wieder auf dem Knopf, der sie geöffnet hat (z. B. „Entfernen“ im Ebenen-Panel).

## Nudges
> Der Fokus wird allein in `ConfirmationModal` zurückgegeben, erst nachdem der Dialog darunter seine Fokusfalle wieder aktiviert hat (z. B. am Ende der Ausblendung); die Aufrufer bleiben unverändert.

> Ist das gemerkte Element nicht mehr im Dokument, den `role="dialog"`-Container des darunterliegenden Dialogs fokussieren (er hat `tabIndex=-1`); ohne Dialog darunter nichts eigens tun.

> Der Branch `einsatz-actions-vereinheitlichen` löst `isNextNavigation` aus `ConfirmationModal` heraus; das hier nicht vorwegnehmen und bei einem Konflikt dessen Stand übernehmen.

## Context
- `src/app/ConfirmationModal.tsx`: ein Mantine-`Modal` mit Fehler-`Alert`,
  Inhalt, „Abbrechen“ und Bestätigungsknopf. Es schließt bei Erfolg selbst
  (`onClose`). `close` ist gesperrt, solange `pending` gilt.
- Ursache: Die Rückfragen über einem Dialog tragen eine `stackId` und liegen
  in einem `Modal.Stack`: `SymbolDetailModal` („kartenzeichen“ mit
  „kartenzeichen-loeschen“ und, über `DeviceLinkPanel`,
  „geraetelink-neu-generieren“), `AreaEditorModal` („bereich“ mit
  „bereich-loeschen“ aus `AreaEditor`) und `LageansichtShell`
  („ansichtslinks-teilen“ mit „ansichtslink-loeschen“ aus `ViewLinkPanel`).
  Mantines `Modal` setzt `trapFocus` nur für das oberste Modal im Stack
  (`node_modules/@mantine/core/esm/components/Modal/Modal.mjs`). Schließt die
  Rückfrage, wird die Fokusfalle des Dialogs darunter wieder aktiv und
  fokussiert dessen erstes Element, das Schließen-X. Mantines eigenes
  `returnFocus` greift im Stack gar nicht: `shouldReturnFocus` ist
  `trapFocus && returnFocus` (`ModalBase/use-modal.mjs`), und sobald die
  Rückfrage nicht mehr oberste ist, wird `trapFocus` falsch; das räumt den
  geplanten Rücksprung in `use-focus-return.mjs` ab. Es gibt also keinen
  Mantine-Aufruf, gegen den man das Zurückgeben timen müsste, nur die
  Fokusfalle darunter (per `setTimeout`). `KmlPanel` ist nicht gestapelt. Dort kehrt der
  Fokus heute richtig zurück, gepinnt in `src/map/KmlPanel.test.tsx` („returns
  focus to the Entfernen button when the first confirmation is cancelled“).
- Mantines `FocusTrap` fokussiert beim Aktivieren zuerst ein Element mit
  `data-autofocus`. Ohne ein solches Element nimmt es das erste fokussierbare,
  also das X.
- Tests rendern mit `MantineProvider env="test"` (`src/test/render.tsx`): ohne
  Transitions und Portale. `useTransition` läuft dort trotzdem, `onExited`
  sollte also nach etwa 200 ms und zwei Frames feuern; der Build prüft das. Der Zeitpunkt des Zurückgebens muss in Test und Browser
  nach dem Aktivieren der Fokusfalle darunter liegen.
- `ConfirmationModal.test.tsx` hat ein Gerüst „on top of another dialog in a
  Modal.Stack“ (`Stacked`, `setupStacked`). Der Test „closes only itself on
  Escape“ pinnt AC-11 schon und muss grün bleiben.
- `ConfirmationModal` nutzen auch Rückfragen ohne Dialog darunter: ETB
  annullieren (`JournalPanel`, geöffnet aus einem `Menu.Item`), KML entfernen,
  `OperationLifecycleActions`, `UserAdminPanel`, `StrengthPanel`,
  `ImageOverlayEditor`, `MapControls`. AC-7 gilt für alle. AC-12 verlangt,
  dass sie den Fokus weiter zurückgeben.

## Plan
1. **Red: Abbrechen bekommt beim Öffnen den Fokus (AC-7).** In
   `ConfirmationModal.test.tsx`: Nach dem Öffnen hat „Abbrechen“ den Fokus,
   allein und im `Stacked`-Gerüst. Beweis: rot.
2. **`data-autofocus` an „Abbrechen“** in `src/app/ConfirmationModal.tsx`.
   Beweis: Test aus 1 grün. Mit `grep` alle Tests der Aufrufer finden, die
   nach dem Öffnen den Fokus auf dem X erwarten, und sie anpassen.
3. **Red: Fokus zurück nach dem Schließen (AC-8 bis AC-10, AC-12).**
   - Im `Stacked`-Gerüst von `ConfirmationModal.test.tsx`: Nach „Abbrechen“,
     „×“ oder Escape hat „Löschen“ den Fokus, und `onCloseBelow` wurde nicht
     gerufen. Eine Variante bestätigt erfolgreich, und der Knopf darunter
     bleibt: Er hat danach den Fokus. Eine zweite Variante entfernt den
     öffnenden Knopf beim Bestätigen: Danach hat der Dialog „Kartenzeichen“
     den Fokus (`role="dialog"`), und Enter ruft `onCloseBelow` nicht.
   - Ohne Stack: nach „Abbrechen“ Fokus auf dem öffnenden Knopf (AC-12).
   - Wo die Nutzerin handelt, je ein Test für AC-8:
     - `src/map/SymbolDetailModal.test.tsx`: Kartenzeichen „Löschen“ →
       „Abbrechen“ → Fokus auf „Löschen“, der Dialog „Kartenzeichen“ ist noch
       offen. „Gerätelink neu generieren“ → Escape → Fokus darauf. Für AC-9:
       erfolgreiches „Neu generieren“ → Fokus auf „Gerätelink neu generieren“.
     - `src/map/AreaEditorModal.test.tsx`: Bereich „Löschen“ → „Abbrechen“ →
       Fokus auf „Löschen“, eine geänderte Beschriftung ist noch im Feld.
     - `src/app/operations/[id]/LageansichtShell.test.tsx`: Den Löschen-Knopf
       eines Ansichtslinks drücken, „Abbrechen“ → Fokus auf diesem Knopf.
       Für AC-10: erfolgreiches Löschen, bei dem der Link aus `viewLinks`
       verschwindet → Fokus im Dialog „Ansichtslinks teilen“, Enter schließt
       ihn nicht.
   - Der KmlPanel-Test bleibt grün (AC-12 am Aufrufer).
   Beweis: Die gestapelten Fälle sind rot, die ungestapelten grün.
4. **Fokus in `ConfirmationModal` zurückgeben.** Wenn `opened` auf `true`
   wechselt, das fokussierte Element merken (`document.activeElement`), noch
   bevor die eigene Fokusfalle es verschiebt, also in einem Layout-Effekt
   oder beim Rendern über den vorherigen `opened`-Wert. Dazu den
   `closest('[role="dialog"]')` dieses Elements merken. Nach dem Schließen,
   zu dem Zeitpunkt aus dem Context: Ist das Element noch im Dokument
   (`isConnected`), es fokussieren. Sonst den gemerkten Dialog, wenn er noch
   im Dokument ist. Sonst nichts tun. Die Aufrufer ändern sich nicht.
   Datei: `src/app/ConfirmationModal.tsx`. Beweis: alle Tests aus 3 grün,
   „closes only itself on Escape“ grün.
5. **Im Browser prüfen** (Skill `run-einsatz`, Tastatur): die vier Rückfragen
   aus AC-8 mit Abbrechen, × und Escape; „Neu generieren“ bestätigen;
   Ansichtslink löschen und dann Enter; KML entfernen abbrechen. Nach jedem
   Schließen den Fokusring prüfen.
6. `npm run check` grün.

## Not here
- Wohin der Fokus geht, wenn nach Erfolg auch der Dialog darunter schließt
  (Kartenzeichen löschen, Bereich löschen), ist out of scope.
- Wohin der Fokus geht, wenn der öffnende Knopf nach dem Schließen fehlt und
  kein Dialog darunter liegt (z. B. nach dem Annullieren eines ETB-Eintrags),
  ist out of scope.
- Die Fehleranzeige im ETB: Ticket `01-etb-nach-dem-speichern`.
- `isNextNavigation` und die Fehlerbehandlung in `ConfirmationModal` nicht
  umbauen, das macht der Branch `einsatz-actions-vereinheitlichen`.
- Andere Fehlertexte sind out of scope.

## Left standing
