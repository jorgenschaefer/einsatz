---
criteria:  CRITERIA.md
closes:    AC-1, AC-7
advances:  AC-2, AC-3, AC-4, AC-10
after:     01-bestaetigungs-modal, 02-kartenzeichen-und-geraetelink, 03-bereich, 04-ebenen-overlays
status:    done
attempts:  1
---

## Build
„Ansichtslink löschen“ fragt über das `ConfirmationModal` nach statt inline in der Zeile, und `deleteViewLinkAction` läuft über `operationAction` und liefert ein `ActionResult`, dessen Fehler in der Rückfrage steht. Damit fragen alle sechs Aktionen aus AC-1 nach.

## Done when
> **AC-1** Keine dieser sechs Aktionen hat eine Wirkung, bevor sie in einem Dialog bestätigt wurde: Kartenzeichen löschen, Bereich löschen, Bild-Overlay löschen, KML-Overlay entfernen, Ansichtslink löschen, Gerätelink neu generieren. „Abbrechen“, Escape und ein Klick neben den Dialog lassen alles unverändert.

> **AC-7** In der Zeile eines Ansichtslinks gibt es keine Inline-Bestätigung mehr.

- AC-2, für Ansichtslink löschen: Titel `Ansichtslink „<Name>“ löschen`, Text und Knopf wie in der Tabelle, Bestätigungsknopf rot.
- AC-3, für diese Rückfrage: Während die Action läuft, ist der Bestätigungsknopf im Ladezustand und „Abbrechen“ gesperrt; weder Escape noch ein Klick neben die Rückfrage schließt die Rückfrage oder das Modal „Ansichtslinks teilen“; ein zweiter Tap ruft `onDelete` nicht noch einmal.
- AC-4, für diese Rückfrage: Ein zurückgegebener `{error}` und eine geworfene Ausnahme stehen in der offenen Rückfrage, der Link ist noch gelistet, erneutes Bestätigen und Abbrechen gehen.
- AC-10, für diese Rückfrage: bei 390×844 und 1280×800 vollständig sichtbar, beide Knöpfe erreichbar; eine Bezeichnung aus 80 Zeichen ohne Leerzeichen wird im Titel umgebrochen, nicht abgeschnitten, und die Seite scrollt nicht horizontal.

## Toward
> **AC-2** Alle zwölf Rückfragen sind gleich aufgebaut: die sechs aus AC-1 und dazu Einsatz löschen, Konto löschen, ETB-Eintrag annullieren, Stärkemeldung annullieren, Gesamtstärke melden, Standard-Ausschnitt festlegen. Der Titel nennt die Aktion, der Text die Folge, rechts unten stehen „Abbrechen“ und ein Bestätigungsknopf, der das Verb der Aktion trägt. Der Bestätigungsknopf ist rot, nur bei „Gesamtstärke melden“ und „Standard-Ausschnitt festlegen“ nicht. Titel, Texte und Knöpfe der sechs neuen Rückfragen und der Rückfrage „Standard-Ausschnitt festlegen“ stehen unter „Agreed design“.

> **AC-3** Während eine bestätigte Aktion läuft, zeigt der Bestätigungsknopf einen Ladezustand, „Abbrechen“ ist gesperrt, der Dialog lässt sich nicht schließen, und ein weiterer Tap auf den Bestätigungsknopf löst die Aktion nicht ein zweites Mal aus.

> **AC-4** Scheitert eine bestätigte Aktion, bleibt der Dialog offen und zeigt die Fehlermeldung im Dialog. Das gilt auch für einen unerwarteten Abbruch, dann mit der Meldung „Das hat nicht geklappt. Bitte erneut versuchen.“ Das Objekt ist unverändert, und man kann erneut bestätigen oder abbrechen.

> **AC-10** Bei 390×844 und bei 1280×800 ist jede Rückfrage vollständig sichtbar, und beide Knöpfe sind erreichbar. Ein Name aus 80 Zeichen ohne Leerzeichen, etwa beim KML-Overlay oder beim Ansichtslink, wird im Titel umgebrochen. Er wird nicht abgeschnitten, und die Seite scrollt nicht horizontal.

