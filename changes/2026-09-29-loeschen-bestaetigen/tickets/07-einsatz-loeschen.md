---
criteria:  CRITERIA.md
closes:    AC-2, AC-3, AC-4, AC-5, AC-9, AC-10
advances:
after:     01-bestaetigungs-modal, 02-kartenzeichen-und-geraetelink, 03-bereich, 04-ebenen-overlays, 05-ansichtslink, 06-konto-loeschen
status:    ready
attempts:  0
---

## Build
„Einsatz löschen“ läuft über das `ConfirmationModal`: Ladezustand, Fehler in der Rückfrage, auch bei einem unerwarteten Abbruch, und nach Erfolg wie bisher die Weiterleitung in die Einsatzübersicht, ohne dass die Rückfrage sie als Fehler zeigt. Damit nutzen alle zwölf Rückfragen dasselbe Modal, und Punkt 1 verschwindet aus `REFACTORING.md`.

## Done when
> **AC-2** Alle zwölf Rückfragen sind gleich aufgebaut: die sechs aus AC-1 und dazu Einsatz löschen, Konto löschen, ETB-Eintrag annullieren, Stärkemeldung annullieren, Gesamtstärke melden, Standard-Ausschnitt festlegen. Der Titel nennt die Aktion, der Text die Folge, rechts unten stehen „Abbrechen“ und ein Bestätigungsknopf, der das Verb der Aktion trägt. Der Bestätigungsknopf ist rot, nur bei „Gesamtstärke melden“ und „Standard-Ausschnitt festlegen“ nicht. Titel, Texte und Knöpfe der sechs neuen Rückfragen und der Rückfrage „Standard-Ausschnitt festlegen“ stehen unter „Agreed design“.

> **AC-3** Während eine bestätigte Aktion läuft, zeigt der Bestätigungsknopf einen Ladezustand, „Abbrechen“ ist gesperrt, der Dialog lässt sich nicht schließen, und ein weiterer Tap auf den Bestätigungsknopf löst die Aktion nicht ein zweites Mal aus.

> **AC-4** Scheitert eine bestätigte Aktion, bleibt der Dialog offen und zeigt die Fehlermeldung im Dialog. Das gilt auch für einen unerwarteten Abbruch, dann mit der Meldung „Das hat nicht geklappt. Bitte erneut versuchen.“ Das Objekt ist unverändert, und man kann erneut bestätigen oder abbrechen.

> **AC-5** Nach Erfolg schließt sich die Rückfrage. Beim Löschen von Kartenzeichen und Bereich schließt sich auch deren Dialog, beim Löschen eines Bild-Overlays endet dessen Bearbeiten-Modus. Nach „Gerätelink neu generieren“ bleibt der Kartenzeichen-Dialog offen und zeigt den neuen Link samt QR-Code. Nach „Einsatz löschen“ landet man wie bisher in der Einsatzübersicht.

> **AC-9** Scheitert „Einsatz löschen“ oder „Konto löschen“, steht die Fehlermeldung im Dialog. Die Seite bricht nicht ab, und es erscheint keine Meldung oberhalb der Kontenliste.

> **AC-10** Bei 390×844 und bei 1280×800 ist jede Rückfrage vollständig sichtbar, und beide Knöpfe sind erreichbar. Ein Name aus 80 Zeichen ohne Leerzeichen, etwa beim KML-Overlay oder beim Ansichtslink, wird im Titel umgebrochen. Er wird nicht abgeschnitten, und die Seite scrollt nicht horizontal.

## Nudges
> Das `ConfirmationModal` aus `src/strength/StrengthPanel.tsx` kommt in eine eigene Datei, und alle zwölf Rückfragen nutzen es. Die von Hand gebauten Rückfragen in `JournalPanel`, `MapControls`, `UserAdminPanel` und `OperationLifecycleActions` entfallen.

> `deleteOperationAction` liefert im Fehlerfall ein `ActionResult`. Das `catch` der Rückfrage darf die Weiterleitung nach Erfolg nicht verschlucken.

