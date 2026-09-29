---
criteria:  CRITERIA.md
closes:
advances:  AC-2, AC-3, AC-4, AC-9, AC-10
after:     01-bestaetigungs-modal
status:    ready
attempts:  0
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