## Nudges
> Das `ConfirmationModal` aus `src/strength/StrengthPanel.tsx` kommt in eine eigene Datei, und alle zwölf Rückfragen nutzen es. Die von Hand gebauten Rückfragen in `JournalPanel`, `MapControls`, `UserAdminPanel` und `OperationLifecycleActions` entfallen.

> `deleteViewLinkAction` läuft über `operationAction` und liefert `ActionResult`. Das ist der Lösch-Teil von Punkt 4 in `REFACTORING.md`.

> Punkt 1 wird aus `REFACTORING.md` entfernt. Punkt 4 wird auf `createViewLinkAction` gekürzt.

## Context
Voraussetzung: Ticket 01 hat `ConfirmationModal` nach `src/app/ConfirmationModal.tsx` verschoben. Tickets 02–04 haben die Rückfragen für Kartenzeichen, Gerätelink, Bereich, Bild-Overlay und KML-Overlay gebaut; mit diesem Ticket ist AC-1 für alle sechs erfüllt. Dieses Ticket schließt AC-1: Im Record die AC-1-Tests aus 02–04 zusammen mit den eigenen nennen.

Heute:
- `src/map/ViewLinkPanel.tsx`: `ViewLinkRow` hat „löschen“ (`aria-label={`${name} löschen`}`, `color="red"`, `variant="subtle"`), das `confirming` setzt und eine Inline-Bestätigung in der Zeile zeigt („Zugang für diesen Link sofort beenden?“, „Abbrechen“, „Endgültig löschen“ → `onDelete(link.id)`). `name` ist `link.label.trim() || "Ansichtslink"`. `onDelete: (id: string) => void | Promise<void>`.
- Das Panel steht im Modal „Ansichtslinks teilen“ in `src/app/operations/[id]/LageansichtShell.tsx` (Zeile ~176); die Rückfrage liegt also über diesem Modal. **Stapel (geprüft, Mantine 9.4.1):** Jedes offene `Modal` hört auf Escape per `window`-Listener; ohne Stapel schließt Escape Rückfrage **und** Teilen-Modal, auch während die Action läuft. Ticket 02 hat `ConfirmationModal` eine optionale `stackId` gegeben und Kartenzeichen-Dialog und Rückfragen in Mantines `<Modal.Stack>` gesetzt: Nur das oberste Modal reagiert auf Escape, das darunter ist ausgeblendet (`opacity: 0`), bleibt gemountet und erscheint nach dem Abbrechen unverändert – so mit dem Nutzer entschieden. Dasselbe Muster hier. Props dort und in `SituationWorkspace` (`onDeleteViewLink?: (id: string) => void | Promise<void>`, Defaults `noop` in `LageansichtShell`) ändern ihren Typ mit.
- `src/app/operations/[id]/view-link-actions.ts`: `deleteViewLinkAction` liefert `void`, ruft `requireUser`, `deleteViewLink`, `revalidatePath`. Der Kommentar oben begründet, warum beide Actions außerhalb von `operationAction` laufen; für `deleteViewLinkAction` gilt das nicht mehr.
- `operationAction` (`src/app/operations/[id]/operation-action.ts`) erzwingt die Anmeldung (wirft ohne Session), übersetzt `ValidationError` in `{error}`, wirft anderes weiter, revalidiert und schickt das Live-Ereignis. Andere offene Clients laden bei einem gelöschten Ansichtslink dadurch neu – so in `REFACTORING.md` Punkt 4 als fachlich harmlos beschrieben.
- `src/app/operations/[id]/view-link-actions.test.ts` läuft gegen `freshDb()` (Docker-Postgres auf Port 5437, `docker compose -f docker-compose.test.yml up -d`).
- `REFACTORING.md` Punkt 4 „Ansichtslink-Actions über `operationAction`“ beschreibt beide Actions.

Text aus der Tabelle unter „Agreed design“:

