---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-4, AC-5, AC-10
after:     01-bestaetigungs-modal
status:    done
attempts:  1
---

## Build
Im Ebenen-Panel fragen „Löschen“ beim Bild-Overlay und „Entfernen“ beim KML-Overlay über das `ConfirmationModal` nach. Nach dem Löschen eines Bild-Overlays endet dessen Bearbeiten-Modus.

## Done when
- AC-1, für Bild-Overlay löschen und KML-Overlay entfernen: `onDeleteImage` bzw. `onRemoveKml` werden erst nach „Endgültig löschen“ bzw. „Entfernen“ in der Rückfrage gerufen; „Abbrechen“, Escape und ein Klick neben die Rückfrage rufen sie nicht.
- AC-2, für diese beiden Rückfragen: Titel, Text und Knopf wie in der Tabelle, Bestätigungsknopf rot; der KML-Titel enthält den Namen des Overlays.
- AC-3, für diese beiden Rückfragen: Während die Action läuft, ist der Bestätigungsknopf im Ladezustand und „Abbrechen“ gesperrt; weder Escape noch ein Klick neben die Rückfrage schließt sie; ein zweiter Tap ruft die Action nicht noch einmal.
- AC-4, für diese beiden Rückfragen: Ein zurückgegebener `{error}` und eine geworfene Ausnahme stehen in der offenen Rückfrage, das Overlay ist noch in der Liste, erneutes Bestätigen und Abbrechen gehen.
- AC-5, für Bild-Overlay löschen: Nach Erfolg schließt sich die Rückfrage und der Bearbeiten-Modus des Bild-Overlays endet.
- AC-10, für diese beiden Rückfragen: bei 390×844 und 1280×800 vollständig sichtbar, beide Knöpfe erreichbar; ein KML-Overlay-Name aus 80 Zeichen ohne Leerzeichen wird im Titel umgebrochen, nicht abgeschnitten, und die Seite scrollt nicht horizontal.

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
Das Ebenen-Panel ist kein Modal; die Rückfragen liegen hier über keinem anderen Dialog und brauchen kein `Modal.Stack`.

Voraussetzung: Ticket 01 hat `ConfirmationModal` nach `src/app/ConfirmationModal.tsx` verschoben (Props `opened`, `onClose`, `title`, `confirmLabel`, `confirmColor?`, `onConfirm: () => Promise<ActionResult>`, `children`). Der Titel bricht dort schon mit `overflowWrap: "anywhere"` um.

Heute:
- `src/map/ImageOverlayEditor.tsx`: „Löschen“ ruft `onDelete()` sofort (`onDelete: () => void | Promise<void>`). `busy` und `error` kommen von außen.
- `src/map/SituationWorkspace.tsx`: `deleteImage` (Zeile ~595) ruft `onDeleteImage(editingImageId)`, setzt `imageBusy`/`imageError` und ruft bei Erfolg `endMode()`; eine geworfene Ausnahme fängt es nicht. `imageBusy`/`imageError` bleiben für `persistImage` (Deckkraft, Datei ersetzen, Platzierung). Der Editor wird über `ImageOverlayPanel`s `renderEditor` gerendert (Zeile ~877).
- `onDeleteImage` liefert `Promise<ActionResult>` (`deleteImageOverlayAction`; revalidiert auch, wenn nur das Datei-Aufräumen scheitert – das bleibt).
- `src/map/KmlPanel.tsx`: „Entfernen“ ruft `run(onRemove(overlay.id))`; `run` zeigt den Fehler als Alert oben im Panel und fängt keine Ausnahme. `run` bleibt für Hinzufügen, Sichtbarkeit und Neu laden. `onRemove` liefert `Promise<ActionResult>` (`removeKmlAction`). Die Zeile hat `overlay.name` als Label des `Switch`.

Texte aus der Tabelle unter „Agreed design“:

