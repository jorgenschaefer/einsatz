---
criteria:  CRITERIA.md
closes:    AC-1, AC-2, AC-4, AC-5, AC-6, AC-8, AC-10, AC-11
advances:
after:     01-benachrichtigungen-fuer-die-panels, 02-bild-overlay-platzierung-springt-zurueck
status:    done
attempts:  1
---

## Build
Kartenaktionen melden ihren Fehler als Benachrichtigung „Karte“ statt unten
auf der Karte. Jeder Übergang eines Kartenmodus schließt sie, außer das
Ausblenden der Karte; ein Fehler schließt das Blatt am Handy nicht mehr.
Damit melden alle vier Quellen über Benachrichtigungen, und dieses Ticket
prüft zum Schluss, dass Formulare, Editoren und Dialoge inline geblieben sind.

## Done when
> **AC-1** Scheitert eine Aktion im KML-, Bild-Overlay- oder Ansichtslink-Panel oder eine Kartenaktion (Kartenzeichen platzieren, Bereich zeichnen, Bereich neu zeichnen, Kreis verschieben), erscheint ihre Meldung als Benachrichtigung – am Handy oben mittig, am Desktop oben rechts über der Karte –, sichtbar ohne Scrollen, egal wie weit das Panel gescrollt ist. Sie liegt unter der Kopfzeile und verdeckt keines ihrer Bedienelemente (Status, Verbindungsanzeige, „Teilen“, Menü); am Desktop verdeckt sie die Seitenleiste nicht. Über dem Panel und unten auf der Karte steht keine Meldung mehr.

> **AC-2** Der Titel der Benachrichtigung nennt die Quelle („KML-Ebenen“, „Bild-Overlays“, „Ansichtslinks“, „Karte“), ihr Text ist die bisherige Meldung.

> **AC-4** Je Quelle steht höchstens eine Benachrichtigung. Sie schließt sich, sobald man in derselben Quelle etwas Neues beginnt – KML: Datei wählen, Sichtbarkeit schalten, „Neu laden“, „Per URL einbinden“, „Entfernen“ öffnen, Entfernen bestätigen; Bild-Overlays: Datei wählen, Sichtbarkeit schalten, „Bearbeiten“, eine neue Platzierung wird gespeichert (Ende einer Verschieben-, Skalieren- oder Drehen-Geste), Deckkraft ändern, „Ersetzen“, „Löschen“ bestätigen, „Fertig“; Ansichtslinks: „Ansichtslink erzeugen“, Löschen-Rückfrage öffnen, Löschen bestätigen; Karte: ein Kartenmodus beginnt oder wird beendet (Kartenzeichen scharf schalten, Zeichnen oder Neu zeichnen beginnen, Kreis „Verschieben“, Bild „Bearbeiten“, „Abbrechen“, „Fertig“, „Hier setzen“) oder ein Kartenzeichen wird gesetzt. Endet ein Kartenmodus nur, weil die Karte ausgeblendet wird (am Handy Wechsel zu ETB oder Stärke, Fenster schmaler als 48 em), bleibt die Benachrichtigung „Karte“ stehen. Eine Meldung, die eintrifft, während eine Rückfrage offen ist, schließt erst das Bestätigen; bis dahin ist sie zu sehen (AC-7).

> **AC-5** Eine Benachrichtigung bleibt stehen, wenn man in einer anderen Quelle etwas beginnt, in „Name“, „KML-/KMZ-URL“ oder „Bezeichnung“ tippt, die Karte verschiebt oder zoomt, ein Panel öffnet, schließt oder wechselt, den Dialog „Ansichtslinks teilen“ schließt oder am Handy zwischen Karte und ETB wechselt.

> **AC-6** Gelingt eine Aktion, erscheint keine Benachrichtigung.

> **AC-8** Ist die Sitzung abgelaufen und man löst eine dieser Aktionen aus, erscheint die Anmeldeseite, ohne dass vorher eine Benachrichtigung zu sehen ist.