> Punkt 1 wird aus `REFACTORING.md` entfernt. Punkt 4 wird auf `createViewLinkAction` gekürzt.

## Context
Voraussetzung: Tickets 01–06 sind gebaut. Elf der zwölf Rückfragen laufen über `src/app/ConfirmationModal.tsx` (Stärkemeldung annullieren, Gesamtstärke melden, ETB-Eintrag annullieren, Standard-Ausschnitt festlegen, Kartenzeichen löschen, Gerätelink neu generieren, Bereich löschen, Bild-Overlay löschen, KML-Overlay entfernen, Ansichtslink löschen, Konto löschen), jede mit eigenen Tests und einer Browser-Prüfung bei 390×844 und 1280×800 im Record ihres Tickets. Dieses Ticket baut die letzte und schließt AC-2, AC-3, AC-4, AC-5, AC-9 und AC-10: Im Record die Tests aus 01–06 zu diesen ACs zusammen mit den eigenen nennen.

Heute:
- `src/app/operations/[id]/OperationLifecycleActions.tsx`: eigenes `Modal` „Einsatz löschen“, Text „Dieser Einsatz wird mit seinem gesamten <strong>Einsatztagebuch</strong> und allen Kartenobjekten unwiderruflich gelöscht.“ (Titel und Text bleiben), „Endgültig löschen“ rot → `onDelete()`, kein Ladezustand, kein Fehler. `onDelete: () => void | Promise<void>`. Gerendert je Karte in `src/app/operations/OperationsOverview.tsx` (`onDeleteOperation?: (operationId: string) => void | Promise<void>`, Default `noop`), verdrahtet in `src/app/operations/page.tsx` mit `deleteOperationAction`. Die Rückfrage liegt über keinem anderen Dialog (das Menü schließt sich beim Klick), braucht also kein `Modal.Stack`.
- `src/app/operations/[id]/lifecycle-actions.ts`: `deleteOperationAction(operationId): Promise<void>` ruft `requireUser`, `deleteOperation`, `publishOperationChanged`, dann `redirect("/operations")`. Eine `ValidationError` wirft `deleteOperation` nicht; scheitern kann es nur unerwartet (DB, Datei-IO).
- **Weiterleitung auf dem Client:** Der Client lehnt das Promise einer Server-Action, die `redirect` ruft, mit einem Redirect-Fehler ab, nachdem der Router die Navigation schon angestoßen hat (`node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js`, Kommentar „the action promise will be rejected with a redirect“). Ohne Sonderfall macht der `catch` im `ConfirmationModal` daraus „Das hat nicht geklappt. Bitte erneut versuchen.“ und setzt `pending` zurück – dann wäre die Rückfrage bis zur Ankunft der Navigation wieder bedienbar, ein zweiter Tap löste `deleteOperationAction` erneut aus (AC-3). Entschieden: Das Modal erkennt einen Redirect-Fehler mit öffentlicher API (`unstable_rethrow` aus `next/navigation` in einem inneren `try`: wirft es, war es ein Redirect), zeigt keinen Fehler und lässt `pending` gesetzt, bis die Navigation die Seite ersetzt. Weiterwerfen scheidet aus: aus einem async Klick-Handler wird das eine unbehandelte Ablehnung, an der Vitest scheitert.
- **Next-Version:** Installiert ist 16.2.10, `package.json` und Lockfile verlangen 16.3.6. Vor dem Build `npm ci` laufen lassen und die Stelle im `server-action-reducer.js` noch einmal ansehen.
- Tests: `OperationLifecycleActions.test.tsx` („requires explicit confirmation before deleting …“, „does not delete when the confirmation is cancelled“), `OperationsOverview.test.tsx` („deletes an Einsatz from its per-card menu after confirmation“).
- `REFACTORING.md` Punkt 1 „Löschen einheitlich bestätigen“.