| Aktion | Titel | Text | Bestätigungsknopf |
|---|---|---|---|
| Bild-Overlay löschen | Bild-Overlay löschen | Das Bild wird mit seiner Datei gelöscht. Das lässt sich nicht rückgängig machen. | Endgültig löschen |
| KML-Overlay entfernen | KML-Overlay „‹Name›“ entfernen | Um es wieder anzuzeigen, muss die Datei oder URL neu eingebunden werden. | Entfernen |

„‹Name›“ ist `overlay.name`, in deutschen Anführungszeichen „…“.

Tests: `src/map/ImageOverlayEditor.test.tsx` („deletes the overlay“, Zeile ~55), `src/map/KmlPanel.test.tsx` („removes an overlay“, Zeile ~128; „surfaces an action error“, Zeile ~139), Bild-Overlay-Tests in `src/map/SituationWorkspace.test.tsx` ab Zeile ~2981.

## Plan
1. **KML-Overlay entfernen: Test, rot.** In `KmlPanel.test.tsx` „removes an overlay“ umschreiben: „Entfernen“ in der Zeile ruft `onRemove` nicht und öffnet eine Rückfrage mit Titel `KML-Overlay „<Name>“ entfernen` und dem Text aus der Tabelle; erst „Entfernen“ in der Rückfrage ruft `onRemove(id)`, danach ist die Rückfrage zu. Weitere Tests: „Abbrechen“, Escape und ein Klick aufs Overlay der Rückfrage rufen nichts; `{error}` und Ausnahme stehen in der Rückfrage (nicht im Alert oben im Panel), das Overlay ist noch gelistet; während `onRemove` hängt, ist „Abbrechen“ gesperrt, Escape und Overlay-Klick schließen die Rückfrage nicht, ein zweiter Klick ruft nicht erneut.
2. **KML-Overlay entfernen: bauen.** In `KmlPanel.tsx` die Zeilen-Schaltfläche „Entfernen“ öffnet ein `ConfirmationModal` für dieses Overlay (ein Ziel-State `removeTarget` im Panel, eine Rückfrage für alle Zeilen; `confirmLabel="Entfernen"`, `confirmColor="red"`, `onConfirm={() => onRemove(removeTarget.id)}`). Knopf bleibt an seiner Stelle und in seinem Aussehen. Beweis: Tests aus Schritt 1 grün.
3. **Bild-Overlay löschen: Test, rot.** In `ImageOverlayEditor.test.tsx` „deletes the overlay“ umschreiben: „Löschen“ öffnet die Rückfrage mit Titel und Text aus der Tabelle, erst „Endgültig löschen“ ruft `onDelete`. Weitere Tests wie in Schritt 1 (Abbrechen, Escape, Klick aufs Overlay, `{error}`, Ausnahme, hängende Action samt Escape und Overlay-Klick).
4. **Bild-Overlay löschen: bauen.** `ImageOverlayEditor`: `onDelete: () => Promise<ActionResult>`, „Löschen“ öffnet ein `ConfirmationModal`. In `SituationWorkspace.tsx` `deleteImage` so umbauen, dass es `onDeleteImage(editingImageId)` ruft, bei Erfolg `endMode()` ruft und das `ActionResult` zurückgibt; `imageBusy`/`imageError` fürs Löschen entfallen. Test in `SituationWorkspace.test.tsx`: Bild-Overlay bearbeiten, Löschen, Endgültig löschen → `adapter.stopImageOverlayEdit` gerufen, Editor weg; bei `{error}` bleibt der Bearbeiten-Modus und der Fehler steht in der Rückfrage. Beweis: Tests aus Schritt 3 und 4 grün.
5. **Im Browser prüfen (AC-10).** Mit `run-einsatz` bei 390×844 und 1280×800: ein KML-Overlay per Datei mit einem Namen aus 80 Zeichen ohne Leerzeichen einbinden (Dateiname), Entfernen → Titel umgebrochen und vollständig, beide Knöpfe sichtbar, `scrollWidth <= innerWidth`; ein Bild-Overlay bearbeiten und löschen → Bearbeiten-Modus endet. Screenshots.
6. `npm run check` grün.