> **AC-10** Scheitert am Handy eine Kartenaktion, bleibt ein offenes Blatt offen.

> **AC-11** Formulare, Editoren und Dialoge zeigen ihre Fehler weiter in sich: der Bild-Overlay-Editor für Deckkraft und Ersetzen, der Bereich-Editor, der Kartenzeichen-Dialog, die Rückfragen zum Entfernen und Löschen, das Stärke-Panel, die ETB-Eingabe, die Anmeldung, die Passwortänderung, das Formular für einen neuen Einsatz und die Nutzerverwaltung. Ebenso bleibt der Hinweis „Kopieren nicht möglich – …“ im Ansichtslink- und im Gerätelink-Panel, wo er ist.

## Nudges
> Ein gemeinsamer Hook ersetzt die Meldung in `useActionRunner` und `useMapActionError`: feste Notification-ID und Titel je Quelle, `notifications.hide(id)` beim Start, `notifications.show({ id, title, message, color: "red", autoClose: false })` bei einem Fehler.

> `MapErrorAlert` und das Schließen des Blatts in `useMapActionError` entfallen; `ErrorAlert` bleibt für das Stärke-Panel und die ETB-Eingabe.

> Das Schließen der Karten-Benachrichtigung hängt an den Übergängen von `useMapMode`, nicht an den einzelnen Knöpfen; das Zurücksetzen über `onMapHidden` in `useMainView` schließt sie nicht.

> Tests rendern `<Notifications />` im Test-Wrapper und prüfen über `role="alert"`.

## Context
- **Nach Ticket 01:** `showActionError`, `closeActionError`
  (`src/app/action-notification.ts`), `settleAction`
  (`src/app/action-failure.ts`), die Quelle `KARTE`
  (`src/map/notification-sources.ts`), `<ActionNotifications />` im Layout und
  im Test-Wrapper, der Store wird nach jedem Test geleert. Die drei Panels
  melden über Benachrichtigungen; `SituationWorkspace` schließt beim Unmount
  alle vier Quellen, auch `KARTE`. **Nach Ticket 02:** der Bild-Overlay-Editor
  meldet Platzierungs-Fehler als „Bild-Overlays“; Deckkraft und Ersetzen
  bleiben inline.
- **Karte heute:** `useMapActionError(closeSheetOnPhone)`
  (`src/map/useMapActionError.ts`) hält `mapError`; `runMapAction` leert ihn
  beim Start, zeigt einen zurückgegebenen `{error}` oder `ACTION_FAILED`, zeigt
  nichts bei einer Navigation und schließt beim Zeigen am Handy das Blatt.
  `SituationWorkspace` zeigt `mapError` über `MapErrorAlert` unten auf der
  Karte. `runMapAction` nutzen `useSymbolPlacement.placeSymbolAt`,
  `useAreaFlows.handleDrawComplete` und `setCircleHere`. Platzieren und
  Zeichnen rufen `mode.reset()` **vor** `runMapAction`; ihr Fehler kommt also
  erst, wenn kein Modus mehr läuft.
- **Modus:** `useMapMode` (`src/map/useMapMode.ts`) dispatcht alle Übergänge
  (`armQuick`, `armCustom`, `armImageEdit`, `toggleDraw`, `redraw`,
  `armMoveCircle`, `endMoveCircle`, `reset`). `useMainView`
  (`src/map/useMainView.ts`, Zeile ~55) ruft `onMapHidden`, sobald die Karte
  verschwindet; `SituationWorkspace` übergibt dafür `mode.reset`. In
  `SituationWorkspace` wird `useMapMode` vor `useMapActionError` erzeugt.
- **Bestehende Tests:** `src/map/SituationWorkspace.panels.test.tsx:512`
  („closes it when a map action fails, so the error is not hidden under it“)
  pinnt das Verhalten, das AC-10 umkehrt. `SituationWorkspace.map-actions.test.tsx`
  (149 Zeilen), `.areas.test.tsx` (738) und `.symbols.test.tsx` prüfen den
  Alert unten auf der Karte. `areas.test.tsx` und `panels.test.tsx` sind groß:
  Erwartungen dort anpassen, neue Tests in neue Dateien.
