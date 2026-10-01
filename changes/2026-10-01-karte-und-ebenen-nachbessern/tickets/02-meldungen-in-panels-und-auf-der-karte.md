---
criteria:  CRITERIA.md
closes:    AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7
advances:
after:
status:    done
attempts:  1
---

## Build
Die Fehlermeldungen im Bild-Overlay-, KML- und Ansichtslink-Panel bekommen ein
„×“ und verschwinden, sobald man dort etwas Neues beginnt. Kartenaktionen
zeigen bei einem unerwarteten Fehler denselben Text wie alle anderen und bei
abgelaufener Sitzung keine Meldung. Der KML-Sichtbarkeits-Schalter ist
gesperrt, solange eine Aktion des KML-Panels läuft.

## Done when
> **AC-1** Im Bild-Overlay-, KML- und Ansichtslink-Panel hat die Fehlermeldung über dem Panel ein „×“; ein Klick darauf entfernt sie. Gemeint ist die Meldung über der Liste, nicht die im Editor eines Bild-Overlays.

> **AC-2** Die Meldung eines Panels verschwindet, sobald man darin etwas Neues beginnt – Bild-Overlay: Datei wählen, Sichtbarkeit schalten, „Bearbeiten“; KML: Datei wählen, Sichtbarkeit schalten, „Neu laden“, „Per URL einbinden“, „Entfernen“ öffnen; Ansichtslinks: „Ansichtslink erzeugen“, Löschen-Rückfrage öffnen.

> **AC-3** Solange eine Aktion eines Panels läuft, steht dort keine Meldung einer früheren Aktion. Scheitert sie, erscheint ihre Meldung; gelingt sie, keine.

> **AC-4** Tippen in „Name“, „KML-/KMZ-URL“ oder „Bezeichnung“ lässt eine stehende Meldung stehen.

> **AC-5** Scheitert Kartenzeichen platzieren, Bereich zeichnen, Bereich neu zeichnen oder Kreis verschieben unerwartet (die Action wirft), steht unten auf der Karte „Das hat nicht geklappt. Bitte erneut versuchen.“.

> **AC-6** Ist die Sitzung abgelaufen und man löst eine dieser Kartenaktionen aus, erscheint die Anmeldeseite, ohne dass vorher eine Meldung auf der Karte zu sehen ist.

> **AC-7** Solange eine Aktion des KML-Panels läuft (Einbinden per Datei oder URL, „Neu laden“, Sichtbarkeit schalten), sind die Sichtbarkeits-Schalter aller KML-Overlays gesperrt – wie die der Bild-Overlays.

## Nudges
> `run` in `useActionRunner` leert die Meldung beim Start; für Schritte außerhalb von `run` („Bearbeiten“, „Entfernen“ bzw. Löschen-Rückfrage öffnen, eine Datei wählen, deren Lesen scheitert) rufen die Panels selbst `setError(null)`.

> `runMapAction` in `src/map/SituationWorkspace.tsx` nutzt `ACTION_FAILED` und `isNextNavigation` aus `src/app/action-failure.ts`, keinen eigenen Text.

> Im `KmlPanel` bekommt der Schalter `disabled={busy}` wie im `ImageOverlayPanel`.

## Context
- **`src/app/useActionRunner.ts`**: hält `busy` und `error` für ein Panel.
  `run` setzt `busy`, wartet die Action ab und setzt `error` erst danach. Bis
  dahin steht eine alte Meldung weiter da. Wirft die Action einen
  Next-Navigationsfehler (`isNextNavigation`), liefert `run` `null`, zeigt
  nichts und bleibt `busy`. Gibt `setError` heraus.
- **Vorbild `src/strength/StrengthPanel.tsx`**: roter `Alert` mit
  `role="alert"`, `withCloseButton` und `onClose={() => setError(null)}`; die
  Meldung wird beim Öffnen anderer Formulare geleert.
- **`src/map/ImageOverlayPanel.tsx`**: `Alert` ohne „×“ über der Liste. Datei
  wählen und Sichtbarkeits-Schalter laufen über `run`. „Bearbeiten“ ruft nur
  `onEdit(overlay.id)`. Der Schalter hat schon `disabled={busy}`. Der Editor
  eines Overlays (`renderEditor`, `ImageOverlayEditor`) hat eine eigene
  Meldung aus `SituationWorkspace` (`imageError`); sie ist nicht Teil dieses
  Tickets.
