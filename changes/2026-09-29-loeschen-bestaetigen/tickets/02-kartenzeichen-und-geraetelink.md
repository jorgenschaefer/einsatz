---
criteria:  CRITERIA.md
closes:    AC-8
advances:  AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-10
after:     01-bestaetigungs-modal
status:    ready
attempts:  0
---

## Build
Im Kartenzeichen-Dialog fragen „Löschen“ und „Gerätelink neu generieren“ über das `ConfirmationModal` nach, das über dem Kartenzeichen-Dialog liegt. „Gerätelink erzeugen“ bleibt ohne Rückfrage.

## Done when
> **AC-8** Hat ein Kartenzeichen noch keinen Gerätelink, wird „Gerätelink erzeugen“ ohne Rückfrage ausgeführt.

- AC-1, für Kartenzeichen löschen und Gerätelink neu generieren: `onDelete` bzw. `onGenerateDeviceLink` werden erst nach „Endgültig löschen“ bzw. „Neu generieren“ gerufen; „Abbrechen“, Escape und ein Klick neben die Rückfrage rufen sie nicht.
- AC-2, für diese beiden Rückfragen: Titel, Text und Knopf wie in der Tabelle, Bestätigungsknopf rot.
- AC-3, für diese beiden Rückfragen: Während die Action läuft, ist der Bestätigungsknopf im Ladezustand und „Abbrechen“ gesperrt; weder Escape noch ein Klick neben die Rückfrage schließt die Rückfrage oder den Kartenzeichen-Dialog; ein zweiter Tap ruft die Action nicht noch einmal.
- AC-4, für diese beiden Rückfragen: Ein zurückgegebener `{error}` und eine geworfene Ausnahme stehen in der offenen Rückfrage, das Kartenzeichen ist noch im Dialog und auf der Karte, erneutes Bestätigen und Abbrechen gehen.
- AC-5, für diese beiden Rückfragen: Nach erfolgreichem Löschen schließen sich Rückfrage und Kartenzeichen-Dialog. Nach erfolgreichem Neu-Generieren schließt sich nur die Rückfrage; der Kartenzeichen-Dialog zeigt den neuen Link samt QR-Code.
- AC-6, für diese beiden Rückfragen: Abbrechen mit „Abbrechen“, Escape oder Klick neben die Rückfrage schließt nur die Rückfrage; der Kartenzeichen-Dialog ist noch offen, eine noch nicht gespeicherte Änderung im Formular ist noch da.
- AC-10, für diese beiden Rückfragen: bei 390×844 und 1280×800 vollständig sichtbar, beide Knöpfe erreichbar, kein horizontales Scrollen.

## Toward
> **AC-1** Keine dieser sechs Aktionen hat eine Wirkung, bevor sie in einem Dialog bestätigt wurde: Kartenzeichen löschen, Bereich löschen, Bild-Overlay löschen, KML-Overlay entfernen, Ansichtslink löschen, Gerätelink neu generieren. „Abbrechen“, Escape und ein Klick neben den Dialog lassen alles unverändert.

> **AC-2** Alle zwölf Rückfragen sind gleich aufgebaut: die sechs aus AC-1 und dazu Einsatz löschen, Konto löschen, ETB-Eintrag annullieren, Stärkemeldung annullieren, Gesamtstärke melden, Standard-Ausschnitt festlegen. Der Titel nennt die Aktion, der Text die Folge, rechts unten stehen „Abbrechen“ und ein Bestätigungsknopf, der das Verb der Aktion trägt. Der Bestätigungsknopf ist rot, nur bei „Gesamtstärke melden“ und „Standard-Ausschnitt festlegen“ nicht. Titel, Texte und Knöpfe der sechs neuen Rückfragen und der Rückfrage „Standard-Ausschnitt festlegen“ stehen unter „Agreed design“.

> **AC-3** Während eine bestätigte Aktion läuft, zeigt der Bestätigungsknopf einen Ladezustand, „Abbrechen“ ist gesperrt, der Dialog lässt sich nicht schließen, und ein weiterer Tap auf den Bestätigungsknopf löst die Aktion nicht ein zweites Mal aus.

> **AC-4** Scheitert eine bestätigte Aktion, bleibt der Dialog offen und zeigt die Fehlermeldung im Dialog. Das gilt auch für einen unerwarteten Abbruch, dann mit der Meldung „Das hat nicht geklappt. Bitte erneut versuchen.“ Das Objekt ist unverändert, und man kann erneut bestätigen oder abbrechen.