| Aktion | Titel | Text | Bestätigungsknopf |
|---|---|---|---|
| Ansichtslink löschen | Ansichtslink „‹Name›“ löschen | Wer diesen Link hat, sieht die Lage sofort nicht mehr. | Endgültig löschen |

„‹Name›“ ist das `name` aus `ViewLinkRow`, also bei leerer Bezeichnung „Ansichtslink“.

## Plan
1. **AC-1 und AC-7 für den Ansichtslink, rot.** In `src/map/ViewLinkPanel.test.tsx` „deletes a link only after confirmation“ (Zeile ~163) umschreiben: „<Name> löschen“ öffnet einen Dialog (`getByRole("dialog")`) mit Titel `Ansichtslink „<Name>“ löschen` und dem Text aus der Tabelle; in der Zeile erscheint keine Inline-Bestätigung (kein „Zugang für diesen Link sofort beenden?“); `onDelete` erst nach „Endgültig löschen“. Weitere Tests: „Abbrechen“, Escape und Klick aufs Overlay der Rückfrage rufen `onDelete` nicht; `{error}` und Ausnahme stehen in der Rückfrage, der Link ist noch gelistet; während `onDelete` hängt, sind „Abbrechen“ gesperrt, Escape und Overlay-Klick wirkungslos, ein zweiter Klick ruft nicht erneut.
2. **Rückfrage im `ViewLinkPanel`.** `onDelete: (id: string) => Promise<ActionResult>`; `confirming` und die Inline-Bestätigung entfallen, „löschen“ öffnet ein `ConfirmationModal` (`stackId="ansichtslink-loeschen"`, `confirmLabel="Endgültig löschen"`, `confirmColor="red"`). Knopf bleibt an seiner Stelle und in seinem Aussehen. Die Typen in `LageansichtShell.tsx` und `SituationWorkspace.tsx` nachziehen; der `noop`-Default in `LageansichtShell` liefert `{}`. Beweis: Tests aus Schritt 1 grün, `tsc` grün.
3. **Stapel im `LageansichtShell`, Test rot.** In `LageansichtShell.test.tsx`: Teilen öffnen, „<Name> löschen“, dann Escape → Rückfrage zu, Teilen-Modal wieder da mit dem Link; dasselbe mit Klick aufs Overlay der Rückfrage; während `onDeleteViewLink` hängt, schließt Escape keins der beiden; nach „Endgültig löschen“ ruft es `onDeleteViewLink(id)`. Rot bei Escape, dann das Teilen-Modal in ein `<Modal.Stack>` setzen, `stackId="ansichtslinks-teilen"`. Beweis: grün.
4. **Action über `operationAction`.** In `view-link-actions.test.ts` einen Test: `deleteViewLinkAction` liefert bei Erfolg `{}` (rot, heute `undefined`). Die bestehenden Tests „deletes a view link for a logged-in user“ und „refuses to delete a link without a session and keeps it“ bleiben und müssen grün bleiben. Dann `deleteViewLinkAction` als `operationAction(async (db) => { await deleteViewLink(db, id); return operationId; })`, Rückgabetyp `Promise<ActionResult>`. Den Kommentar oben auf `createViewLinkAction` einschränken. Beweis: `view-link-actions.test.ts` grün (braucht den Test-Container).
5. **`REFACTORING.md` Punkt 4** auf `createViewLinkAction` kürzen: nur noch sie liefert `void`, zeigt keine Fehler, sendet kein Live-Ereignis. Beweis: Lesen.
6. **Im Browser prüfen (AC-7, AC-10).** Mit `run-einsatz` bei 390×844 und 1280×800: Teilen öffnen, einen Ansichtslink mit einer Bezeichnung aus 80 Zeichen ohne Leerzeichen anlegen, „löschen“ → Titel umgebrochen und vollständig, beide Knöpfe sichtbar, `scrollWidth <= innerWidth`; Escape → Teilen-Modal zurück; Endgültig löschen → Link weg. Screenshots.
7. `npm run check` grün.

