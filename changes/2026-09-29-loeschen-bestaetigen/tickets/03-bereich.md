---
criteria:  CRITERIA.md
closes:    AC-6
advances:  AC-1, AC-2, AC-3, AC-4, AC-5, AC-10
after:     01-bestaetigungs-modal, 02-kartenzeichen-und-geraetelink
status:    done
attempts:  1
---

## Build
Im Bereich-Dialog fragt „Löschen“ über das `ConfirmationModal` nach, das über dem Bereich-Dialog liegt. Nach Erfolg schließen sich Rückfrage und Bereich-Dialog; nach Abbrechen ist der Bereich-Dialog unverändert da.

## Done when
> **AC-6** Bricht man die Rückfrage zum Löschen eines Kartenzeichens, zum Löschen eines Bereichs oder zu „Gerätelink neu generieren“ ab – mit „Abbrechen“, Escape oder einem Klick neben die Rückfrage –, schließt sich nur die Rückfrage, und man ist wieder im darunterliegenden Dialog. Dort ist alles wie vorher, auch noch nicht gespeicherte Eingaben.

- AC-1, für Bereich löschen: `onDeleteArea` wird erst nach „Endgültig löschen“ gerufen; „Abbrechen“, Escape und ein Klick neben die Rückfrage rufen es nicht.
- AC-2, für diese Rückfrage: Titel, Text und Knopf wie in der Tabelle, Bestätigungsknopf rot.
- AC-3, für diese Rückfrage: Während die Action läuft, ist der Bestätigungsknopf im Ladezustand und „Abbrechen“ gesperrt; weder Escape noch ein Klick neben die Rückfrage schließt die Rückfrage oder den Bereich-Dialog; ein zweiter Tap ruft `onDeleteArea` nicht noch einmal.
- AC-4, für diese Rückfrage: Ein zurückgegebener `{error}` und eine geworfene Ausnahme stehen in der offenen Rückfrage (nicht im Bereich-Dialog darunter), der Bereich-Dialog ist noch offen, erneutes Bestätigen und Abbrechen gehen.
- AC-5, für Bereich löschen: Nach Erfolg schließen sich Rückfrage und Bereich-Dialog.
- AC-10, für diese Rückfrage: bei 390×844 und 1280×800 vollständig sichtbar, beide Knöpfe erreichbar, kein horizontales Scrollen.

## Toward
> **AC-1** Keine dieser sechs Aktionen hat eine Wirkung, bevor sie in einem Dialog bestätigt wurde: Kartenzeichen löschen, Bereich löschen, Bild-Overlay löschen, KML-Overlay entfernen, Ansichtslink löschen, Gerätelink neu generieren. „Abbrechen“, Escape und ein Klick neben den Dialog lassen alles unverändert.

> **AC-2** Alle zwölf Rückfragen sind gleich aufgebaut: die sechs aus AC-1 und dazu Einsatz löschen, Konto löschen, ETB-Eintrag annullieren, Stärkemeldung annullieren, Gesamtstärke melden, Standard-Ausschnitt festlegen. Der Titel nennt die Aktion, der Text die Folge, rechts unten stehen „Abbrechen“ und ein Bestätigungsknopf, der das Verb der Aktion trägt. Der Bestätigungsknopf ist rot, nur bei „Gesamtstärke melden“ und „Standard-Ausschnitt festlegen“ nicht. Titel, Texte und Knöpfe der sechs neuen Rückfragen und der Rückfrage „Standard-Ausschnitt festlegen“ stehen unter „Agreed design“.

> **AC-3** Während eine bestätigte Aktion läuft, zeigt der Bestätigungsknopf einen Ladezustand, „Abbrechen“ ist gesperrt, der Dialog lässt sich nicht schließen, und ein weiterer Tap auf den Bestätigungsknopf löst die Aktion nicht ein zweites Mal aus.

> **AC-4** Scheitert eine bestätigte Aktion, bleibt der Dialog offen und zeigt die Fehlermeldung im Dialog. Das gilt auch für einen unerwarteten Abbruch, dann mit der Meldung „Das hat nicht geklappt. Bitte erneut versuchen.“ Das Objekt ist unverändert, und man kann erneut bestätigen oder abbrechen.