> **AC-5** Nach Erfolg schließt sich die Rückfrage. Beim Löschen von Kartenzeichen und Bereich schließt sich auch deren Dialog, beim Löschen eines Bild-Overlays endet dessen Bearbeiten-Modus. Nach „Gerätelink neu generieren“ bleibt der Kartenzeichen-Dialog offen und zeigt den neuen Link samt QR-Code. Nach „Einsatz löschen“ landet man wie bisher in der Einsatzübersicht.

> **AC-6** Bricht man die Rückfrage zum Löschen eines Kartenzeichens, zum Löschen eines Bereichs oder zu „Gerätelink neu generieren“ ab – mit „Abbrechen“, Escape oder einem Klick neben die Rückfrage –, schließt sich nur die Rückfrage, und man ist wieder im darunterliegenden Dialog. Dort ist alles wie vorher, auch noch nicht gespeicherte Eingaben.

> **AC-10** Bei 390×844 und bei 1280×800 ist jede Rückfrage vollständig sichtbar, und beide Knöpfe sind erreichbar. Ein Name aus 80 Zeichen ohne Leerzeichen, etwa beim KML-Overlay oder beim Ansichtslink, wird im Titel umgebrochen. Er wird nicht abgeschnitten, und die Seite scrollt nicht horizontal.

## Nudges
> Das `ConfirmationModal` aus `src/strength/StrengthPanel.tsx` kommt in eine eigene Datei, und alle zwölf Rückfragen nutzen es. Die von Hand gebauten Rückfragen in `JournalPanel`, `MapControls`, `UserAdminPanel` und `OperationLifecycleActions` entfallen.

> Die Lösch-Callbacks liefern ihr `ActionResult` direkt an die Rückfrage. Die Fehler- und Ladezustands-Behandlung fürs Löschen wandert aus `runDetail`, `runArea` und `deleteImage` in `SituationWorkspace` in die Rückfrage.

> `onGenerateDeviceLink` liefert sein `ActionResult` an die Rückfrage, statt fire-and-forget zu sein. Der Kommentar zur Fehler-Politik in `SituationWorkspace` wird entsprechend angepasst.

## Context
Voraussetzung: Ticket 01 hat `ConfirmationModal` nach `src/app/ConfirmationModal.tsx` verschoben (Props `opened`, `onClose`, `title`, `confirmLabel`, `confirmColor?`, `onConfirm: () => Promise<ActionResult>`, `children`). Es sperrt sich während `onConfirm` läuft, zeigt `{error}` und eine geworfene Ausnahme („Das hat nicht geklappt. Bitte erneut versuchen.“) im Dialog und ruft bei Erfolg `onClose`.

Heute, in `src/map/SituationWorkspace.tsx`:
- Der Kartenzeichen-Dialog ist das `Modal` mit `title="Kartenzeichen"` (Zeile ~987). Darin „Löschen“: `<Button color="red" variant="light" loading={detailBusy} onClick={() => runDetail(() => onDelete(selected.id))}>` – löscht sofort. `runDetail` (Zeile ~315) setzt `detailBusy`/`detailError` und schließt bei Erfolg den Dialog; es bleibt für „Speichern“ im Formular.
- `DeviceLinkPanel` bekommt `onGenerate={() => onGenerateDeviceLink(selected.id)}` – fire-and-forget, das Ergebnis wird verworfen.
- Der Kommentar „Fehler-Politik der Action-Ergebnisse“ (Zeile ~306) nennt `onGenerateDeviceLink` als bewusst fire-and-forget. Das ändert sich.
- `onDelete` und `onGenerateDeviceLink` liefern schon `Promise<ActionResult>` (`deleteMapSymbolAction`, `generateDeviceLinkAction` über `operationAction`).

`src/map/DeviceLinkPanel.tsx`: `onGenerate: () => void`. Mit Token zeigt es Link, QR-Code und „Gerätelink neu generieren“ (`variant="light" color="red"`); ohne Token „Gerätelink erzeugen“. Beide rufen heute `onGenerate`. Der neue Token kommt nach der Revalidierung als neue Prop `token`; der Dialog bleibt dabei offen, weil `selectedId` bleibt.