## Not here
- Kartenzeichen und Gerätelink: Ticket 02. Bereich: Ticket 03. Ansichtslink: Ticket 05. Konto: Ticket 06. Einsatz: Ticket 07.
- Ein gemeinsamer Datei-Eingang fürs Ebenen-Panel (Punkt 3 in `REFACTORING.md`) und ein Catch-all in `operationAction` für die KML- und Bild-Actions (Punkt 5): nicht hier.
- Sichtbarkeit umschalten, Neu laden, Datei ersetzen, Deckkraft: bleiben ohne Rückfrage.
- Lage und Auffälligkeit der Lösch-Knöpfe: Sie bleiben, wo und wie sie sind.
- Verhalten, wenn das Objekt anderswo gelöscht wird, während seine Rückfrage offen ist. Es wird nicht eigens gebaut oder getestet.

## Record
Bringt voran (für Bild-Overlay löschen und KML-Overlay entfernen):
- **AC-1**: `src/map/KmlPanel.test.tsx`, Block „removing an overlay“: „asks for confirmation first and removes only once confirmed“ und „does not remove when cancelled with Abbrechen / on Escape / on a click beside the confirmation“ (Overlay noch gelistet); `src/map/ImageOverlayEditor.test.tsx`, Block „deleting“: „asks for confirmation first and deletes only once confirmed“ und „does not delete when cancelled with Abbrechen / on Escape / on a click beside the confirmation“. Im Workspace: `SituationWorkspace.test.tsx`, Block „confirming in the Ebenen panel“, „deletes a Bild-Overlay only once confirmed and ends editing it“ und „removes a KML-Overlay only once confirmed“.
- **AC-2**: die beiden „asks for confirmation first …“-Tests (Titel `KML-Overlay „Zonen“ entfernen` bzw. „Bild-Overlay löschen“ als Dialog-Name, Text aus der Tabelle, Bestätigungsknopf rot über `buttonColor`).
- **AC-3**: „stays locked while removing“ (`KmlPanel`) und „stays locked while deleting“ (`ImageOverlayEditor`): nach dem Bestätigen Escape, Overlay-Klick und zweiter Klick – Rückfrage bleibt, „Abbrechen“ gesperrt, Action einmal gerufen. Den Ladezustand des Knopfs belegt `ConfirmationModal.test.tsx` (Ticket 01).
- **AC-4**: „shows a returned error / a thrown failure in the open confirmation, not atop the panel“ (`KmlPanel`: einziger Alert steht in der Rückfrage, Overlay gelistet, beide Knöpfe aktiv); „shows a returned error / a thrown failure in the open confirmation“ (`ImageOverlayEditor`); im Workspace „shows a returned error / a thrown failure in the open confirmation and keeps editing the Bild-Overlay“ (einziger Alert in der Rückfrage, Bearbeiten-Modus bleibt).
- **AC-5**: „deletes a Bild-Overlay only once confirmed and ends editing it“ (Rückfrage zu, `adapter.stopImageOverlayEdit` gerufen, Deckkraft-Regler weg).
- **AC-10**: im Browser mit `run-einsatz` (Subagent, zusätzlich vom Reviewer) bei 390×844 (Touch) und 1280×800 geprüft: KML-Datei mit 80 Zeichen ohne Leerzeichen im Namen – Titel dreizeilig umgebrochen, nicht abgeschnitten; beide Knöpfe im Viewport; `scrollWidth == innerWidth`; Escape und Klick neben die Rückfrage schließen sie, Overlay bleibt; Bestätigen entfernt es. Bild-Overlay: Rückfrage vollständig sichtbar, „Abbrechen“ lässt den Bearbeiten-Modus stehen, „Endgültig löschen“ beendet ihn und entfernt das Bild. Keine Konsolenfehler aus den Rückfragen.