- **AC-11:** Tests mit Inline-Alert gibt es für `UserAdminPanel`,
  `ConfirmationModal`, `JournalPanel.*` (ETB-Eingabe), `AreaEditor`,
  `AreaEditorModal`, `SymbolDetailModal`, `ImageOverlayEditor`,
  `StrengthPanel`, `ViewLinkPanel` und `DeviceLinkPanel` (Kopier-Hinweis).
  `LoginForm.test.tsx`, `ChangePasswordForm.test.tsx` und
  `NewOperationForm.test.tsx` gibt es; ob sie den Fehler-Alert prüfen, ist
  nachzusehen. Keiner dieser Codepfade wird hier geändert.

## Plan
1. **AC-Tests zuerst, rot.** Neue Datei
   `src/map/SituationWorkspace.map-notification.test.tsx`:
   - Kartenzeichen platzieren scheitert (`{error}` und Wurf) → Benachrichtigung
     „Karte“ mit der Meldung, unten auf der Karte nichts (AC-1, AC-2); ein
     Erfolg zeigt keine (AC-6); ein Redirect-Fehler zeigt keine (AC-8).
   - „Kreis verschieben“ → „Hier setzen“ scheitert → Benachrichtigung;
     „Abbrechen“ schließt sie. Je ein Fall: Kartenzeichen scharf schalten,
     Zeichnen beginnen, Bild „Bearbeiten“, „Fertig“ schließen sie (AC-4).
   - Bleibt stehen: Karte verschieben/zoomen (Fake-Adapter `onViewChange`),
     Panel öffnen/wechseln, KML-Aktion, am Handy (`match-media` auf schmal)
     Wechsel zu ETB und zurück – auch wenn dabei ein Modus scharf war (AC-5,
     AC-4 letzter Satz).
   - Am Handy mit offenem Blatt scheitert eine Kartenaktion → das Blatt bleibt
     offen (AC-10).
   Beweis: rot.
2. **Map-Hook umstellen.** `src/map/useMapActionError.ts` baut auf
   `useNotifyingActionRunner(KARTE)` aus Ticket 01 (derselbe Hook wie die
   Panels, wie die Nudge es will): `runMapAction` ist dessen `run`,
   `closeMapError` dessen `closeError`; kein eigener Zustand, kein
   `closeSheetOnPhone`-Parameter. Die Aufrufer prüfen das Ergebnis wie
   bisher (`created?.id`, `result && !result.error`); ein geworfener Fehler
   kommt nun als `{ error }` statt `undefined` zurück, und `undefined`/`null`
   heißt Navigation.
   Doc-Kommentar anpassen. Beweis: Teil 1 des Tests aus Schritt 1.
3. **`MapErrorAlert` entfernen.** `src/map/MapErrorAlert.tsx` löschen,
   Verwendung in `src/map/SituationWorkspace.tsx` raus. Beweis:
   `grep -rn MapErrorAlert src` leer; `npx tsc --noEmit`.
4. **Übergänge schließen.** `src/map/useMapMode.ts`: `useMapMode({ onTransition })`
   ruft `onTransition` bei jedem Übergang, den der Nutzer auslöst; neuer
   Übergang `hideMap` (wie `reset`, ohne `onTransition`) als
   `endForHiddenMap()`. Ebenso ohne `onTransition`: das Ende des
   Kreis-Verschiebens, weil der Kreis anderswo gelöscht wurde (der
   `useEffect` in `src/map/useAreaFlows.ts`, Zeile ~104) – sonst schlösse
   der nächste Refresh genau die Benachrichtigung, die erklärt, warum „Hier
   setzen“ scheiterte; etwa `endMoveCircle(id, { quiet: true })` oder ein
   eigener Übergang. Test dazu in der Datei aus Schritt 1: „Hier setzen“
   scheitert, der Kreis verschwindet aus `areas` → die Benachrichtigung
   bleibt.
   `SituationWorkspace`: `useMapActionError()` vor `useMapMode` erzeugen,
   `onTransition: closeMapError`, `useMainView({ onMapHidden:
   mode.endForHiddenMap })`. Beweis: Tests aus Schritt 1 (Schließen, Stehen-
   bleiben beim Ausblenden); `src/map/useMapMode.test.ts` um `hideMap` (endet
   wie `reset`) und um `onTransition` (gerufen bei jedem Übergang außer
   `hideMap`) ergänzen.
