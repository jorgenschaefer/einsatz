---
criteria:  CRITERIA.md
closes:
advances:  AC-2, AC-3, AC-4, AC-9, AC-10
after:     01-bestaetigungs-modal
status:    done
attempts:  1
---

## Build
„Konto löschen“ in der Nutzerverwaltung läuft über das `ConfirmationModal`: Ladezustand, Fehler in der Rückfrage statt oberhalb der Kontenliste, auch bei einem unerwarteten Abbruch.

## Done when
- AC-2, für Konto löschen: Titel „Konto löschen“, Text wie heute, rechts unten „Abbrechen“ und „Endgültig löschen“ in Rot.
- AC-3, für diese Rückfrage: Während die Action läuft, ist der Bestätigungsknopf im Ladezustand und „Abbrechen“ gesperrt; weder Escape noch ein Klick neben die Rückfrage schließt sie; ein zweiter Tap ruft `onDelete` nicht noch einmal.
- AC-4, für diese Rückfrage: Ein zurückgegebener `{error}` und eine geworfene Ausnahme stehen in der offenen Rückfrage, das Konto ist noch gelistet, erneutes Bestätigen und Abbrechen gehen.
- AC-9, für Konto löschen: Scheitert es, steht die Meldung im Dialog, die Seite bricht nicht ab, und oberhalb der Kontenliste erscheint keine Meldung.
- AC-10, für diese Rückfrage: bei 390×844 und 1280×800 vollständig sichtbar, beide Knöpfe erreichbar; ein Nutzername aus 80 Zeichen ohne Leerzeichen bricht im Text um, und die Seite scrollt nicht horizontal.

## Toward
> **AC-2** Alle zwölf Rückfragen sind gleich aufgebaut: die sechs aus AC-1 und dazu Einsatz löschen, Konto löschen, ETB-Eintrag annullieren, Stärkemeldung annullieren, Gesamtstärke melden, Standard-Ausschnitt festlegen. Der Titel nennt die Aktion, der Text die Folge, rechts unten stehen „Abbrechen“ und ein Bestätigungsknopf, der das Verb der Aktion trägt. Der Bestätigungsknopf ist rot, nur bei „Gesamtstärke melden“ und „Standard-Ausschnitt festlegen“ nicht. Titel, Texte und Knöpfe der sechs neuen Rückfragen und der Rückfrage „Standard-Ausschnitt festlegen“ stehen unter „Agreed design“.

> **AC-3** Während eine bestätigte Aktion läuft, zeigt der Bestätigungsknopf einen Ladezustand, „Abbrechen“ ist gesperrt, der Dialog lässt sich nicht schließen, und ein weiterer Tap auf den Bestätigungsknopf löst die Aktion nicht ein zweites Mal aus.

> **AC-4** Scheitert eine bestätigte Aktion, bleibt der Dialog offen und zeigt die Fehlermeldung im Dialog. Das gilt auch für einen unerwarteten Abbruch, dann mit der Meldung „Das hat nicht geklappt. Bitte erneut versuchen.“ Das Objekt ist unverändert, und man kann erneut bestätigen oder abbrechen.

> **AC-9** Scheitert „Einsatz löschen“ oder „Konto löschen“, steht die Fehlermeldung im Dialog. Die Seite bricht nicht ab, und es erscheint keine Meldung oberhalb der Kontenliste.

> **AC-10** Bei 390×844 und bei 1280×800 ist jede Rückfrage vollständig sichtbar, und beide Knöpfe sind erreichbar. Ein Name aus 80 Zeichen ohne Leerzeichen, etwa beim KML-Overlay oder beim Ansichtslink, wird im Titel umgebrochen. Er wird nicht abgeschnitten, und die Seite scrollt nicht horizontal.

## Nudges
> Das `ConfirmationModal` aus `src/strength/StrengthPanel.tsx` kommt in eine eigene Datei, und alle zwölf Rückfragen nutzen es. Die von Hand gebauten Rückfragen in `JournalPanel`, `MapControls`, `UserAdminPanel` und `OperationLifecycleActions` entfallen.

## Context
Voraussetzung: Ticket 01 hat `ConfirmationModal` nach `src/app/ConfirmationModal.tsx` verschoben (Props `opened`, `onClose`, `title`, `confirmLabel`, `confirmColor?`, `onConfirm: () => Promise<ActionResult>`, `children`; ab Ticket 02 auch `stackId?`, hier nicht nötig). Es sperrt sich während `onConfirm` läuft, zeigt `{error}` und eine geworfene Ausnahme („Das hat nicht geklappt. Bitte erneut versuchen.“) im Dialog und ruft bei Erfolg `onClose`. Der Titel bricht mit `overflowWrap: "anywhere"` um, der Text im Dialog nicht.