Zusätzlich aus Browser-Check und Review:
- „returns focus to the Entfernen button when the first confirmation is cancelled“: Die KML-Rückfrage wurde anfangs erst beim ersten Öffnen gemountet, schon offen; Mantine merkte sich dann nicht, wohin der Fokus zurück soll. Sie ist jetzt immer gemountet, der Titel nimmt das zuletzt gefragte Overlay.
- „clears an earlier panel error once the overlay is removed“ / „keeps an earlier panel error when the removal fails“: Früher lief „Entfernen“ über `run` und räumte bei Erfolg den Alert oben im Panel ab; das tut das Entfernen jetzt selbst, bei Fehler nicht.
- `clickModalOverlay` in `src/test/modal-overlay.ts` ersetzt vier gleiche Test-Helfer (`ConfirmationModal`, `DeviceLinkPanel`, `ImageOverlayEditor`, `KmlPanel`) und `clickConfirmationOverlay` in `SituationWorkspace.test.tsx`.

Kommando: `docker compose -f docker-compose.test.yml up -d && npm run check` – 117 Dateien, 1165 Tests grün, tsc und Biome ohne Befund.

### Left standing
- Abweichung vom Plan, Schritt 4: `deleteImage` nimmt die id als Parameter (`onDelete={() => deleteImage(editingImage.id)}`) statt `editingImageId` zu lesen; so entfällt der Wächter für eine fehlende id.
- Abweichung vom Plan, Schritt 2: `removeTarget` bleibt nach dem Schließen gesetzt, dazu ein eigener Boolean `removeAsked`, damit der Titel beim Ausblenden nicht zu `KML-Overlay „“ entfernen` wird und die Rückfrage von Anfang an gemountet ist (Fokus-Rückgabe, s. o.).
- Die Workspace-Tests „deletes a Bild-Overlay …“ und „shows a thrown failure …“ waren schon grün, bevor `deleteImage` umgebaut wurde (der Editor hatte da schon seine Rückfrage); rot war „shows a returned error …“, weil der Fehler zusätzlich im Editor stand.
- „Löschen“ im Bild-Overlay-Editor behält `loading={busy}`, damit es wie bisher sperrt, während Deckkraft oder Datei gespeichert werden (wie bei Ticket 02).
- Review-Nit, nicht geändert: Das Verhalten des `ConfirmationModal` (drei Abbrechen-Wege, Sperre, Fehlertext) wird in jedem Aufrufer erneut getestet; so halten es die Tickets 01–03, der Ticket-Plan verlangt es.
- Nicht behoben, außerhalb des Tickets (Browser-Check): Ein langer KML-Name bricht in der Zeile nicht um und schiebt „Entfernen“ aus dem Panel (am Handy bei x≈826 von 390, nur per Wischen zur Seite erreichbar); „Lage und Auffälligkeit der Lösch-Knöpfe“ gehört nicht hierher, verdient aber ein eigenes Ticket.
- Nicht behoben, außerhalb des Tickets (Browser-Check): KML-Punkte zeigen kein Symbol; Leaflet lädt `/operations/marker-icon.png` relativ, der Server liest `marker-icon.png` als Einsatz-id und antwortet mit 500 (`invalid input syntax for type uuid`) – dazu: eine ungültige id ergibt 500 statt 404.
- Nicht behoben, wie in Ticket 02/03: Beim Öffnen liegt der Fokus auf dem Schließen-X der Rückfrage statt auf „Abbrechen“. Am Handy schließt „Bearbeiten“ das Ebenen-Panel, „Löschen“ erscheint erst nach erneutem Öffnen (schon vorher so).
- Die Browserprüfung hat den Dev-Server selbst gestartet und am Ende gestoppt (dabei lief die Browserprüfung des Reviewers möglicherweise noch gegen denselben Server); die Einsätze „QA-Ebenen“ und der des Reviewers wurden angelegt und wieder gelöscht; keine Migration, kein Seed.
- Nicht gemacht: `SituationWorkspace.tsx` bzw. seine Test-Datei vor dem Ändern aufteilen (wie in Ticket 02/03, `REFACTORING.md` Punkt 10).
