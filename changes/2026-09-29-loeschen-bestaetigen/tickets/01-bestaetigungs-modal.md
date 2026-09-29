---
criteria:  CRITERIA.md
closes:
advances:  AC-2, AC-3, AC-4, AC-10
after:
status:    ready
attempts:  0
---

## Build
Das `ConfirmationModal` bekommt eine eigene Datei und meldet einen unerwarteten Abbruch mit „Das hat nicht geklappt. Bitte erneut versuchen.“. Die vier bestehenden Rückfragen, die schon ein `ActionResult` liefern – Stärkemeldung annullieren, Gesamtstärke melden, ETB-Eintrag annullieren, Standard-Ausschnitt festlegen –, laufen darüber; „Standard-Ausschnitt festlegen“ bekommt Titel und Text aus der Tabelle.

## Done when
- AC-2, für diese vier Rückfragen: Titel nennt die Aktion, Text die Folge, rechts unten „Abbrechen“ und ein Bestätigungsknopf mit dem Verb der Aktion; rot bei den beiden Annullierungen, nicht rot bei „Gesamtstärke melden“ und „Standard-Ausschnitt festlegen“. „Standard-Ausschnitt festlegen“ hat Titel „Standard-Ausschnitt festlegen“, Text „Der aktuelle Kartenausschnitt wird zum Standard-Ausschnitt dieses Einsatzes.“ und Knopf „Festlegen“.
- AC-3, am `ConfirmationModal` selbst und an diesen vier Rückfragen: Während die Action läuft, zeigt der Bestätigungsknopf einen Ladezustand, „Abbrechen“ ist gesperrt, Escape und ein Klick neben den Dialog schließen ihn nicht, und ein zweiter Tap löst die Action nicht erneut aus.
- AC-4, am `ConfirmationModal` selbst und an diesen vier Rückfragen: Ein zurückgegebener `{error}` steht im offenen Dialog; eine geworfene Ausnahme zeigt „Das hat nicht geklappt. Bitte erneut versuchen.“ im offenen Dialog; danach lässt sich erneut bestätigen oder abbrechen.
- AC-10, für diese vier Rückfragen: bei 390×844 und 1280×800 vollständig sichtbar, beide Knöpfe erreichbar; ein 80 Zeichen langer Stellenname ohne Leerzeichen wird im Titel „… annullieren“ umgebrochen, die Seite scrollt nicht horizontal.

## Toward
> **AC-2** Alle zwölf Rückfragen sind gleich aufgebaut: die sechs aus AC-1 und dazu Einsatz löschen, Konto löschen, ETB-Eintrag annullieren, Stärkemeldung annullieren, Gesamtstärke melden, Standard-Ausschnitt festlegen. Der Titel nennt die Aktion, der Text die Folge, rechts unten stehen „Abbrechen“ und ein Bestätigungsknopf, der das Verb der Aktion trägt. Der Bestätigungsknopf ist rot, nur bei „Gesamtstärke melden“ und „Standard-Ausschnitt festlegen“ nicht. Titel, Texte und Knöpfe der sechs neuen Rückfragen und der Rückfrage „Standard-Ausschnitt festlegen“ stehen unter „Agreed design“.

> **AC-3** Während eine bestätigte Aktion läuft, zeigt der Bestätigungsknopf einen Ladezustand, „Abbrechen“ ist gesperrt, der Dialog lässt sich nicht schließen, und ein weiterer Tap auf den Bestätigungsknopf löst die Aktion nicht ein zweites Mal aus.

> **AC-4** Scheitert eine bestätigte Aktion, bleibt der Dialog offen und zeigt die Fehlermeldung im Dialog. Das gilt auch für einen unerwarteten Abbruch, dann mit der Meldung „Das hat nicht geklappt. Bitte erneut versuchen.“ Das Objekt ist unverändert, und man kann erneut bestätigen oder abbrechen.

> **AC-10** Bei 390×844 und bei 1280×800 ist jede Rückfrage vollständig sichtbar, und beide Knöpfe sind erreichbar. Ein Name aus 80 Zeichen ohne Leerzeichen, etwa beim KML-Overlay oder beim Ansichtslink, wird im Titel umgebrochen. Er wird nicht abgeschnitten, und die Seite scrollt nicht horizontal.

