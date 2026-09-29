---
criteria:  CRITERIA.md
closes:    AC-1, AC-7
advances:  AC-2, AC-3, AC-4, AC-10
after:     01-bestaetigungs-modal, 02-kartenzeichen-und-geraetelink, 03-bereich, 04-ebenen-overlays
status:    ready
attempts:  0
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