**Übereinanderliegende Dialoge (geprüft, Mantine 9.4.1; entschieden mit dem Nutzer):** Jedes offene Mantine-`Modal` hört mit einem eigenen `keydown`-Listener auf `window` (Capture-Phase, `node_modules/@mantine/core/esm/components/ModalBase/use-modal.mjs`). Ohne Weiteres schließt Escape daher die Rückfrage **und** den Kartenzeichen-Dialog – auch während die Action läuft, wodurch die Rückfrage mit ausgehängt würde (AC-3). Die Lösung ist Mantines `Modal.Stack`: Der Kartenzeichen-Dialog und seine Rückfragen stehen in einem `<Modal.Stack>` und tragen je eine `stackId`. Nur das oberste Modal im Stapel reagiert dann auf Escape, fängt den Fokus und zeigt sein Overlay (`node_modules/@mantine/core/esm/components/Modal/Modal.mjs`, Zeile ~37–62). Ein Klick neben die Rückfrage trifft ihr Overlay und schließt nur sie. Der Kartenzeichen-Dialog ist, solange die Rückfrage offen ist, unsichtbar (`data-hidden`, `opacity: 0`) und kommt nach dem Abbrechen unverändert zurück – er bleibt gemountet, Formular-State bleibt erhalten. Das ist gewollt; das Specimen zeigt ihn noch sichtbar, das ist überholt. `Modal.Stack` ist ein reiner Context; die Rückfrage muss nicht direktes Kind sein, sie muss nur im Baum darunter liegen (React-Context geht durch Portale). `ConfirmationModal` bekommt dafür eine optionale Prop `stackId?: string`, die es an sein `Modal` weiterreicht. Tickets 03 und 05 übernehmen das Muster.

Texte aus der Tabelle unter „Agreed design“:

| Aktion | Titel | Text | Bestätigungsknopf |
|---|---|---|---|
| Kartenzeichen löschen | Kartenzeichen löschen | Das Kartenzeichen verschwindet von der Lagekarte, ein Gerätelink wird ungültig. Das lässt sich nicht rückgängig machen. | Endgültig löschen |
| Gerätelink neu generieren | Gerätelink neu generieren | Der bisherige Link funktioniert sofort nicht mehr. Das Gerät muss den neuen Link öffnen. | Neu generieren |

Das Specimen (`specimens/bestaetigungs-modal.html`) zeigt den Ablauf am Handy: „Löschen“ öffnet einen zweiten Dialog über dem ersten. Sein Titel mit Namen und der sichtbare untere Dialog sind überholt; maßgeblich sind die Tabelle und `Modal.Stack` wie oben.

Tests: `src/map/SituationWorkspace.test.tsx` (3244 Zeilen) öffnet den Dialog per `spec.onClick!()` an einem Marker, siehe „deletes the selected Kartenzeichen from the detail panel“ (Zeile ~3221) und „generates a device link from the Kartenzeichen detail“ (Zeile ~3159). Der Klick neben die Rückfrage ist ein Klick auf ihr Overlay (`.mantine-Modal-overlay` des oberen Modals). `src/map/DeviceLinkPanel.test.tsx` testet das Panel allein.