Heute, `src/app/admin/users/UserAdminPanel.tsx`: eigenes `Modal` „Konto löschen“, Text „Das Konto <strong>{deletingAccount?.username}</strong> wird unwiderruflich gelöscht.“ (bleibt), „Endgültig löschen“ rot. `confirmDelete` läuft über `run`, das den Fehler als Alert **oben über der Kontenliste** zeigt, den Dialog trotzdem schließt (`setDeletingId(null)`) und eine geworfene Ausnahme nicht fängt. `run` bleibt für Anlegen, Rolle und Passwort. `deleteAccountAction` (`src/app/admin/users/actions.ts`, über `guarded`) liefert `{error}`, z. B. „Der letzte verbleibende Admin kann nicht gelöscht werden.“, und wirft Unerwartetes weiter. `UserAdminPanel` hat ein lokales `interface ActionResult` gleicher Form wie das aus `action-result.ts`. Nutzernamen haben keine Längengrenze (`src/server/auth/account-admin.ts` trimmt nur).

Tests: `src/app/admin/users/UserAdminPanel.test.tsx` („requires explicit confirmation before deleting an account“, „does not delete when the confirmation is cancelled“, „shows the error an action returns (e.g. last-admin protection)“).

## Plan
1. **AC-9 für Konto, rot.** In `UserAdminPanel.test.tsx`: `onDelete` liefert `{ error: "Der letzte verbleibende Admin kann nicht gelöscht werden." }` → die Meldung steht im noch offenen Dialog, außerhalb des Dialogs gibt es kein `alert`; `onDelete` wirft → „Das hat nicht geklappt. Bitte erneut versuchen.“ im Dialog, das Konto noch gelistet. Beide rot.
2. **Bauen.** Das eigene Modal und `confirmDelete` durch `ConfirmationModal` ersetzen (`title="Konto löschen"`, `confirmLabel="Endgültig löschen"`, `confirmColor="red"`, `onConfirm={() => onDelete(deletingAccount.id)}`, `onClose={() => setDeletingId(null)}`). Beweis: Tests aus Schritt 1 grün, die bestehenden grün – „shows the error an action returns …“ gilt weiter für Anlegen/Rolle/Passwort.
3. **Weitere Tests.** Während `onDelete` hängt: „Abbrechen“ gesperrt, Escape und Klick aufs Overlay schließen nicht, ein zweiter Klick ruft nicht erneut; nach Erfolg ist der Dialog zu; nach einem Fehler ruft erneutes Bestätigen `onDelete` noch einmal. Beweis: grün.
4. **Langer Nutzername.** Den Namen im Text umbrechen lassen (`overflowWrap: "anywhere"` am `<strong>` oder am `Text`). Beweis: Schritt 5.
5. **Im Browser prüfen (AC-10).** Mit `run-einsatz` bei 390×844 und 1280×800 ein Konto mit 80 Zeichen ohne Leerzeichen anlegen, „Löschen“ → Rückfrage vollständig sichtbar, Name umgebrochen, beide Knöpfe erreichbar, `document.documentElement.scrollWidth <= innerWidth`. Screenshots.
6. `npm run check` grün.

## Not here
- Einsatz löschen: Ticket 07. Die übrigen Rückfragen: Tickets 01–05.
- Rolle ändern und Passwort zurücksetzen: bleiben ohne Rückfrage und zeigen ihren Fehler weiter oben über der Kontenliste.
- Lage und Auffälligkeit der Lösch-Knöpfe: Sie bleiben, wo und wie sie sind.

## Record
Schließt: nichts (`closes:` ist leer).