> **AC-5** Nach Erfolg schließt sich die Rückfrage. Beim Löschen von Kartenzeichen und Bereich schließt sich auch deren Dialog, beim Löschen eines Bild-Overlays endet dessen Bearbeiten-Modus. Nach „Gerätelink neu generieren“ bleibt der Kartenzeichen-Dialog offen und zeigt den neuen Link samt QR-Code. Nach „Einsatz löschen“ landet man wie bisher in der Einsatzübersicht.

> **AC-10** Bei 390×844 und bei 1280×800 ist jede Rückfrage vollständig sichtbar, und beide Knöpfe sind erreichbar. Ein Name aus 80 Zeichen ohne Leerzeichen, etwa beim KML-Overlay oder beim Ansichtslink, wird im Titel umgebrochen. Er wird nicht abgeschnitten, und die Seite scrollt nicht horizontal.

## Nudges
> Das `ConfirmationModal` aus `src/strength/StrengthPanel.tsx` kommt in eine eigene Datei, und alle zwölf Rückfragen nutzen es. Die von Hand gebauten Rückfragen in `JournalPanel`, `MapControls`, `UserAdminPanel` und `OperationLifecycleActions` entfallen.

> Die Lösch-Callbacks liefern ihr `ActionResult` direkt an die Rückfrage. Die Fehler- und Ladezustands-Behandlung fürs Löschen wandert aus `runDetail`, `runArea` und `deleteImage` in `SituationWorkspace` in die Rückfrage.

## Context
Voraussetzung: Ticket 01 hat `ConfirmationModal` nach `src/app/ConfirmationModal.tsx` verschoben; Ticket 02 hat ihm eine optionale `stackId` gegeben und den Kartenzeichen-Dialog samt Rückfragen in Mantines `<Modal.Stack>` gesetzt. Grund (geprüft, Mantine 9.4.1): Jedes offene `Modal` hört auf Escape per `window`-Listener, ohne Stapel schließt Escape Rückfrage **und** Dialog darunter, auch während die Action läuft. Im Stapel reagiert nur das oberste Modal auf Escape; der Dialog darunter ist ausgeblendet (`opacity: 0`), bleibt gemountet und erscheint nach dem Abbrechen unverändert – so mit dem Nutzer entschieden. Dasselbe Muster hier.

Heute:
- `src/map/AreaEditor.tsx`: „Löschen“ ruft `onDelete()` sofort (`onDelete: () => void | Promise<void>`). Der Editor hält die Eingaben (Farbe, Deckkraft, Radius, Beschriftung) in eigenem State – solange er gemountet bleibt, bleiben sie erhalten. `busy` und `error` kommen von außen.
- `src/map/SituationWorkspace.tsx`: das `Modal` mit `title="Bereich"` (Zeile ~942) rendert `AreaEditor` mit `onDelete={() => runArea(() => onDeleteArea(selectedArea.id))}`. `runArea` (Zeile ~467) setzt `areaBusy`/`areaError` und schließt bei Erfolg (`setSelectedAreaId(null)`); es bleibt für „Speichern“.
- `onDeleteArea` liefert schon `Promise<ActionResult>` (`deleteAreaAction`).

Text aus der Tabelle unter „Agreed design“:

| Aktion | Titel | Text | Bestätigungsknopf |
|---|---|---|---|
| Bereich löschen | Bereich löschen | Der Bereich verschwindet von der Lagekarte. Das lässt sich nicht rückgängig machen. | Endgültig löschen |

Tests: `src/map/AreaEditor.test.tsx` („deletes the area“, Zeile ~153) und die Bereich-Tests in `src/map/SituationWorkspace.test.tsx`.

