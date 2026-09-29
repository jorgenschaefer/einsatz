# Criteria: Unwiderrufliche Aktionen einheitlich bestätigen

## Problem
In der Lageführung lassen sich mehrere unwiderrufliche Aktionen mit einem
einzigen Tap auslösen – Kartenzeichen, Bereich und Bild-Overlay löschen,
KML-Overlay entfernen, Gerätelink neu generieren; am Handy genügt ein
Fehl-Tap. Wo nachgefragt wird, geschieht das auf drei verschiedene Arten
(Modal, Inline-Bestätigung in der Zeile, gar nicht), und nur manche zeigen
einen Fehler dort, wo man gerade hinschaut. Die Führungskraft kann nicht
vorhersagen, ob ein roter Knopf sofort wirkt.

Stattdessen: Nichts Unwiderrufliches geschieht, ohne dass die Führungskraft es
ausdrücklich bestätigt hat, und die Rückfrage verhält sich überall gleich.

Ein konkreter Fall eines versehentlichen Löschens ist nicht bekannt. Der
Ausgangspunkt ist Punkt 1 in `REFACTORING.md` (Vereinfachungs-Durchgang vom
2026-09-28).

## Acceptance criteria
- **AC-1** Keine dieser sechs Aktionen hat eine Wirkung, bevor sie in einem Dialog bestätigt wurde: Kartenzeichen löschen, Bereich löschen, Bild-Overlay löschen, KML-Overlay entfernen, Ansichtslink löschen, Gerätelink neu generieren. „Abbrechen“, Escape und ein Klick neben den Dialog lassen alles unverändert.
- **AC-2** Alle zwölf Rückfragen sind gleich aufgebaut: die sechs aus AC-1 und dazu Einsatz löschen, Konto löschen, ETB-Eintrag annullieren, Stärkemeldung annullieren, Gesamtstärke melden, Standard-Ausschnitt festlegen. Der Titel nennt die Aktion, der Text die Folge, rechts unten stehen „Abbrechen“ und ein Bestätigungsknopf, der das Verb der Aktion trägt. Der Bestätigungsknopf ist rot, nur bei „Gesamtstärke melden“ und „Standard-Ausschnitt festlegen“ nicht. Titel, Texte und Knöpfe der sechs neuen Rückfragen und der Rückfrage „Standard-Ausschnitt festlegen“ stehen unter „Agreed design“.
- **AC-3** Während eine bestätigte Aktion läuft, zeigt der Bestätigungsknopf einen Ladezustand, „Abbrechen“ ist gesperrt, der Dialog lässt sich nicht schließen, und ein weiterer Tap auf den Bestätigungsknopf löst die Aktion nicht ein zweites Mal aus.
- **AC-4** Scheitert eine bestätigte Aktion, bleibt der Dialog offen und zeigt die Fehlermeldung im Dialog. Das gilt auch für einen unerwarteten Abbruch, dann mit der Meldung „Das hat nicht geklappt. Bitte erneut versuchen.“ Das Objekt ist unverändert, und man kann erneut bestätigen oder abbrechen.
- **AC-5** Nach Erfolg schließt sich die Rückfrage. Beim Löschen von Kartenzeichen und Bereich schließt sich auch deren Dialog, beim Löschen eines Bild-Overlays endet dessen Bearbeiten-Modus. Nach „Gerätelink neu generieren“ bleibt der Kartenzeichen-Dialog offen und zeigt den neuen Link samt QR-Code. Nach „Einsatz löschen“ landet man wie bisher in der Einsatzübersicht.
- **AC-6** Bricht man die Rückfrage zum Löschen eines Kartenzeichens, zum Löschen eines Bereichs oder zu „Gerätelink neu generieren“ ab – mit „Abbrechen“, Escape oder einem Klick neben die Rückfrage –, schließt sich nur die Rückfrage, und man ist wieder im darunterliegenden Dialog. Dort ist alles wie vorher, auch noch nicht gespeicherte Eingaben.
- **AC-7** In der Zeile eines Ansichtslinks gibt es keine Inline-Bestätigung mehr.
- **AC-8** Hat ein Kartenzeichen noch keinen Gerätelink, wird „Gerätelink erzeugen“ ohne Rückfrage ausgeführt.
- **AC-9** Scheitert „Einsatz löschen“ oder „Konto löschen“, steht die Fehlermeldung im Dialog. Die Seite bricht nicht ab, und es erscheint keine Meldung oberhalb der Kontenliste.
- **AC-10** Bei 390×844 und bei 1280×800 ist jede Rückfrage vollständig sichtbar, und beide Knöpfe sind erreichbar. Ein Name aus 80 Zeichen ohne Leerzeichen, etwa beim KML-Overlay oder beim Ansichtslink, wird im Titel umgebrochen. Er wird nicht abgeschnitten, und die Seite scrollt nicht horizontal.