5. **Bestehende Tests umstellen.** `.map-actions`, `.areas`, `.symbols`:
   Erwartungen an den Alert unten auf der Karte auf die Benachrichtigung;
   `.map-actions` „closes the failure at the map with its ד bleibt mit dem
   „ד der Benachrichtigung. `.panels.test.tsx:512` auf AC-10 umkehren („keeps
   the sheet open when a map action fails“). Beweis: `npm test` grün.
6. **AC-11 prüfen.** Für jede in AC-11 genannte Stelle einen Test finden, der
   den Fehler im Formular/Editor/Dialog erwartet (Liste in Context); wo keiner
   ist (wahrscheinlich bei `LoginForm`, `ChangePasswordForm`,
   `NewOperationForm`), einen ergänzen: Fehler → `role="alert"` innerhalb des
   Formulars. Beweis: die Tests; `npm test` grün.
7. **Im Browser** (`run-einsatz`), Handy 360 px und Desktop: Kartenzeichen
   platzieren bei gestopptem Server oder per Netzwerk-Sperre scheitern lassen
   → Benachrichtigung unter der Kopfzeile (Menü, Status, Verbindungsanzeige,
   „Teilen“ frei), am Desktop links der Seitenleiste; dazu eine gescheiterte
   KML-URL: beide stehen untereinander (AC-1). Beweis: Screenshots, in
   `## Left standing` vermerkt, weil kein Test die Lage prüft.

## Not here
- Die Panels und die Position der Benachrichtigungen: Ticket 01 (hier nur
  im Browser mitgeprüft).
- Der Bild-Overlay-Editor und das Zurückspringen: Ticket 02.
- Fehler in Ansichts- und Geräteansicht bleiben wie sie sind (Out of scope).
- Erfolgsmeldungen gibt es nicht (Out of scope).

## Left standing

**Review-Befunde, nicht behoben**

- *`runMapAction` liefert `R | ActionResult | null`* (Review 2, Nit). Deshalb
  braucht `useAreaFlows.handleDrawComplete` die Prüfung `"id" in created`, wo
  vorher `created?.id` reichte. Der Typ kommt von `settleAction` und
  `useNotifyingActionRunner` aus Ticket 01. Eine Änderung dort betrifft alle
  Panels, und es gibt bisher nur diesen einen Aufrufer, der ein Feld aus dem
  Ergebnis liest.
- Weiter offen wie in Ticket 01 und 02 vermerkt: Die Benachrichtigung „Karte“
  verdeckt am Handy das Modus-Band (etwa „Hier setzen“/„Abbrechen“) und das
  Suchfeld. Im ETB verdeckt sie am Handy die Kopfzeile des ersten Eintrags
  (Review 2). Alle drei Punkte folgen aus der vereinbarten Position.

**Ohne automatischen Test geprüft**

- AC-1: Die Lage im Fenster lässt sich in jsdom nicht messen. Die Tests prüfen
  nur, dass die Meldung als Benachrichtigung „Karte“ erscheint und nicht mehr
  in `.map-area` steht. Die Reviewer haben das im Browser geprüft, jeweils
  offline:
  - *360 px:* oben mittig ab y 52 (die Kopfzeile endet bei 40); Menü und
    Status bleiben frei.
  - *1680 px und 1920 px:* oben rechts links der Seitenleiste (bei 1920 px
    x 1108–1548, die Seitenleiste beginnt bei 1560), unter der Kopfzeile;
    „Teilen“ und Status bleiben frei. Zusammen mit einer gescheiterten
    KML-URL standen beide Benachrichtigungen untereinander.
  - *700 px:* geprüft. Das Fenster wurde schmal, dann wieder breit; danach
    stand die Benachrichtigung weiter.
  - *Aktionen:* Kartenzeichen platzieren, „Hier setzen“ und „Form neu
    zeichnen“. „Bereich zeichnen“ wurde nur in den Tests scheitern gelassen.
    Am Handy ließ sich per Touch kein Kreis zeichnen; die Abläufe mit dem
    Kreis wurden deshalb nur am Desktop gefahren.