Bringt voran (für Konto löschen), alle in `src/app/admin/users/UserAdminPanel.test.tsx`, Block „deleting an account“:
- **AC-2**: „asks in a dialog and deletes only once confirmed“ (Dialog-Name „Konto löschen“, Text „Das Konto anna wird unwiderruflich gelöscht.“, „Endgültig löschen“ rot über `buttonColor`, `onDelete("u1")` erst nach dem Bestätigen, Dialog danach zu). Lage „rechts unten“ kommt aus `ConfirmationModal` (Ticket 01) und ist im Browser gesehen.
- **AC-3**: „stays locked while deleting“ (Bestätigungsknopf `data-loading`, „Abbrechen“ gesperrt, Escape und Klick aufs Overlay lassen die Rückfrage offen, zweiter Klick ruft `onDelete` nicht noch einmal). Dazu „does not delete when cancelled with Abbrechen / on Escape / on a click beside the confirmation“.
- **AC-4**: „shows a returned error / a thrown failure in the open confirmation, not above the account list“ (Meldung bzw. „Das hat nicht geklappt. Bitte erneut versuchen.“ in der offenen Rückfrage, Konto gelistet, beide Knöpfe aktiv); „deletes on a second confirmation after a failure“ (erneutes Bestätigen ruft `onDelete` noch einmal, Dialog schließt bei Erfolg).
- **AC-9**: dieselben zwei Fehler-Tests: genau ein `alert` auf der Seite, und zwar im Dialog; die geworfene Ausnahme erreicht die Seite nicht mehr (vorher „Unhandled Rejection“). Dazu „dismisses an earlier error above the account list when asking“.
- **AC-10**: im Browser mit `run-einsatz` (Subagent) bei 390×844 (Touch) und 1280×800: Konto mit 80 Zeichen ohne Leerzeichen angelegt; Rückfrage vollständig sichtbar, Name im Text auf 3 bzw. 2 Zeilen umgebrochen, beide Knöpfe im Viewport und oberstes Element; `scrollWidth == innerWidth` mit offener und geschlossener Rückfrage; Escape/„Abbrechen“ schließen, „Endgültig löschen“ entfernt das Konto; „letzter Admin“ zeigt die Meldung nur im Dialog; keine Konsolenfehler der App. Testkonten wieder gelöscht.

Die vier Tests zu Sperre, erneutem Bestätigen und den beiden Fehlern sind gegen das alte `UserAdminPanel` rot gelaufen; die übrigen Löschtests pinnen Verhalten, das es schon vorher gab.

Kommando: `docker compose -f docker-compose.test.yml up -d && npm run check` – 117 Dateien, 1185 Tests grün, tsc und Biome ohne Befund.

### Left standing
- Über den Plan hinaus: Der Nutzername in der **Kontenzeile** bricht jetzt auch um (`miw={0}` an der Gruppe, `overflowWrap: "anywhere"` am Namen). Ohne das war die Seite am Handy mit einem 80-Zeichen-Namen 926 px breit, und „Löschen“ lag außerhalb des Bildschirms – AC-10 „die Seite scrollt nicht horizontal“ war nicht erfüllt. Die Knöpfe bleiben an ihrer Stelle und in ihrem Aussehen (`## Not here`). Nur im Browser geprüft, kein Unit-Test (jsdom misst kein Layout).
- Über den Plan hinaus: „Löschen“ in der Zeile räumt eine ältere Meldung oberhalb der Kontenliste weg. Vorher tat das `run` beim Löschen; ohne das stünde nach erfolgreichem Löschen noch ein alter Fehler von „Rolle ändern“ da (Review Runde 1). Gepinnt durch „dismisses an earlier error above the account list when asking“.
- Mitgenommen: `actions.ts` nutzt statt seines lokalen `interface Result` das gemeinsame `ActionResult`; dessen Doc-Kommentar nennt jetzt auch die Nutzerverwaltung (Review-Nits). Die Datei liegt weiter unter `src/app/operations/[id]/` – ein Umzug hätte alle Importe angefasst.
- Nicht behoben, Review-Nit: `onConfirm={async () => deletingAccount ? onDelete(deletingAccount.id) : {}}` – der `{}`-Zweig ist nicht erreichbar und steht für TypeScript da (wie in Ticket 05).
- Nicht behoben, Review-Nit: Die Zusicherung „Konto noch gelistet“ in den Fehlertests kann im Komponententest nicht fallen, weil die Liste aus den Props kommt. Dass das Konto serverseitig bleibt, hängt an `guarded` (revalidiert nur bei Erfolg und löscht bei `ValidationError` nichts); im Browser für „letzter Admin“ gesehen.
- Browser-Befunde außerhalb dieses Tickets: Am Handy stehen die drei Zeilen-Knöpfe untereinander neben dem Namen, die Zeile wird hoch (Lage der Knöpfe: `## Not here`). Nach einer Ablehnung bleibt „Endgültig löschen“ aktiv und liefert beim erneuten Tippen dieselbe Meldung – so von AC-4 verlangt.
- Die Browserprüfungen (eigene und die des Reviewers) haben den Dev-Server gestartet und gestoppt und Testkonten in der Dev-DB angelegt und wieder gelöscht; keine Migration, kein Seed.