## Plan
1. **AC-6 für den Bereich, rot.** In `SituationWorkspace.test.tsx`: Bereich-Dialog öffnen, Beschriftung ändern (nicht speichern), „Löschen“ → Rückfrage mit Titel und Text aus der Tabelle, `onDeleteArea` nicht gerufen. Je ein Test für „Abbrechen“, Escape und Klick aufs Overlay der Rückfrage: `onDeleteArea` nicht gerufen, Bereich-Dialog danach offen, geänderte Beschriftung noch im Feld. Rot, weil „Löschen“ heute sofort löscht.
2. **Rückfrage im `AreaEditor`.** `onDelete: () => Promise<ActionResult>`; „Löschen“ öffnet ein `ConfirmationModal` (`stackId="bereich-loeschen"`, `confirmLabel="Endgültig löschen"`, `confirmColor="red"`, `onConfirm={onDelete}`). Test „deletes the area“ in `AreaEditor.test.tsx` erst auf den Weg über die Rückfrage umschreiben (rot), dann bauen. Weitere Tests dort: `{error}` und Ausnahme stehen in der Rückfrage; während `onDelete` hängt, sind „Abbrechen“ gesperrt und ein zweiter Klick wirkungslos. Der Knopf bleibt an seiner Stelle und in seinem Aussehen.
3. **Verdrahten und stapeln.** In `SituationWorkspace.tsx` den Bereich-Dialog in ein `<Modal.Stack>` setzen, `stackId="bereich"`. `onDelete` ruft `onDeleteArea(selectedArea.id)`, schließt bei Erfolg den Bereich-Dialog (`setSelectedAreaId(null)`, `setAreaError(null)`) und gibt das `ActionResult` zurück. Der Lösch-Weg über `runArea` entfällt. Tests: nach „Endgültig löschen“ sind Rückfrage und Bereich-Dialog zu; bei `{error}` steht der Fehler in der Rückfrage und nicht im `AreaEditor`; während `onDeleteArea` hängt, schließen Escape und Overlay-Klick weder Rückfrage noch Bereich-Dialog. Beweis: Tests aus Schritt 1 und 3 grün.
4. **AC-6 als Ganzes.** Die Tests aus Ticket 02 (Kartenzeichen, Gerätelink) und Schritt 1 zusammen belegen AC-6; im Record alle nennen.
5. **Im Browser prüfen (AC-6, AC-10).** Mit `run-einsatz` bei 390×844 und 1280×800: Bereich öffnen, Beschriftung ändern, Löschen → Escape → Bereich-Dialog zurück, Beschriftung noch da; dasselbe mit Klick neben die Rückfrage; Löschen → Endgültig löschen → beide Dialoge weg. Screenshots; `scrollWidth <= innerWidth`.
6. `npm run check` grün.

## Not here
- Kartenzeichen und Gerätelink: Ticket 02. Bild- und KML-Overlay: Ticket 04. Ansichtslink: Ticket 05. Konto: Ticket 06. Einsatz: Ticket 07.
- „Speichern“, „Form neu zeichnen“ und „Verschieben“ im Bereich-Dialog: bleiben ohne Rückfrage und laufen weiter über `runArea`.
- Lage und Auffälligkeit der Lösch-Knöpfe: Sie bleiben, wo und wie sie sind.
- Verhalten, wenn das Objekt anderswo gelöscht wird, während seine Rückfrage offen ist. Es wird nicht eigens gebaut oder getestet.

## Record
Schließt:
- **AC-6**: für den Bereich `src/map/SituationWorkspace.test.tsx`, Block „confirming in the Bereich editor“, „keeps the editor and its unsaved input after cancelling with Abbrechen / Escape / a click beside the confirmation“ (`onDeleteArea` nicht gerufen, Bereich-Dialog offen, geänderte „Beschriftung“ noch da). Für Kartenzeichen und Gerätelink aus Ticket 02: Block „confirming in the Kartenzeichen detail“, je Rückfrage „keeps the detail and its unsaved input after cancelling with Abbrechen / Escape / a click beside the confirmation“, sowie `src/map/DeviceLinkPanel.test.tsx` „does not regenerate when cancelled / on Escape / on a click beside the confirmation“. Zusammen decken sie alle drei Rückfragen und alle drei Wege ab.

