---
criteria:  CRITERIA.md
closes:    AC-3, AC-7, AC-9
advances:  AC-1, AC-2, AC-4, AC-5, AC-6, AC-8
after:
status:    ready
attempts:  0
---

## Build
Die Fehler des KML-, des Bild-Overlay- und des Ansichtslink-Panels erscheinen
als Benachrichtigung statt als `ErrorAlert` über dem Panel: eine je Quelle,
mit der Quelle als Titel, ohne automatisches Schließen, geschlossen von der
nächsten Aktion derselben Quelle oder ihrem „ד. Dazu kommen der gemeinsame
Hook, die vier Quellen und das eine `<Notifications />` der Lageansicht an
seinem vereinbarten Platz.

## Done when
> **AC-3** Eine Benachrichtigung schließt sich nie von selbst; ihr „ד schließt sie.

> **AC-7** Eine Benachrichtigung, die erscheint, während eine Rückfrage (Entfernen, Löschen) offen ist, ist über dem Dialog zu sehen und lässt sich dort schließen.

> **AC-9** Verlässt man die Lageansicht, etwa zur Einsatzliste, ist keine ihrer Benachrichtigungen mehr zu sehen.

Von den ACs unter `## Toward` wird hier wahr:

- AC-1 für die drei Panels: Scheitert eine Aktion im KML-, Bild-Overlay- oder
  Ansichtslink-Panel, erscheint ihre Meldung als Benachrichtigung unter der
  Kopfzeile (Handy oben mittig, Desktop oben rechts über der Karte, links der
  Seitenleiste); über den Panels steht keine Meldung mehr. Die Karte meldet
  noch wie bisher.
- AC-2 für die Titel „KML-Ebenen“, „Bild-Overlays“ und „Ansichtslinks“.
- AC-4 für die Quellen KML und Ansichtslinks vollständig, für Bild-Overlays mit
  Datei wählen, Sichtbarkeit schalten und „Bearbeiten“.
- AC-5 für die Panel-Quellen: Tippen in „Name“, „KML-/KMZ-URL“ und
  „Bezeichnung“, Aktionen einer anderen Panel-Quelle und das Schließen des
  Dialogs „Ansichtslinks teilen“ lassen eine Benachrichtigung stehen.
- AC-6 und AC-8 für die drei Panels.

## Toward
> **AC-1** Scheitert eine Aktion im KML-, Bild-Overlay- oder Ansichtslink-Panel oder eine Kartenaktion (Kartenzeichen platzieren, Bereich zeichnen, Bereich neu zeichnen, Kreis verschieben), erscheint ihre Meldung als Benachrichtigung – am Handy oben mittig, am Desktop oben rechts über der Karte –, sichtbar ohne Scrollen, egal wie weit das Panel gescrollt ist. Sie liegt unter der Kopfzeile und verdeckt keines ihrer Bedienelemente (Status, Verbindungsanzeige, „Teilen“, Menü); am Desktop verdeckt sie die Seitenleiste nicht. Über dem Panel und unten auf der Karte steht keine Meldung mehr.

> **AC-2** Der Titel der Benachrichtigung nennt die Quelle („KML-Ebenen“, „Bild-Overlays“, „Ansichtslinks“, „Karte“), ihr Text ist die bisherige Meldung.