- **`src/map/KmlPanel.tsx`**: `Alert` ohne „×“. `addFile` liest die Datei
  zuerst (`extractKml`) und setzt bei einem Lesefehler die Meldung direkt per
  `setError`, erst danach `run`. „Per URL einbinden“, „Neu laden“ und der
  Schalter laufen über `run`. „Entfernen“ öffnet eine `ConfirmationModal`
  (`setRemoveTarget`, `setRemoveAsked`), die das Entfernen selbst ausführt;
  `remove` leert die Panel-Meldung nach Erfolg. Der Schalter hat **kein**
  `disabled`.
- **`src/map/ViewLinkPanel.tsx`**: `Alert` ohne „×“. „Ansichtslink erzeugen“
  läuft über `run`. Der Löschen-Knopf einer Zeile ruft `onAskDelete`, das
  `setDeleteTarget` und `setDeleteAsked(true)` setzt. `setError` wird heute
  nicht aus dem Hook geholt. Die rote Zeile „Kopieren nicht möglich …“ in
  `ViewLinkRow` ist eine eigene Meldung und bleibt, wie sie ist.
- **`src/map/SituationWorkspace.tsx`, `runMapAction`** (etwa Zeile 322):
  leert `mapError` beim Start, zeigt einen zurückgegebenen `error`, fängt
  jede Ausnahme und zeigt „Aktion fehlgeschlagen. Bitte erneut versuchen.“,
  auch bei einem Redirect. Aufrufer: `placeSymbolAt`, `handleDrawComplete`
  (Zeichnen und Neu zeichnen), `setCircleHere` (Kreis verschieben). Die
  Map-Meldung hat schon ein „×“.
- **`src/app/action-failure.ts`**: `ACTION_FAILED` („Das hat nicht
  geklappt. Bitte erneut versuchen.“) und `isNextNavigation`.
- **Testhilfen**: `redirectError()` aus `src/test/redirect-error`, `render`
  aus `src/test/render` (Mantine ohne Transitions). Die Panels haben eigene
  Tests (`ImageOverlayPanel.test.tsx`, `KmlPanel.test.tsx`,
  `ViewLinkPanel.test.tsx`). Für die Karte gibt es
  `SituationWorkspace.symbols.test.tsx` (Platzieren, ab Zeile ~55) und
  `SituationWorkspace.areas.test.tsx` (Zeichnen ~85, Kreis verschieben ~392
  bis ~420).
- **Tests, die sich mit diesem Ticket ändern**:
  - `SituationWorkspace.areas.test.tsx` „a thrown save keeps moving and shows
    the fallback error“ erwartet „Aktion fehlgeschlagen“, und
    `SituationWorkspace.symbols.test.tsx` „surfaces a fallback when placing
    throws instead of returning an {error}“ erwartet `/fehlgeschlagen/i`.
    Beide erwarten künftig den Text aus AC-5. `grep -rn "fehlgeschlagen" src/map`
    findet weitere, falls es sie gibt.
  - `KmlPanel.test.tsx` „keeps an earlier panel error when the removal
    fails“ widerspricht AC-2: Das Öffnen von „Entfernen“ leert die Meldung.
    Er wird so umgeschrieben, dass er die Meldung des gescheiterten
    Entfernens im Dialog prüft und dass die frühere Panel-Meldung weg ist.
  - „clears an earlier panel error once the overlay is removed“ bleibt
    sinngemäß wahr.

## Plan
1. **Red: der Hook leert beim Start (AC-3).** In
   `src/app/useActionRunner.test.ts`: Nach `setError("Früherer Fehler.")`
   und dem Start einer Action, die nicht zurückkommt, ist `error` `null` und
   `busy` `true`. Beweis: rot.
2. **`run` leert die Meldung beim Start**: `setError(null)` neben
   `setBusy(true)` in `src/app/useActionRunner.ts`; den Doc-Kommentar
   anpassen. Beweis: Test aus 1 grün, die übrigen Hook-Tests grün.