## Nudges
> Das `ConfirmationModal` aus `src/strength/StrengthPanel.tsx` kommt in eine eigene Datei, und alle zwölf Rückfragen nutzen es. Die von Hand gebauten Rückfragen in `JournalPanel`, `MapControls`, `UserAdminPanel` und `OperationLifecycleActions` entfallen.

## Context
Das `ConfirmationModal` steht heute als private Funktion in `src/strength/StrengthPanel.tsx` (ab Zeile ~385). Es kann schon fast alles, was AC-3 und AC-4 verlangen: `pending` sperrt „Abbrechen“ und `close`, der Bestätigungsknopf hat `loading` (Mantine sperrt ihn dabei, das verhindert den zweiten Tap), der Fehler steht als `Alert role="alert"` im Dialog, bei Erfolg ruft es `onClose`. Der Titel bricht schon um (`styles={{ title: { minWidth: 0, overflowWrap: "anywhere" } }}`). Den Fehler fängt es über `runAction` aus derselben Datei, dessen Fallback „Speichern fehlgeschlagen. Bitte erneut versuchen.“ ist – der ändert sich für die Rückfrage auf den Text aus AC-4. `runAction` bleibt in `StrengthPanel.tsx`, weil `NameForm` es weiter nutzt; das Modal bekommt sein eigenes `try/catch`.

Die handgebauten Rückfragen dieses Tickets:
- `src/app/operations/[id]/JournalPanel.tsx`: eigenes `Modal` (Zeile ~305) mit `annulTarget`, `annulPending`, `annulError`, `annul`, `closeAnnulConfirmation`. Titel `Eintrag #N annullieren`, Text „Der Eintrag bleibt durchgestrichen im Einsatztagebuch stehen. Das lässt sich nicht rückgängig machen.“, Knopf „Annullieren“ rot. Titel und Text bleiben.
- `src/map/MapControls.tsx`: eigenes `Modal` mit `saving`/`saveError`/`saveDefault`. Heute Titel „Aktuellen Ausschnitt als Standard festlegen?“, kein Text, Knopf „Festlegen“ (nicht rot); „Abbrechen“ ist während des Speicherns nicht gesperrt.

`StrengthPanel` nutzt das Modal zweimal (Stärkemeldung annullieren rot, Gesamtstärke melden nicht rot); dort ändert sich nur der Import.

Neue Datei: `src/app/ConfirmationModal.tsx`, neben `src/app/BackLink.tsx`, dem anderen seitenübergreifenden Baustein. `ActionResult` kommt aus `src/app/operations/[id]/action-result.ts`. Props bleiben wie heute (`opened`, `onClose`, `title`, `confirmLabel`, `confirmColor?`, `onConfirm: () => Promise<ActionResult>`, `children`).

Die Specimen-Datei `specimens/bestaetigungs-modal.html` zeigt Ablauf und Aufbau; die Texte stehen in der Tabelle unter „Agreed design“ und sind oben unter „Done when“ zitiert.

Tests rendern mit `render` aus `@/test/render`. `src/test/fail-on-console.ts` lässt Tests scheitern, die etwas auf die Konsole schreiben.