> **AC-4** Je Quelle steht höchstens eine Benachrichtigung. Sie schließt sich, sobald man in derselben Quelle etwas Neues beginnt – KML: Datei wählen, Sichtbarkeit schalten, „Neu laden“, „Per URL einbinden“, „Entfernen“ öffnen, Entfernen bestätigen; Bild-Overlays: Datei wählen, Sichtbarkeit schalten, „Bearbeiten“, eine neue Platzierung wird gespeichert (Ende einer Verschieben-, Skalieren- oder Drehen-Geste), Deckkraft ändern, „Ersetzen“, „Löschen“ bestätigen, „Fertig“; Ansichtslinks: „Ansichtslink erzeugen“, Löschen-Rückfrage öffnen, Löschen bestätigen; Karte: ein Kartenmodus beginnt oder wird beendet (Kartenzeichen scharf schalten, Zeichnen oder Neu zeichnen beginnen, Kreis „Verschieben“, Bild „Bearbeiten“, „Abbrechen“, „Fertig“, „Hier setzen“) oder ein Kartenzeichen wird gesetzt. Endet ein Kartenmodus nur, weil die Karte ausgeblendet wird (am Handy Wechsel zu ETB oder Stärke, Fenster schmaler als 48 em), bleibt die Benachrichtigung „Karte“ stehen. Eine Meldung, die eintrifft, während eine Rückfrage offen ist, schließt erst das Bestätigen; bis dahin ist sie zu sehen (AC-7).

> **AC-5** Eine Benachrichtigung bleibt stehen, wenn man in einer anderen Quelle etwas beginnt, in „Name“, „KML-/KMZ-URL“ oder „Bezeichnung“ tippt, die Karte verschiebt oder zoomt, ein Panel öffnet, schließt oder wechselt, den Dialog „Ansichtslinks teilen“ schließt oder am Handy zwischen Karte und ETB wechselt.

> **AC-6** Gelingt eine Aktion, erscheint keine Benachrichtigung.

> **AC-8** Ist die Sitzung abgelaufen und man löst eine dieser Aktionen aus, erscheint die Anmeldeseite, ohne dass vorher eine Benachrichtigung zu sehen ist.

## Nudges
> Ein gemeinsamer Hook ersetzt die Meldung in `useActionRunner` und `useMapActionError`: feste Notification-ID und Titel je Quelle, `notifications.hide(id)` beim Start, `notifications.show({ id, title, message, color: "red", autoClose: false })` bei einem Fehler.

> Die Position des einen `<Notifications />` hängt am Breakpoint `48em` wie das Layout der Lageansicht: oben mittig bzw. oben rechts, nach unten versetzt um die Höhe der Kopfzeile und am Desktop nach links um die Breite der Seitenleiste. Sein z-Index liegt über dem der Modals.

> `SituationWorkspace` schließt beim Unmount die IDs seiner Quellen (AC-9).

> Tests rendern `<Notifications />` im Test-Wrapper und prüfen über `role="alert"`.

## Context
- **Heute:** `useActionRunner` (`src/app/useActionRunner.ts`) hält `busy` und
  `error` für ein Panel; `run` leert die Meldung beim Start, zeigt
  `ACTION_FAILED` bei einer geworfenen Ausnahme und zeigt nichts bei einer
  Navigation (`isNextNavigation` in `src/app/action-failure.ts`). Benutzt wird
  er von `KmlPanel`, `ImageOverlayPanel`, `ViewLinkPanel` und
  `useImageOverlayEditing` (dem Bild-Overlay-Editor). Die Panels zeigen
  `error` über `ErrorAlert` (`src/app/ErrorAlert.tsx`) oben im Panel; für
  Schritte außerhalb von `run` rufen sie `setError(null)` („Entfernen“ öffnen,
  „Bearbeiten“, Löschen-Rückfrage öffnen). `KmlPanel.remove` und
  `ViewLinkPanel.deleteLink` leeren die Meldung nach erfolgreichem Entfernen.
- **Der Editor bleibt inline:** `useImageOverlayEditing` behält in diesem
  Ticket seinen `useActionRunner` unverändert (Ticket 02 baut ihn um).
  `useActionRunner` bleibt deshalb bestehen.