3. **Red: „×“ und Leeren in den Panels (AC-1 bis AC-4), wo die Nutzerin
   handelt.**
   - `ImageOverlayPanel.test.tsx`: Eine Meldung (z. B. scheiterndes
     `onAdd`) verschwindet mit Klick auf den Knopf „Meldung schließen“
     (AC-1); verschwindet mit „Bearbeiten“ und mit
     einem Klick auf den Schalter (AC-2); ist weg, solange eine zweite,
     hängende Datei-Auswahl läuft, und steht wieder, wenn sie scheitert
     (AC-3).
   - `KmlPanel.test.tsx`: Meldung (z. B. „Neu laden“ liefert einen Fehler)
     schließt mit „×“ (AC-1); verschwindet mit Datei wählen (auch, wenn das
     Lesen der neuen Datei klappt und `onAddFile` hängt), Schalter, „Neu
     laden“, „Per URL einbinden“ und dem Öffnen von „Entfernen“ (AC-2);
     bleibt beim Tippen in „Name“ und „KML-/KMZ-URL“ stehen (AC-4).
     Den Test „keeps an earlier panel error when the removal fails“ wie im
     Kontext beschrieben umschreiben.
   - `ViewLinkPanel.test.tsx`: Meldung nach gescheitertem Erzeugen schließt
     mit „×“ (AC-1); verschwindet beim nächsten „Ansichtslink erzeugen“, auch
     solange es läuft, und beim Öffnen der Löschen-Rückfrage (AC-2/AC-3);
     bleibt beim Tippen in „Bezeichnung“ (AC-4).
   Beweis: rot, bis auf die Fälle, die schon über `run` laufen.
4. **Panels anpassen**:
   - Alle drei `Alert`s: `withCloseButton`, `closeButtonLabel="Meldung schließen"`
     wie in `src/journal/EntryForm.tsx`, `onClose={() => setError(null)}` (in `ImageOverlayPanel` und `ViewLinkPanel` `setError` aus dem Hook
     holen).
   - `ImageOverlayPanel`: „Bearbeiten“ ruft `setError(null)` vor `onEdit`.
   - `KmlPanel`: `addFile` ruft `setError(null)` als Erstes; der
     Entfernen-Knopf ruft `setError(null)` beim Öffnen. Die Zeile
     `if (!result.error) setError(null);` in `remove` bleibt: Sie leert die
     Meldung einer Aktion, die vor dem Öffnen des Dialogs begann und
     scheiterte, während er offen war.
   - `ViewLinkPanel`: `onAskDelete` ruft `setError(null)`.
   Beweis: alle Tests aus 3 grün.
5. **Red: KML-Schalter gesperrt (AC-7).** `KmlPanel.test.tsx`: Solange
   „Neu laden“ bzw. „Per URL einbinden“ hängt, sind die Schalter aller
   KML-Zeilen `disabled`, und ein Klick ruft `onToggleVisibility` nicht.
   Nach einem hängenden Schalter-Klick ist der Schalter der anderen Zeile
   gesperrt. Beweis: rot.
6. **`disabled={busy}`** am `Switch` in `KmlPanel.tsx`. Beweis: Test aus 5
   grün.
7. **Red: Kartenaktionen (AC-5, AC-6).** In
   `SituationWorkspace.symbols.test.tsx` und
   `SituationWorkspace.areas.test.tsx`: Wirft `onPlace`, `onCreateArea`,
   `onUpdateAreaGeometry` (Neu zeichnen und Kreis verschieben), steht
   „Das hat nicht geklappt. Bitte erneut versuchen.“ im `alert` (AC-5); den
   vorhandenen Tests, die „fehlgeschlagen“ erwarten (siehe Kontext),
   entsprechend ändern. Wirft
   eine davon `redirectError()`, gibt es kein `alert` (AC-6). Beweis: rot.
8. **`runMapAction`**: im `catch` bei `isNextNavigation(thrown)` ohne
   Meldung `undefined` zurückgeben, sonst `showMapError(ACTION_FAILED)`.
   Imports aus `@/app/action-failure`. Den Kommentar über `runMapAction`
   anpassen. Beweis: Tests aus 7 grün.
9. **Im Browser prüfen** (Skill `run-einsatz`): eine KML-URL, die 404
   liefert, einbinden → Meldung mit „×“; „Neu laden“ einer anderen Zeile →
   Meldung weg; im Bild-Overlay-Teil eine ungültige Datei wählen, dann
   „Bearbeiten“ → Meldung weg. Am Handy (360 px) passt das „×“ in die Zeile
   ohne waagerechtes Scrollen.
10. `npm run check` grün.

## Not here
- Die Meldung im Editor eines Bild-Overlays (`ImageOverlayEditor`) – out of
  scope, sie wird schon beim Öffnen und Schließen des Editors geleert.