## Plan
1. **Modal-Tests zuerst, rot.** Neue Datei `src/app/ConfirmationModal.test.tsx`: (a) eine geworfene Ausnahme zeigt „Das hat nicht geklappt. Bitte erneut versuchen.“ im offenen Dialog – rot, weil der Fallback heute „Speichern fehlgeschlagen …“ ist; (b) ein zurückgegebener `{error}` steht im Dialog, der Dialog bleibt offen, ein zweites Bestätigen ruft `onConfirm` erneut; (c) während `onConfirm` hängt (nicht aufgelöstes Promise), ist „Abbrechen“ gesperrt, Escape und ein Klick auf das Overlay schließen nicht, ein zweiter Klick auf den Bestätigungsknopf ruft `onConfirm` nicht erneut; (d) „Abbrechen“, Escape und Klick aufs Overlay rufen `onClose` und nicht `onConfirm`; (e) bei Erfolg wird `onClose` gerufen. (b)–(e) laufen nach dem Umzug grün, (a) bleibt rot bis Schritt 3. Zuerst den Test gegen einen Export aus der neuen Datei schreiben, der noch fehlt – das ist kein RED; RED ist erst die Meldungs-Assertion aus (a) nach Schritt 2.
2. **Umziehen.** `ConfirmationModal` aus `src/strength/StrengthPanel.tsx` nach `src/app/ConfirmationModal.tsx` verschieben, exportieren, `StrengthPanel.tsx` importiert es. Beweis: `src/strength/StrengthPanel.test.tsx` bleibt grün, (b)–(e) werden grün.
3. **Fallback-Meldung.** Das Modal fängt selbst (`try/catch` um `onConfirm`) und zeigt „Das hat nicht geklappt. Bitte erneut versuchen.“. Beweis: (a) grün. Die Erwartung in `StrengthPanel.test.tsx` „shows a failed annulment in the still open confirmation“ (Zeile ~1398) ändert sich auf den neuen Text; die übrigen „Speichern fehlgeschlagen“-Erwartungen dort gehören zu Formularen und bleiben. Wie „shows a failed report as an error“ (Zeile ~574) über die Gesamtstärke-Rückfrage läuft, prüfen und gegebenenfalls anpassen.
4. **ETB-Eintrag annullieren.** In `JournalPanel.tsx` das eigene Annullieren-Modal samt `annulPending`, `annulError`, `annul`, `closeAnnulConfirmation` durch `ConfirmationModal` ersetzen (`title={`Eintrag #${annulTarget?.number} annullieren`}`, `confirmLabel="Annullieren"`, `confirmColor="red"`, `onConfirm={() => onAnnul(annulTarget.id)}`, Text unverändert). Zuerst in `JournalPanel.test.tsx` die Erwartung aus „surfaces a save error in the still open confirmation when annulling fails“ (Zeile ~468) auf „Das hat nicht geklappt. Bitte erneut versuchen.“ ändern – rot –, dann umbauen. Beweis: alle Annullier-Tests in `JournalPanel.test.tsx` grün, insbesondere „annuls only once on a double click“ und „keeps the confirmation open while the annulment is in flight“.
5. **Standard-Ausschnitt festlegen.** Zuerst in `src/map/MapControls.test.tsx` Tests für den neuen Titel „Standard-Ausschnitt festlegen“, den Text „Der aktuelle Kartenausschnitt wird zum Standard-Ausschnitt dieses Einsatzes.“ und das gesperrte „Abbrechen“ während des Speicherns (rot), die Fallback-Erwartung in „shows a fallback when saving throws“ auf den neuen Text. Dann in `MapControls.tsx` das eigene `Modal` samt `saving`, `saveError`, `saveDefault`, `askToSaveDefault` durch `ConfirmationModal` ersetzen (`confirmLabel="Festlegen"`, ohne `confirmColor`). Der Kommentar über `MapControls` („erst nach Rückfrage“) bleibt richtig. Beweis: `MapControls.test.tsx` grün; `SituationWorkspace.test.tsx` „saves the current map view as the default after confirming“ (Zeile ~1078) grün, gegebenenfalls an den neuen Titel angepasst.
6. **Im Browser prüfen (AC-10).** Mit dem Skill `run-einsatz` bei 390×844 und 1280×800 alle vier Rückfragen öffnen; für die Stärkemeldung eine Stelle mit 80 Zeichen ohne Leerzeichen anlegen. Beweis: Screenshots; `document.documentElement.scrollWidth <= innerWidth` per Playwright-`evaluate`, Titel umgebrochen, beide Knöpfe sichtbar.
7. `npm run check` grün.

Entschieden, was sich später schwer ändern lässt: Pfad und Name `src/app/ConfirmationModal.tsx`, gegen den die Tickets 02–07 importieren; Props-Form wie heute (Ticket 02 ergänzt `stackId?`).

## Not here
- Die sechs neuen Rückfragen (Kartenzeichen, Gerätelink, Bereich, Bild-Overlay, KML-Overlay, Ansichtslink): Tickets 02–05.
- Einsatz löschen und Konto löschen, und was das Modal bei der Weiterleitung nach „Einsatz löschen“ tun muss: Tickets 06 und 07.
- Ein allgemeiner Hook für „beschäftigt/Fehler“ (Punkt 7 in `REFACTORING.md`) und die übrigen `SAVE_ERROR`-Stellen in `JournalPanel` und `StrengthPanel` für Anlegen und Korrigieren: bleiben.
- `REFACTORING.md` anpassen: Tickets 05 und 07.