## Not here
- `createViewLinkAction`: Sie bleibt, wie sie ist (Rest von Punkt 4 in `REFACTORING.md`).
- Punkt 1 aus `REFACTORING.md` entfernen: Ticket 07, das als letztes die Rückfragen fertig macht.
- Konto: Ticket 06. Einsatz: Ticket 07.
- Lage und Auffälligkeit der Lösch-Knöpfe: Sie bleiben, wo und wie sie sind.
- Verhalten, wenn das Objekt anderswo gelöscht wird, während seine Rückfrage offen ist. Es wird nicht eigens gebaut oder getestet.

## Record
Schließt:
- **AC-1**, für Ansichtslink löschen: `src/map/ViewLinkPanel.test.tsx`, Block „deleting a link“: „asks in a dialog, not inline in the row, and deletes only once confirmed“ (`onDelete` erst nach „Endgültig löschen“) und „does not delete when cancelled with Abbrechen / on Escape / on a click beside the confirmation“ (Link noch gelistet); über dem Teilen-Modal `src/app/operations/[id]/LageansichtShell.test.tsx`, Block „deleting a view link from Teilen“: „closes only the confirmation on Escape / on a click beside the confirmation and returns to Teilen with the link“. Für die übrigen fünf Aktionen aus den Tickets 02–04: Kartenzeichen löschen – `SituationWorkspace.test.tsx`, Block „confirming in the Kartenzeichen detail“, „keeps the detail and its unsaved input after cancelling with Abbrechen / Escape / a click beside the confirmation“ und „deletes the Kartenzeichen only once confirmed and closes both dialogs“; Gerätelink neu generieren – `DeviceLinkPanel.test.tsx` „asks for confirmation first and regenerates only once confirmed“ und „does not regenerate when cancelled / on Escape / on a click beside the confirmation“; Bereich löschen – `SituationWorkspace.test.tsx`, Block „confirming in the Bereich editor“, die drei Abbrechen-Tests und „deletes the Bereich only once confirmed and closes both dialogs“, dazu `AreaEditor.test.tsx` „deleting › deletes the area only once confirmed“; KML-Overlay entfernen – `KmlPanel.test.tsx`, Block „removing an overlay“, „asks for confirmation first and removes only once confirmed“ und „does not remove when cancelled …“; Bild-Overlay löschen – `ImageOverlayEditor.test.tsx`, Block „deleting“, „asks for confirmation first and deletes only once confirmed“ und „does not delete when cancelled …“, im Workspace „deletes a Bild-Overlay only once confirmed and ends editing it“ / „removes a KML-Overlay only once confirmed“.
- **AC-7**: „asks in a dialog, not inline in the row, …“ prüft, dass „Zugang für diesen Link sofort beenden?“ nicht mehr erscheint; die Inline-Bestätigung ist aus `ViewLinkRow` entfernt.

Bringt voran (für Ansichtslink löschen):
- **AC-2**: „asks in a dialog, not inline in the row, …“ (Dialog-Name `Ansichtslink „Leitstelle“ löschen`, Text aus der Tabelle, „Endgültig löschen“ rot über `buttonColor`); „names a link without a label „Ansichtslink“ in the title“.
- **AC-3**: `ViewLinkPanel.test.tsx` „stays locked while deleting“ (Escape, Overlay-Klick, zweiter Klick: Rückfrage bleibt, „Abbrechen“ gesperrt, `onDelete` einmal); `LageansichtShell.test.tsx` „keeps both dialogs open on Escape / on a click beside the confirmation while deleting“ (Rückfrage und Teilen-Modal bleiben). Ladezustand des Knopfs: `ConfirmationModal.test.tsx` (Ticket 01).
- **AC-4**: „shows a returned error / a thrown failure in the open confirmation and keeps the link“ (Meldung in der Rückfrage, Link gelistet, beide Knöpfe aktiv). Server: `view-link-actions.test.ts` „reports a deleted view link as a success without an error“ (liefert `{}`), „tells other open clients of the Einsatz that a view link was deleted“ (Live-Ereignis über den echten Event-Bus); „deletes a view link for a logged-in user“ und „refuses to delete a link without a session and keeps it“ bleiben grün.
- **AC-10**: im Browser mit `run-einsatz` (Subagent) bei 390×844 (Touch) und 1280×800 geprüft: Bezeichnung aus 80 Zeichen ohne Leerzeichen im Titel auf 4 bzw. 3 Zeilen umgebrochen, nicht abgeschnitten; Rückfrage vollständig sichtbar, beide Knöpfe im Viewport und oberstes Element an ihrer Stelle; `scrollWidth <= innerWidth`; Escape, Overlay-Klick und „Abbrechen“ schließen nur die Rückfrage, das Teilen-Modal kommt mit beiden Links zurück; „Endgültig löschen“ entfernt den Link, Teilen bleibt offen; keine Konsolenfehler.