## Plan
1. **AC-9 für Einsatz, rot.** In `OperationLifecycleActions.test.tsx`: `onDelete` wirft → „Das hat nicht geklappt. Bitte erneut versuchen.“ im noch offenen Dialog; `onDelete` liefert `{ error: "…" }` → die Meldung im Dialog; danach ruft erneutes Bestätigen `onDelete` noch einmal. Rot.
2. **Einsatz löschen bauen.** `OperationLifecycleActions`: `onDelete: () => Promise<ActionResult>`, eigenes Modal durch `ConfirmationModal` ersetzen (Titel und Text wie heute, `confirmLabel="Endgültig löschen"`, `confirmColor="red"`). `OperationsOverview.onDeleteOperation` bekommt denselben Rückgabetyp, `noop` liefert `{}`. Weitere Tests: Ladezustand, gesperrtes „Abbrechen“, Escape und Overlay-Klick während der Action wirkungslos, doppelter Tap ruft einmal. Beweis: grün; `OperationsOverview.test.tsx` grün.
3. **`deleteOperationAction` liefert `ActionResult` – nur im Typ.** Rückgabetyp `Promise<ActionResult>`; der Rumpf bleibt, wie er ist, und endet weiter in `redirect("/operations")` (`never`), kein `try`. Scheitert `deleteOperation`, fliegt der Fehler weiter, Next protokolliert ihn serverseitig, und der `catch` des `ConfirmationModal` zeigt „Das hat nicht geklappt. Bitte erneut versuchen.“ in der Rückfrage – belegt durch die Tests aus Schritt 1 und aus Ticket 01. Kein neuer Server-Test. So mit dem Nutzer entschieden: Ein eigener Catch-all mit `toFormError` gäbe dieselbe Meldung ein zweites Mal aus. Unter `### Left standing` festhalten, dass der erste Satz des Nudges damit nur im Typ befolgt ist. Beweis: `tsc` grün.
4. **Weiterleitung nicht verschlucken.** Test in `src/app/ConfirmationModal.test.tsx`: `onConfirm` lehnt mit einem echten Redirect-Fehler ab (erzeugt über `redirect` aus `next/navigation` in einem `try`, dessen Fehler man auffängt) → keine Fehlermeldung im Dialog, der Bestätigungsknopf bleibt im Ladezustand, ein zweiter Klick ruft `onConfirm` nicht, kein Konsolen-Fehler (`src/test/fail-on-console.ts`). Rot, dann den Sonderfall im `catch` des Modals wie im Kontext entschieden. Beweis: grün.
5. **AC-5 im Browser.** Mit `run-einsatz`: einen Einsatz anlegen, in der Übersicht löschen → Ladezustand, dann Einsatzübersicht ohne den Einsatz, kein Fehler aufgeblitzt. Screenshot.
6. **AC-10 im Browser.** Mit `run-einsatz` bei 390×844 und 1280×800 „Einsatz löschen“ öffnen: vollständig sichtbar, beide Knöpfe erreichbar, `scrollWidth <= innerWidth`. Screenshots. Zusammen mit den Browser-Prüfungen aus 01–06 sind damit alle zwölf geprüft.
7. **Keine handgebaute Rückfrage mehr.** `grep -rn "<Modal" src` zeigt keine Bestätigungs-Rückfrage außerhalb von `ConfirmationModal`. Beweis: Ausgabe im Record.
8. **`REFACTORING.md`:** Punkt 1 entfernen; die übrigen Punkte behalten ihre Nummern, weil Commits und Tickets sie mit Nummer nennen. Beweis: Lesen.
9. `npm run check` grün.

## Not here
- Die anderen elf Rückfragen: Tickets 01–06; hier nur ihre Tests im Record nennen, nicht neu bauen.
- Einsatz abschließen und wieder öffnen: bleiben ohne Rückfrage.
- Lage und Auffälligkeit der Lösch-Knöpfe: Sie bleiben, wo und wie sie sind.