Bringt voran (für Bereich löschen):
- **AC-1**: die drei Abbrechen-Tests oben; „deletes the Bereich only once confirmed and closes both dialogs“; `AreaEditor.test.tsx` „deleting › deletes the area only once confirmed“; „lists Bereiche and opens the area editor via the row edit button“ geht jetzt über „Endgültig löschen“.
- **AC-2**: „deletes the Bereich only once confirmed …“ (Titel, Text, „Endgültig löschen“ rot).
- **AC-3**: „keeps both dialogs open on Escape or a click beside while deleting“ (Workspace, `onDeleteArea` einmal gerufen); `AreaEditor.test.tsx` „deleting › stays locked while deleting“ („Abbrechen“ gesperrt, zweiter Klick ruft nicht erneut). Ladezustand des Bestätigungsknopfs kommt aus `ConfirmationModal` (Ticket 01).
- **AC-4**: „shows a returned error / a thrown failure in the open confirmation, not in the editor“ (einziger Alert auf der Seite steht in der Rückfrage, Bereich-Dialog offen, beide Knöpfe aktiv); `AreaEditor.test.tsx` „deleting › shows a returned error / a thrown failure in the confirmation“.
- **AC-5**: „deletes the Bereich only once confirmed and closes both dialogs“.
- **AC-10**: im Browser mit `run-einsatz` (Subagent) bei 390×844 (Touch) und 1280×800 geprüft: Rückfrage vollständig sichtbar, beide Knöpfe oberstes Element an ihrer Stelle, `scrollWidth == innerWidth`; Escape, Overlay-Klick und „Abbrechen“ schließen nur die Rückfrage, geänderte Beschriftung bleibt; „Endgültig löschen“ schließt beide Dialoge, Bereich weg von Karte und Liste; keine Konsolenfehler.

Kommando: `docker compose -f docker-compose.test.yml up -d && npm run check` – 117 Dateien, 1146 Tests grün, tsc und Biome ohne Befund.

### Left standing
- Abweichung vom Plan, Schritt 3: Der Test „Fehler steht in der Rückfrage und nicht im `AreaEditor`“ prüft, dass auf der Seite genau ein Alert steht und er in der Rückfrage liegt. Unter `MantineProvider env="test"` gibt es keine Portale, die Rückfrage hängt im DOM also im Bereich-Dialog; `within(editor)` hätte ihren Alert mitgezählt.
- Abweichung vom Plan, Schritt 3: Das Schließen des Bereich-Dialogs steht jetzt in `closeArea()`, das `onClose`, `runArea` und `deleteArea` gemeinsam nutzen, statt `setSelectedAreaId(null); setAreaError(null)` dreimal zu wiederholen.
- Die Rückfrage-Helfer `clickConfirmationOverlay`, `hanging` und `cancelWays` in `SituationWorkspace.test.tsx` stehen jetzt eine Ebene höher, damit Kartenzeichen- und Bereich-Block sie teilen.
- Anders als bei Kartenzeichen (Ticket 02) braucht die Bereich-Rückfrage keine gemerkte id: Sie lebt im `AreaEditor`, der mit `key={selectedArea.id}` je Bereich neu gemountet wird.
- Review (eine Runde, keine Blocker, kein Should-fix): Nit „Kommentar zur Fehler-Politik nennt Bereich löschen nicht“ behoben.
- Nicht behoben, Browser-Check: Beim Öffnen der Rückfrage liegt der Fokus auf ihrem Schließen-X statt auf „Abbrechen“; nach dem Abbrechen auf dem X des Bereich-Dialogs statt auf „Löschen“ – Enter schließt dann den Bereich-Dialog und verwirft ungespeicherte Eingaben ohne Nachfrage. Mantine-Standard, gleich wie bei Kartenzeichen (Ticket 02); betrifft alle Rückfragen und gehört nicht in dieses Ticket.
- Nicht geändert, Browser-Check: „Endgültig löschen“ ist Mantines `red` (`#fa5252`), heller als das DRK-Rot. So verlangt es die Rückfrage-Konvention aus Ticket 01 (Rot für Zerstörerisches, DRK-Rot ist Primärfarbe).
- Nicht gemacht: `SituationWorkspace.tsx` bzw. seine Test-Datei vor dem Ändern aufteilen (wie in Ticket 02 begründet; eigener Umbau, `REFACTORING.md` Punkt 10).
- Browserprüfung und Review liefen gleichzeitig und teilten anfangs einen Playwright-Treiber auf Port 9223; beide haben danach eigene Treiber benutzt, ihre Ergebnisse stammen aus den eigenen Sitzungen. In der Dev-Datenbank wurden die Einsätze „QA-Bereich“ und „Critique-Bereich“ angelegt und wieder gelöscht; keine Migration, kein Seed.