- AC-8: Die Tests prüfen, dass keine Benachrichtigung erscheint. Dass danach
  die Anmeldeseite kommt, hat der Reviewer im Browser mit gelöschten Cookies
  gesehen.
- AC-4, „Fenster schmaler als 48 em“: Kein eigener Test. Das Ausblenden am
  Handy (Wechsel zu ETB) läuft im Test über denselben Weg (`onMapHidden` →
  `endForHiddenMap`). Den Wechsel der Fensterbreite hat der Reviewer im
  Browser gefahren.

**Abweichungen vom Plan**

- Schritt 4: Es gibt keine neue Reducer-Aktion `hideMap`. `endForHiddenMap`
  dispatcht `reset`, ruft aber `onTransition` nicht. Eine eigene Aktion wäre
  im Reducer eine Kopie von `reset`.
- Schritt 4: `endMoveCircle` ist immer still, ohne Option `quiet`. Es wird nur
  an zwei Stellen gerufen: nach einem gespeicherten „Hier setzen“ (dort hat
  `runMapAction` die Benachrichtigung beim Start schon geschlossen) und wenn
  der Kreis anderswo gelöscht wurde (dort muss sie stehen bleiben).
- Schritt 1: Der Test für AC-10 steht nicht in der neuen Datei. Er ist der
  umgedrehte Test in `SituationWorkspace.panels.test.tsx` („keeps it open when
  a map action fails“). Die neue Datei hatte ihn zuerst auch, das wäre doppelt
  gewesen.
- Schritt 5: Der Test „shows a placement error as an overlay inside the map
  container“ in `.symbols.test.tsx` ist gelöscht. Ersetzt wird er durch „shows
  a failed map action as a notification titled Karte, not on the map“.
- Schritt 6: In Tests rendert der Wrapper die Benachrichtigungen ohne Portal
  in denselben Container. Ein `getByRole("alert")` kann eine Meldung im
  Formular deshalb nicht von einer Benachrichtigung unterscheiden (Review 1).
  Darum steckt `src/test/render.tsx` die Benachrichtigungen jetzt in
  `data-testid="notifications"` und exportiert `notificationArea()`. Die Tests
  zu AC-11 prüfen, dass der Fehler nicht dort liegt, wenn sie ihn nicht schon
  in ihrem Dialog oder Formular suchen. Das betrifft Anmeldung,
  Passwortänderung, neuen Einsatz, Nutzerverwaltung, Bereich-Editor (Modal und
  Formular), Kartenzeichen-Dialog, Stärke-Panel und die beiden
  Kopier-Hinweise.
- TDD, Schritt 6: Diese Tests ändern kein Verhalten und waren von Anfang an
  grün. Rot wurde nur geprüft, indem `LoginForm` versuchsweise über eine
  Benachrichtigung meldete; danach schlug der Test fehl. Die übrigen nutzen
  dieselbe Prüfung.
- `useMapMode.test.ts` prüft `onTransition` am Hook über einen Mock. Dass die
  Benachrichtigung bei jedem dieser Übergänge sichtbar schließt, prüft
  `SituationWorkspace.map-notification.test.tsx`. Ausnahmen sind „Erweitert …“
  und das Abwählen der Schnellauswahl: Sie laufen über dieselbe Funktion
  `transition`, sind dort aber nicht eigens gefahren.

Von den Nudges bin ich nicht abgewichen.