## Plan
1. **`stackId` am `ConfirmationModal`.** Test in `src/app/ConfirmationModal.test.tsx`: zwei Modals in einem `<Modal.Stack>` (ein einfaches `Modal` mit `stackId="unten"`, darin ein `ConfirmationModal` mit `stackId="oben"`); Escape bei offener Rückfrage ruft nur deren `onClose`, nicht das des unteren. Rot (heute schließt Escape beide), dann `stackId?: string` durchreichen. Beweis: grün.
2. **`DeviceLinkPanel`: Rückfrage, Tests rot.** In `DeviceLinkPanel.test.tsx`: ohne Token ruft „Gerätelink erzeugen“ `onGenerate` sofort und öffnet keinen Dialog (bleibt grün, AC-8). Mit Token: „Gerätelink neu generieren“ ruft `onGenerate` nicht und öffnet eine Rückfrage mit Titel, Text und Knopf „Neu generieren“ aus der Tabelle; erst „Neu generieren“ ruft es; „Abbrechen“, Escape und Klick aufs Overlay rufen nichts; `{error}` und Ausnahme stehen in der Rückfrage; während `onGenerate` hängt, sind „Abbrechen“ gesperrt, Escape und Overlay-Klick wirkungslos, ein zweiter Klick ruft nicht erneut.
3. **`DeviceLinkPanel` bauen.** `onGenerate: () => Promise<ActionResult>`; „Gerätelink neu generieren“ öffnet ein `ConfirmationModal` (`confirmLabel="Neu generieren"`, `confirmColor="red"`, `onConfirm={onGenerate}`, `stackId="geraetelink-neu-generieren"`), „Gerätelink erzeugen“ ruft `onGenerate` direkt, sein Ergebnis wird nicht angezeigt (wie heute; AC-8 verlangt keine Anzeige). Beweis: Tests aus Schritt 2 grün.
4. **Kartenzeichen löschen und Stapel im Workspace: Tests, rot.** In `SituationWorkspace.test.tsx`: „deletes the selected Kartenzeichen from the detail panel“ so ändern, dass „Löschen“ `onDelete` nicht ruft und die Rückfrage mit Titel und Text aus der Tabelle zeigt; erst „Endgültig löschen“ ruft `onDelete("s1")`, danach sind Rückfrage und Kartenzeichen-Dialog zu. Für **beide** Rückfragen (Löschen, Neu generieren – Kartenzeichen mit `deviceLinkToken`) je ein Test für „Abbrechen“, Escape und Klick aufs Overlay der Rückfrage: Action nicht gerufen, Kartenzeichen-Dialog danach offen, eine vorher geänderte, nicht gespeicherte Eingabe in `AdvancedSymbolForm` noch da. Für beide: während die Action hängt, schließen Escape und Overlay-Klick weder Rückfrage noch Kartenzeichen-Dialog. Für Löschen: `{error}` und Ausnahme in der Rückfrage, Kartenzeichen-Dialog bleibt. Für Neu generieren: nach Erfolg ist die Rückfrage zu, der Kartenzeichen-Dialog offen, und nach `rerender` mit neuem `deviceLinkToken` steht die neue URL im Feld. „generates a device link from the Kartenzeichen detail“ bleibt unverändert (AC-8 im Workspace).
5. **Workspace bauen.** In `SituationWorkspace.tsx` den Kartenzeichen-Dialog in ein `<Modal.Stack>` setzen, `stackId="kartenzeichen"`. „Löschen“ öffnet ein `ConfirmationModal` (`stackId="kartenzeichen-loeschen"`, `confirmLabel="Endgültig löschen"`, `confirmColor="red"`); dessen `onConfirm` ruft `onDelete(selected.id)`, bei Erfolg `closeDetail()`, und gibt das `ActionResult` zurück. Der Knopf bleibt an seiner Stelle und in seinem Aussehen. Der Lösch-Weg über `runDetail` entfällt; `runDetail` bleibt fürs Speichern. `DeviceLinkPanel` bekommt `onGenerate={() => onGenerateDeviceLink(selected.id)}` jetzt als `Promise<ActionResult>`. Beweis: Tests aus Schritt 4 grün.
6. **Kommentar zur Fehler-Politik** anpassen: „Gerätelink neu generieren“ zeigt seinen Fehler in der Rückfrage; fire-and-forget bleiben `onMove` und „Gerätelink erzeugen“. Beweis: Lesen.
7. **Im Browser prüfen (AC-5, AC-6, AC-10).** Mit `run-einsatz` bei 390×844 und 1280×800: Kartenzeichen öffnen, Formular ändern, Löschen → Escape → Kartenzeichen-Dialog zurück, Änderung noch da; dasselbe mit „Gerätelink neu generieren“ und mit einem Klick neben die Rückfrage; Neu generieren → Dialog offen, neuer QR-Code; Löschen → Endgültig löschen → beide Dialoge weg. Screenshots; `document.documentElement.scrollWidth <= innerWidth`.
8. `npm run check` grün.

Entschieden, was spätere Tickets übernehmen: `ConfirmationModal.stackId`; der untere Dialog und seine Rückfragen stehen in einem `<Modal.Stack>`.

## Not here
- Bereich löschen und das Schließen des Bereich-Dialogs: Ticket 03 (baut auf dem Muster aus diesem Ticket auf und schließt AC-6).
- Bild- und KML-Overlay: Ticket 04. Ansichtslink: Ticket 05. Konto: Ticket 06. Einsatz: Ticket 07.
- Lage und Auffälligkeit der Lösch-Knöpfe: Sie bleiben, wo und wie sie sind.
- Verhalten, wenn das Objekt anderswo gelöscht wird, während seine Rückfrage offen ist. Es wird nicht eigens gebaut oder getestet.
- `SituationWorkspace.test.tsx` aufteilen (Punkt 10 in `REFACTORING.md`): nicht hier; die bestehenden Tests werden an Ort und Stelle geändert.