## Agreed design
Jede der zwölf Aktionen öffnet ein gemeinsames Bestätigungs-Modal. Wo die
Aktion aus einem Dialog heraus ausgelöst wird (Kartenzeichen, Bereich), liegt
die Rückfrage über diesem Dialog.

Titel, Texte und Knöpfe der sechs neuen Rückfragen und von „Standard-Ausschnitt festlegen“. Maßgeblich für die Texte ist diese Tabelle; das Specimen zeigt nur Ablauf und Aufbau.

| Aktion | Titel | Text | Bestätigungsknopf |
|---|---|---|---|
| Kartenzeichen löschen | Kartenzeichen löschen | Das Kartenzeichen verschwindet von der Lagekarte, ein Gerätelink wird ungültig. Das lässt sich nicht rückgängig machen. | Endgültig löschen |
| Bereich löschen | Bereich löschen | Der Bereich verschwindet von der Lagekarte. Das lässt sich nicht rückgängig machen. | Endgültig löschen |
| Bild-Overlay löschen | Bild-Overlay löschen | Das Bild wird mit seiner Datei gelöscht. Das lässt sich nicht rückgängig machen. | Endgültig löschen |
| KML-Overlay entfernen | KML-Overlay „‹Name›“ entfernen | Um es wieder anzuzeigen, muss die Datei oder URL neu eingebunden werden. | Entfernen |
| Ansichtslink löschen | Ansichtslink „‹Name›“ löschen | Wer diesen Link hat, sieht die Lage sofort nicht mehr. | Endgültig löschen |
| Gerätelink neu generieren | Gerätelink neu generieren | Der bisherige Link funktioniert sofort nicht mehr. Das Gerät muss den neuen Link öffnen. | Neu generieren |
| Standard-Ausschnitt festlegen | Standard-Ausschnitt festlegen | Der aktuelle Kartenausschnitt wird zum Standard-Ausschnitt dieses Einsatzes. | Festlegen (nicht rot) |

Die Texte der übrigen fünf bestehenden Rückfragen bleiben, wie sie sind.

Specimen: https://claude.ai/artifact/CHLhgXPTF7sEAbrBUJtRqp, Kopie in
`specimens/bestaetigungs-modal.html`.

**Agreed; build to this, do not redesign.**

## Nudges
- Das `ConfirmationModal` aus `src/strength/StrengthPanel.tsx` kommt in eine eigene Datei, und alle zwölf Rückfragen nutzen es. Die von Hand gebauten Rückfragen in `JournalPanel`, `MapControls`, `UserAdminPanel` und `OperationLifecycleActions` entfallen.
- Die Lösch-Callbacks liefern ihr `ActionResult` direkt an die Rückfrage. Die Fehler- und Ladezustands-Behandlung fürs Löschen wandert aus `runDetail`, `runArea` und `deleteImage` in `SituationWorkspace` in die Rückfrage.
- `deleteViewLinkAction` läuft über `operationAction` und liefert `ActionResult`. Das ist der Lösch-Teil von Punkt 4 in `REFACTORING.md`.
- `deleteOperationAction` liefert im Fehlerfall ein `ActionResult`. Das `catch` der Rückfrage darf die Weiterleitung nach Erfolg nicht verschlucken.
- `onGenerateDeviceLink` liefert sein `ActionResult` an die Rückfrage, statt fire-and-forget zu sein. Der Kommentar zur Fehler-Politik in `SituationWorkspace` wird entsprechend angepasst.
- Punkt 1 wird aus `REFACTORING.md` entfernt. Punkt 4 wird auf `createViewLinkAction` gekürzt.

## Out of scope
- Lage und Auffälligkeit der Lösch-Knöpfe: Sie bleiben, wo und wie sie sind.
- `createViewLinkAction`: Sie bleibt, wie sie ist (Rest von Punkt 4 in `REFACTORING.md`).
- Verhalten, wenn das Objekt anderswo gelöscht wird, während seine Rückfrage offen ist. Es wird nicht eigens gebaut oder getestet.

## Ruled out
- **Sofort ausführen mit „Rückgängig“-Hinweis:** Braucht serverseitiges Soft-Delete bzw. Wiederherstellen samt Dateien und Live-Zwischenzustand. Für Gerätelink und Einsatz passt es nicht, also stünden am Ende zwei Muster nebeneinander.
- **Zweistufiger Knopf („Wirklich löschen?“ an derselben Stelle):** Das ist eine Inline-Bestätigung, und die wurde am 2026-09-27 beim ETB schon abgelehnt. Außerdem schützt sie schlecht gegen einen doppelten Fehl-Tap.
- **KML-Overlay ohne Rückfrage entfernen:** Eine hochgeladene Datei ist am Handy oft nicht mehr griffbereit. Ohne Ausnahme bleibt die Regel einfach.