- **Mantine-Notifications:** `@mantine/notifications` 9.6.3 ist installiert,
  `<Notifications />` steht heute ohne Props in `src/app/layout.tsx`, sonst
  nutzt niemand die Notifications. Zwei Eigenheiten des Stores
  (`node_modules/@mantine/notifications/esm/notifications.store.mjs`):
  `notifications.show` mit einer schon vorhandenen ID tut **nichts**, deshalb
  vor dem Zeigen `hide(id)`. Der Store ist global; Tests müssen ihn nach jedem
  Test leeren (`notifications.clean()`). Der Default-z-Index der
  Notifications ist 400 (`getDefaultZIndex("overlay")`), der der Modals 200 –
  AC-7 braucht also keinen eigenen z-Index. Die Karte ist über
  `.map-area { isolation: isolate }` gekapselt; ihre Panes liegen nicht über
  der Benachrichtigung.
- **Layout:** `LageansichtShell` (`src/app/operations/[id]/LageansichtShell.tsx`)
  hat `HEADER_HEIGHT = { base: 40, sm: 56 }`; der Header wechselt bei
  Mantines `sm` (48 em). Das Ansichtslink-Panel steht im Modal „Ansichtslinks
  teilen“ derselben Shell. Die Seitenleiste ist am Desktop 360 px breit
  (`grid-template-columns: minmax(0, 1fr) 360px` in
  `src/map/situation-workspace.css`, ab 48 em). `SituationWorkspace` rendert
  die Shell und ist ihr Besitzer.