Kommando: `docker compose -f docker-compose.test.yml up -d && npm run check` – 117 Dateien, 1178 Tests grün, tsc und Biome ohne Befund.

### Left standing
- Abweichung vom Plan, Schritt 2: Die Rückfrage steht einmal im `ViewLinkPanel`, nicht je Zeile; `ViewLinkRow` meldet nur `onAskDelete`. So gibt es eine `stackId` statt einer je Link, und die Rückfrage ist von Anfang an gemountet (wie beim `KmlPanel` in Ticket 04, wegen des Titels beim Ausblenden und der Fokus-Rückgabe). Der `{}`-Zweig in `onConfirm` ohne `deleteTarget` ist nicht erreichbar und steht nur für TypeScript da (Review-Nit, nicht geändert).
- Abweichung vom Plan, Schritt 2: Der Default in `LageansichtShell` ist ein eigenes `deleteNothing` (liefert `{}`), weil `noop` weiter für `onCreateViewLink` gilt.
- Abweichung vom Nudge „Punkt 1 wird aus `REFACTORING.md` entfernt“: nicht hier – `## Not here` gibt das Ticket 07. Nur Punkt 4 ist gekürzt.
- Der Test „keeps both dialogs open … on a click beside the confirmation while deleting“ im Shell-Test und „closes only the confirmation on a click beside …“ fallen nicht, wenn der `Modal.Stack` fehlt – der Klick trifft immer das Overlay der obersten Rückfrage. Gegen einen fehlenden Stapel sichern die Escape-Varianten (ohne `stackId="ansichtslinks-teilen"` geprüft: beide rot). Der Plan-Schritt 3 erwartete Rot nur bei Escape; so war es.
- Aus Review Runde 1 behoben: Overlay-Klick während des Löschens im Stapel getestet; Live-Ereignis beim Löschen gepinnt; Import `./action-result` in `LageansichtShell`. Runde 2: Nit zu „Sie“ in `REFACTORING.md` Punkt 4 behoben.
- Nicht behoben, Browser-Check, gehört nicht hierher („Lage und Auffälligkeit der Lösch-Knöpfe“ bzw. wie in 02–04): Die Zeilen-Knöpfe „kopieren“, „QR“, „löschen“ sind am Handy nur 22 px hoch und eng nebeneinander; „löschen“ hebt sich farblich kaum von „kopieren“/„QR“ ab; „Endgültig löschen“ ist Mantines hellere `red`. Eine lange Bezeichnung wird in der Zeile mit „…“ abgeschnitten und ist nirgends ganz lesbar außer in der Rückfrage. Nach dem Abbrechen landet der Fokus auf dem Schließen-X des Teilen-Modals statt auf „löschen“ (wie bei Kartenzeichen/Bereich); Enter schließt dann das Teilen-Modal. Am Handy liegt „Teilen“ im ⋮-Menü.
- Die Browserprüfung hat den Dev-Server selbst gestartet und gestoppt, den Einsatz „QA-Ansichtslink“ angelegt und wieder gelöscht; keine Migration, kein Seed.