- Bild-Overlay nach fehlgeschlagenem Speichern zurückspringen lassen
  (`bild-overlay-springt-bei-fehler-nicht-zurueck`) – out of scope.
- KML-URLs ablehnen, die kein KML liefern (`kml-url-ohne-kml-ablehnen`) –
  out of scope.
- Andere Fehlertexte – out of scope; nur der Text aus AC-5 ändert sich.
- Der Kreis für KML-Punkte ist Ticket 03, die Server-Seite Ticket 04.

## Left standing
- Abweichung vom Nudge zu `addFile` (KML): `addFile` ruft nicht selbst
  `setError(null)`, sondern liest die Datei jetzt innerhalb von `run`
  (`readKml` liefert bei einem Lesefehler `{ error }`). Grund: Der Review fand,
  dass die Schalter während des Lesens einer großen KMZ nicht gesperrt waren
  (AC-7). So sperrt `busy` auch das Lesen, und `run` leert die Meldung beim
  Start. Der Text bei einem Lesefehler ist unverändert.
- Über den Plan hinaus: Die Datei-Eingaben im KML- und im Bild-Overlay-Panel
  sind gesperrt, solange eine Aktion des Panels läuft (`disabled={busy}`).
  Grund: Beide Panels teilen ein `busy` je Panel. Eine zweite, überlappende
  Aktion gab die Schalter frei und leerte oder überschrieb die Meldung der
  ersten, obwohl diese noch lief (AC-3, AC-7). Beide Reviews haben das im
  Browser nachgestellt.
- Abweichung vom Plan, Schritt 7: Die Tests für Werfen und Redirect der vier
  Kartenaktionen stehen in der neuen Datei
  `src/map/SituationWorkspace.map-actions.test.tsx`, nicht in
  `SituationWorkspace.symbols.test.tsx` und `SituationWorkspace.areas.test.tsx`
  (409 bzw. 757 Zeilen). Die beiden Tests dort, die nur den Ersatztext beim
  Werfen von Platzieren und Zeichnen prüften, sind entfallen, weil die neue
  Datei sie abdeckt. „a thrown save keeps moving …“ und „does not open the
  editor when creating throws“ bleiben und erwarten jetzt den Text aus AC-5.
- Nicht übernommene Review-Meldung: Der erste Review riet, die Zeile
  `if (!result.error) setError(null);` in `remove` (KmlPanel) zu streichen.
  Sonst wischt ein erfolgreiches Entfernen eine Meldung weg, die eintraf,
  während der Dialog offen war. Ein Beispiel: „Neu laden“ scheitert hinter
  dem Dialog. Diese Meldung wäre dann nie zu sehen gewesen (Spannung zu
  AC-3). Die Zeile bleibt, weil der Plan sie genau dafür vorsieht. Sie ist
  jetzt durch den Test „clears a failure that arrived while the confirmation
  was open once the overlay is removed“ gepinnt. Bei der Abnahme bitte
  entscheiden, ob das so gewollt ist.
- Plan, Schritt 9: Den Browser habe ich nicht selbst geprüft. Das haben beide
  Reviews getan (360 px und 1280/1920 px): „×“ in allen drei Panels, passt bei
  360 px ohne waagerechtes Scrollen, Leeren nach AC-2/AC-4, Sperren der
  KML-Schalter und der Datei-Eingabe, Text aus AC-5 unten auf der Karte. Die
  Fehler wurden dafür durch abgefangene oder verzögerte Server-Action-Anfragen
  erzeugt, nicht durch eine echte KML-URL mit 404.
- AC-6 ist im Test bis zur Grenze zu Next bewiesen: Wirft eine der vier
  Kartenaktionen einen Redirect-Fehler, erscheint keine Meldung. Dass danach
  die Anmeldeseite kommt, übernimmt Next selbst. Mit abgelaufener Sitzung hat
  das niemand im Browser geprüft.
- AC-1 „passt am Handy“: Dafür gibt es keinen automatischen Test, nur die
  Prüfung im Browser durch die Reviews (siehe oben).
- Nebenwirkung außerhalb des Tickets: Auch der Editor eines Bild-Overlays
  nutzt `useActionRunner`. Seine Meldung verschwindet jetzt ebenfalls beim
  Start eines neuen Speicherns. Der Review hat das als passend bewertet, es
  ist aber nicht eigens getestet.