- **Agreed design** (Specimen, Alternative 1 „Top“:
  [Artifact](https://claude.ai/artifact/5ncUehbzsViBCHbUwujbs8),
  `changes/2026-10-02-ebenen-und-meldungen-nachbessern/specimens/benachrichtigung-specimen.html`):
  rote Mantine-Benachrichtigung, Titel = Quelle, Text = die bisherige Meldung,
  „ד zum Schließen, eine je Quelle, unter der Kopfzeile – am Handy oben
  mittig, am Desktop oben rechts über der Karte, links neben der Seitenleiste.
  Formulare, Editoren und Dialoge behalten ihre Meldung inline; das
  Ansichtslink-Panel steht zwar im Dialog „Ansichtslinks teilen“, zählt aber
  als Panel und meldet über eine Benachrichtigung. **Agreed; build to this,
  do not redesign.**
- **Neue Begriffe:** „Benachrichtigung“ und „Quelle“ (einer Benachrichtigung)
  gibt es im Glossar noch nicht; sie kommen in `UBIQUITOUS_LANGUAGE.md`, im
  Code heißen sie `notification` und `NotificationSource`.
- **Große Testdateien:** `src/map/KmlPanel.test.tsx` (666 Zeilen) und
  `src/map/SituationWorkspace.panels.test.tsx` (648) wachsen nicht; bestehende
  Erwartungen werden dort angepasst, neue Tests kommen in neue Dateien.

## Plan
1. **AC-Tests zuerst, rot.** Neue Datei
   `src/map/KmlPanel.notification.test.tsx`: Scheitert „Neu laden“, steht eine
   Benachrichtigung mit Titel „KML-Ebenen“ und der Meldung im Dokument,
   außerhalb des Panels (nicht `within` des Panels); sie ist nach 10 s
   Fake-Timer noch da (AC-3); ihr „Meldung schließen“ schließt sie; ein
   zweiter Fehlschlag ergibt nicht zwei Benachrichtigungen; „Neu laden“
   erneut, gelingt → keine Benachrichtigung; Tippen in „Name“ lässt sie stehen.
   AC-7: Rückfrage „Entfernen“ offen, ein laufendes „Neu laden“ scheitert →
   die Benachrichtigung ist zu sehen, solange der Dialog offen ist, und ihr
   „ד schließt sie; Bestätigen schließt sie ebenfalls. Gleiches für
   `src/map/ViewLinkPanel.notification.test.tsx` (Titel „Ansichtslinks“,
   Löschen-Rückfrage) und `src/map/ImageOverlayPanel.notification.test.tsx`
   (Titel „Bild-Overlays“, „Bearbeiten“ schließt). Redirect-Fehler
   (`redirectError()` aus `src/test/redirect-error.ts`) → keine
   Benachrichtigung (AC-8). Beweis: `npx vitest run src/map/*.notification.test.tsx` rot.
2. **Test-Wrapper.** `src/test/render.tsx`: `Providers` rendert
   `<Notifications />` (aus `@mantine/notifications`; ab Schritt 7
   `<ActionNotifications />`) im `MantineProvider`;
   `src/test/setup.ts`: `afterEach` ruft `notifications.clean()`. Beweis: ein
   Probetest zeigt eine Notification und findet sie über `role="alert"`;
   `npm test` bleibt sonst unverändert.
3. **Gemeinsame Abwicklung einer Action.** In `src/app/action-failure.ts`
   eine Funktion `settleAction(action): Promise<ActionResult | null>`, die
   heute in `useActionRunner.run` steckt (wirft → `{ error: ACTION_FAILED }`,
   Navigation → `null`). `useActionRunner` nutzt sie. Beweis:
   `src/app/useActionRunner.test.ts` grün, ohne Änderung.
4. **Quellen und Hook.** Neu `src/app/action-notification.ts`:
   `NotificationSource = { id: string; title: string }`,
   `showActionError(source, message)` (`hide(id)`, dann `show({ id, title,
   message, color: "red", autoClose: false, closeButtonProps: { "aria-label":
   "Meldung schließen" } })`) und `closeActionError(source)`. Neu
   `src/app/useNotifyingActionRunner.ts`: `{ busy, run, closeError }`; `run`
   ruft `closeActionError` beim Start und `showActionError` bei `error`, nutzt
   `settleAction`. `run` ist generisch über das Ergebnis
   (`run<R extends ActionResult>(action: () => Promise<R>): Promise<R |
   ActionResult | null>`), weil Ticket 03 `useMapActionError` auf denselben
   Hook stellt (die Karte braucht etwa `{ id }` aus `onCreateArea`). Neu `src/map/notification-sources.ts` mit
   `KML_EBENEN`, `BILD_OVERLAYS`, `ANSICHTSLINKS`, `KARTE` (Titel wie AC-2)
   und `LAGEANSICHT_SOURCES` (alle vier). Beweis: neue
   `src/app/useNotifyingActionRunner.test.tsx` (Start schließt, Fehler zeigt,
   Erfolg zeigt nichts, Navigation zeigt nichts und bleibt `busy`).
5. **Panels umstellen.** `src/map/KmlPanel.tsx`, `src/map/ImageOverlayPanel.tsx`,
   `src/map/ViewLinkPanel.tsx`: `useNotifyingActionRunner(<Quelle>)` statt
   `useActionRunner`, `ErrorAlert` raus, `setError(null)` → `closeError()`.
   `KmlPanel.remove` und `ViewLinkPanel.deleteLink` rufen `closeError()` zu
   Beginn (Bestätigen ist eine neue Aktion) statt nach Erfolg; ihr Fehler
   bleibt im Dialog (`ConfirmationModal`), wie bisher. Beweis: die Tests aus
   Schritt 1 grün.
6. **Bestehende Tests anpassen.** In `src/map/KmlPanel.test.tsx`,
   `ImageOverlayPanel.test.tsx`, `ViewLinkPanel.test.tsx`,
   `SituationWorkspace.layers.test.tsx` und `SituationWorkspace.panels.test.tsx`
   Erwartungen an den Alert über dem Panel auf die Benachrichtigung umstellen
   (meist reicht `screen.findByRole("alert")`, weil sie im Dokument steht).
   Der Test „clears a failure that arrived while the confirmation was open
   once the overlay is removed“ gilt weiter, nun weil Bestätigen schließt;
   Name anpassen. Beweis: `npm test` grün.
7. **Position.** Neu `src/app/lageansicht-sizes.ts` mit `HEADER_HEIGHT`
   (zieht aus `LageansichtShell` hierher, die Shell importiert es) und
   `SIDEBAR_WIDTH = 360` (Kommentar: dieselbe Breite wie in
   `src/map/situation-workspace.css`). Neu `src/app/ActionNotifications.tsx`
   (Client): `<Notifications position={desktop ? "top-right" : "top-center"}
   … />` mit `useIsDesktop()` (`src/map/useIsDesktop.ts`, `null` gilt als
   Handy), `top` = Kopfzeile + Abstand und am Desktop `right` =
   `SIDEBAR_WIDTH` + Abstand. Mantines Wurzel ist `width: calc(100% - 2·md);
   max-width: 440px` (`@mantine/notifications/styles.css`); am Desktop die
   Breite auf die Kartenfläche begrenzen (`max-width: calc(100% -
   SIDEBAR_WIDTH - 2·Abstand)`), sonst ragt sie bei 768–830 px links aus
   dem Fenster. Es ersetzt das
   `<Notifications />` in `src/app/layout.tsx` (es bleibt das eine; nur die
   Lageansicht zeigt Benachrichtigungen) und wird auch in `Providers`
   (Schritt 2) gerendert. Nicht in die Shell legen: dann stünde jede
   Benachrichtigung in Workspace-Tests doppelt. Beweis: `npm run check`; im
   Browser (`run-einsatz`) bei 360 px und am Desktop ein gescheitertes „Per
   URL einbinden“ mit `http://localhost/` – die Benachrichtigung liegt unter
   der Kopfzeile, Menü/Teilen/Status frei, am Desktop links der Seitenleiste
   und auch bei 800 px Fensterbreite ganz im Fenster.
8. **Verlassen der Lageansicht (AC-9).** `SituationWorkspace` schließt im
   Cleanup eines `useEffect` alle `LAGEANSICHT_SOURCES`. Beweis: Test in neuer
   Datei `src/map/SituationWorkspace.notifications.test.tsx`: Benachrichtigung
   zeigen, Workspace unmounten → keine `role="alert"` mehr. In derselben
   Datei die Fälle aus AC-5 für eine Panel-Benachrichtigung (KML-„Neu laden“
   scheitert): eine Aktion im Bild-Overlay-Panel, Wechsel des Panels am
   Desktop (das KML-Panel wird dabei ausgehängt), Schließen des Blatts am
   Handy, am Handy Wechsel zu ETB und zurück lassen sie stehen; ebenso
   bleibt eine Benachrichtigung „Ansichtslinks“ nach dem Schließen des
   Dialogs „Ansichtslinks teilen“ stehen.
9. **Glossar.** `UBIQUITOUS_LANGUAGE.md`: Einträge **Benachrichtigung**
   (`notification`) und **Quelle einer Benachrichtigung**
   (`NotificationSource`: KML-Ebenen, Bild-Overlays, Ansichtslinks, Karte)
   im Stil der übrigen. Der Eintrag grenzt ab: „Quelle“ allein heißt in der
   KML-Ebene die Herkunft des Inhalts (`KmlSourceType`, `sourceUrl`), und
   am ETB-Eintrag ist „Quelle“ unter den zu meidenden Aliassen; im Code
   deshalb nie nur `source`, sondern `notificationSource` bzw.
   `NotificationSource`.
   Beweis: Lesen; `npm run check` grün.

## Not here
- Die Karte (`useMapActionError`, `MapErrorAlert`, Schließen beim
  Moduswechsel, Blatt bleibt offen): Ticket 03.
- Der Bild-Overlay-Editor (Platzierungs-Fehler als Benachrichtigung, Deckkraft,
  Ersetzen, Löschen, Fertig, Zurückspringen): Ticket 02.
- `ErrorAlert` bleibt; Stärke-Panel und ETB-Eingabe nutzen es weiter.
- Kein Objektname im Titel, keine Erfolgsmeldungen (Out of scope).

## Left standing
