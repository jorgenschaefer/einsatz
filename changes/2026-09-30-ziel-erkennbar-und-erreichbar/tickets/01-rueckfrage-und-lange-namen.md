---
criteria:  CRITERIA.md
closes:    AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8
advances:
after:
status:    done
attempts:  0
---

## Build
Die Rückfrage „Einsatz löschen“ nennt den Einsatz im Titel; alle Dialoge
bekommen einen halbfetten Titel mit Zeilenabstand und ein Schließen-X auf
Höhe der ersten Titelzeile; die Knöpfe der Rückfragen werden 44 px hoch; die
Zeilen im Ebenen-Panel brechen lange Namen um, statt das Panel zu verbreitern.

## Done when
Anführungszeichen in den ACs grenzen nur Texte der Oberfläche ab. Welche
Anführungszeichen die Oberfläche selbst zeigt, legen sie nicht fest.

> **AC-1** „Einsatz löschen“ im Menü „⋯“ einer Karte in `/operations` öffnet eine Rückfrage, deren Titel den Namen des Einsatzes dieser Karte nennt.

> **AC-2** Text und Knöpfe dieser Rückfrage bleiben: „Dieser Einsatz wird mit seinem gesamten Einsatztagebuch und allen Kartenobjekten unwiderruflich gelöscht.“, „Abbrechen“ und „Endgültig löschen“. Bestätigen löscht den Einsatz weiterhin, Abbrechen lässt ihn bestehen.

> **AC-3** Bei einem Einsatznamen aus 80 Zeichen ohne Leerzeichen bricht der Titel bei 390×844 und bei 1280×800 innerhalb des Dialogs um; der Dialog scrollt nicht seitlich, und beide Knöpfe sind ohne seitliches Scrollen sichtbar und antippbar.

> **AC-4** Im Ebenen-Panel mit je einer KML-Datei, einer KML-URL und einem Bild-Overlay, deren Namen aus 80 Zeichen ohne Leerzeichen bestehen: Bei 390×844 und bei 1280×800 scrollt das Panel nicht seitlich, jeder Name ist vollständig zu sehen (umgebrochen, nicht mit „…“ gekürzt), und Schalter sowie die Knöpfe „Entfernen“, „Neu laden“ und „Bearbeiten“ liegen im Panel und sind ohne seitliches Scrollen antippbar.

> **AC-5** Eine KML-Datei, eine KML-URL und ein Bild-Overlay mit dem Namen „Strecke“ stehen im Ebenen-Panel bei 390×844 und bei 1280×800 je in einer einzeiligen Zeile: Schalter, Name und Knöpfe nebeneinander wie bisher.

> **AC-6** In jedem Dialog der App ist der Titel halbfett, und bricht er auf mehrere Zeilen um, haben die Zeilen sichtbaren Abstand zueinander.

> **AC-7** In jeder Rückfrage (`ConfirmationModal`) sind „Abbrechen“ und der Bestätigungsknopf bei jeder Breite mindestens 44 px hoch.

> **AC-8** Knöpfe in den übrigen Dialogen, etwa „Speichern“ im Kartenzeichen-Dialog, behalten ihre bisherige Höhe.

## Nudges
> `OperationLifecycleActions` bekommt den Namen des Einsatzes als neue Prop; `OperationsOverview` reicht ihn durch.

> Den Titel nach dem Muster der KML-Rückfrage in `KmlPanel` bilden, also Gegenstand, Name in Anführungszeichen, Verb.

> Den Titel-Stil (Gewicht, Zeilenhöhe, `minWidth: 0`, `overflowWrap: "anywhere"`) einmal für `Modal` in `theme.ts` setzen und die `styles`-Prop in `ConfirmationModal`, die das heute dort tut, entfernen. Im selben Zug den Kopf des Dialogs oben ausrichten, damit das Schließen-X bei umbrechendem Titel nicht in die Mitte rutscht.

> Die 44 px an den beiden Knöpfen in `ConfirmationModal` setzen, nicht per Theme an `Button`.

> In den Zeilen des Ebenen-Panels (`KmlPanel`, `ImageOverlayPanel`) `miw={0}` und `overflowWrap: "anywhere"` am Label des Schalters, wie in `UserAdminPanel` und `OperationsOverview`; die Zeile oben ausrichten (`align="flex-start"`).

> AC-1 mit einem Testing-Library-Test pinnen. AC-3 bis AC-8 im Browser bei 390×844 und 1280×800 prüfen (Skill `run-einsatz`), weil jsdom kein Layout rechnet.

> Die Kürzung in `PanelRow` und `ViewLinkPanel` nicht anfassen.

## Context
Aufgefallen bei der Abnahme von „Unwiderrufliche Aktionen einheitlich
bestätigen“. Alle Rückfragen laufen über `src/app/ConfirmationModal.tsx`
(zwölf Verwendungen). Sie setzt heute per `styles`-Prop am Titel
`minWidth: 0` und `overflowWrap: "anywhere"`; Mantine selbst setzt den Titel
normal gewichtet mit Zeilenhöhe 1 und richtet den Kopf mittig aus.

- Die Rückfrage „Einsatz löschen“ steht in
  `src/app/operations/[id]/OperationLifecycleActions.tsx` mit dem festen Titel
  „Einsatz löschen“. Die Komponente wird nur in
  `src/app/operations/OperationsOverview.tsx` verwendet, die je Karte
  `operation.name` kennt.
- Die KML-Rückfrage in `src/map/KmlPanel.tsx` zeigt das Muster:
  `` title={`KML-Overlay „${removeTarget?.name}“ entfernen`} ``.
- Das Theme steht in `src/app/theme.ts` (`createTheme`, bisher ohne
  `components`). Tests rendern über `src/test/render.tsx` mit diesem Theme.
- Die Zeilen im Ebenen-Panel: `overlayRow` in `src/map/KmlPanel.tsx` und die
  `Paper`-Zeilen in `src/map/ImageOverlayPanel.tsx`, je
  `<Group justify="space-between" wrap="nowrap">` mit einem `Switch`, dessen
  `label` der Name ist. Vorbild für den Umbruch: `UserAdminPanel.tsx`
  (`miw={0}`, `overflowWrap: "anywhere"`).

Das vereinbarte Aussehen zeigt der Specimen
<https://claude.ai/artifact/1PLS6cG2aAsQb7XToTRKa6>, Kopie in
`changes/2026-09-30-ziel-erkennbar-und-erreichbar/specimens/varianten.html`:
Titel halbfett mit Zeilenhöhe um 1,35, Schließen-X oben, Knöpfe der Rückfrage
44 px; im Ebenen-Panel bricht der Name um, Schalter und Knöpfe stehen oben in
der Zeile. **Agreed; build to this, do not redesign.**

## Plan
1. **AC-1, rot.** In `src/app/operations/OperationsOverview.test.tsx` einen
   Test: zwei Einsätze („Hochwasser“, „Sturm“), im Menü der Karte „Sturm“
   „Einsatz löschen“ wählen; der Dialog (`getByRole("dialog")`) hat einen
   Titel, der „Sturm“ enthält, und nicht „Hochwasser“. Beweis: der Test
   scheitert an der Assertion, weil der Titel „Einsatz löschen“ lautet.
2. **AC-1, grün.** `OperationLifecycleActions` bekommt eine Pflicht-Prop
   `name: string` und bildet den Titel `` `Einsatz „${name}“ löschen` ``;
   `OperationsOverview` übergibt `operation.name`. Die Fixture `setup` in
   `src/app/operations/[id]/OperationLifecycleActions.test.tsx` bekommt einen
   Namen. Die Dialog-Suchen mit dem exakten Namen `"Einsatz löschen"` in
   derselben Datei (`confirmDelete` und der Abbrechen-Test) auf den neuen
   Titel mit dem Namen aus `setup` umstellen. Beweis: der Test aus Schritt 1
   und die übrigen Tests grün.
3. **AC-2 absichern.** In `OperationLifecycleActions.test.tsx` den
   bestehenden Lösch-Test so schärfen, dass er den vollständigen Satz
   „Dieser Einsatz wird mit seinem gesamten Einsatztagebuch und allen
   Kartenobjekten unwiderruflich gelöscht.“ prüft (heute nur
   `/Einsatztagebuch/`). Weil `<strong>` den Satz teilt, findet `getByText`
   ihn nicht; stattdessen `expect(dialog).toHaveTextContent(satz)` auf dem
   Dialog. Bestätigen und Abbrechen sind durch die bestehenden
   Tests gepinnt (Bestätigen ruft `onDelete`, Abbrechen nicht). Beweis:
   Test grün; der Satz im Code geändert macht ihn rot.
4. **Titel-Stil im Theme (AC-6).** In `src/app/theme.ts` unter `components`
   `Modal.extend({ styles: { header: { alignItems: "flex-start" }, title: { fontWeight: 600, lineHeight: 1.35, minWidth: 0, overflowWrap: "anywhere" } } })`;
   die `styles`-Prop in `ConfirmationModal.tsx` entfernen. In den Typen von
   `@mantine/core` 9 nachsehen, dass `Modal` die Styles-Namen `header` und
   `title` so führt. Beweis: ein Test in `src/app/ConfirmationModal.test.tsx`,
   dass das Titel-Element `font-weight: 600` und
   `overflow-wrap: anywhere` als Inline-Style trägt (Mantine schreibt
   `styles` aus dem Theme inline); rot, solange nur die `styles`-Prop
   entfernt ist, grün mit dem Theme-Eintrag.
5. **Knöpfe 44 px (AC-7, AC-8).** In `ConfirmationModal.tsx` „Abbrechen“ und
   den Bestätigungsknopf per `style={{ height: 44 }}` auf 44 px setzen, nicht
   im Theme und nicht per `h={44}` (das rendert als `calc(… rem …)`).
   Beweis: Test in `ConfirmationModal.test.tsx`, dass beide Knöpfe
   `toHaveStyle({ height: "44px" })` erfüllen, zuerst rot; AC-8 im Browser.
6. **Zeilen im Ebenen-Panel (AC-4, AC-5).** In `KmlPanel.tsx` (`overlayRow`)
   und `ImageOverlayPanel.tsx` die Zeilen-`Group` auf `align="flex-start"`
   setzen und am `Switch` den Label-Teil mit `miw={0}` und
   `overflowWrap: "anywhere"` versehen (per `styles`/`classNames` des
   `Switch` für `body`/`labelWrapper`/`label`, je nachdem, was Mantine 9 dort
   braucht, damit das Label schrumpfen darf). Beweis: Browser, Schritt 7.
7. **Browser (AC-3 bis AC-8).** Mit dem Skill `run-einsatz` bei 390×844 und
   1280×800. Vor Schritt 5 (am besten vor jeder Änderung) im
   Kartenzeichen-Dialog die Höhe von „Speichern“ messen und notieren; sie ist
   der Vergleichswert für AC-8.
   - `/operations` mit einem Einsatz, dessen Name 80 Zeichen ohne
     Leerzeichen hat: „Einsatz löschen“ öffnen; Titel bricht um, Schließen-X
     oben, kein seitliches Scrollen, beide Knöpfe sichtbar und ≥ 44 px (AC-3,
     AC-6, AC-7).
   - Im Einsatz im Ebenen-Panel eine KML-Datei, eine KML-URL und ein
     Bild-Overlay mit 80-Zeichen-Namen einbinden, dazu je eines mit dem Namen
     „Strecke“: kein seitliches Scrollen, lange Namen vollständig und
     umgebrochen, kurze Zeilen einzeilig (AC-4, AC-5). KML-Datei und
     Bild-Overlay über den Dateinamen hochladen. Eine KML-URL lässt sich
     lokal nicht einbinden, weil `addKmlUrlAction` die URL abruft und
     `src/server/kml/kml-fetch.ts` localhost und private Adressen sperrt;
     die beiden URL-Overlays deshalb direkt in die Dev-Datenbank schreiben:
     `INSERT INTO kml_overlays (id, operation_id, source_type, source_url, name, content) VALUES (gen_random_uuid(), '<Einsatz-ID>', 'url', 'https://example.org/strecke.kml', '<Name>', '<Inhalt einer gültigen KML-Datei>')`
     (Spalten wie in `src/server/kml/kml-overlays.ts`, Tabelle in
     `006_kml_overlays.sql`).
   - Den Kartenzeichen-Dialog öffnen: Titel halbfett, „Speichern“ so hoch wie
     vor der Änderung (AC-6, AC-8).
   Beweis: Screenshots je Breite.
8. `npm run check` grün.

Entschieden beim Schneiden: Die Prop heißt `name`, wie das Feld
`OperationSummary.name`, und ist Pflicht (keine optionale
Test-Erleichterung). Der Theme-Eintrag für `Modal` ist der erste unter
`components` in `theme.ts`; spätere Komponenten-Defaults kommen dorthin.

## Not here
- Lage und Auffälligkeit der Lösch-Knöpfe.
- Der Fokus nach dem Schließen einer Rückfrage (Backlog: `fokus-nach-rueckfrage`).
- 44 px hohe Touch-Ziele außerhalb der Rückfragen.
- Die Kürzung in `PanelRow` (Kartenzeichen- und Bereichslisten) und in
  `ViewLinkPanel` bleibt, wie sie ist.

## Record
- **AC-1:** `src/app/operations/OperationsOverview.test.tsx` › „names the Einsatz of the chosen card in the delete confirmation“.
- **AC-2:** `src/app/operations/[id]/OperationLifecycleActions.test.tsx` › „requires explicit confirmation before deleting, warning about the Einsatztagebuch“ (ganzer Satz) und „does not delete when the confirmation is cancelled“; im Browser bestätigt.
- **AC-3:** im Browser bei 390×844 und 1280×800 (Titel bricht drei- bis vierzeilig um, kein seitliches Scrollen, beide Knöpfe sichtbar).
- **AC-4:** `src/map/KmlPanel.test.tsx` und `src/map/ImageOverlayPanel.test.tsx` › „lets a long name without spaces wrap …“ und „keeps the Bearbeiten button whole …“ für die Stile; das Layout im Browser bei beiden Breiten mit KML-Datei, KML-URL und Bild-Overlay aus 80 Zeichen.
- **AC-5:** im Browser bei beiden Breiten, Zeilen „Strecke“ einzeilig, 56 px hoch wie vorher.
- **AC-6:** `src/app/theme.test.tsx` für Gewicht, Zeilenhöhe, Umbruch und Kopfausrichtung; im Browser in der Rückfrage, im Kartenzeichen-Dialog und in „Neuen Einsatz eröffnen“.
- **AC-7:** `src/app/ConfirmationModal.test.tsx` › „makes both buttons large enough to tap on a phone“; im Browser 44 px.
- **AC-8:** im Browser: „Speichern“, „Löschen“, „Gerätelink erzeugen“ und „Einsatz eröffnen“ 36 px, wie auf `7d369ba`.
- Checks: `npm run check` grün (127 Testdateien, 1220 Tests).

### Left standing
- **Theme ohne `Modal.extend`:** Der Plan sah `Modal.extend` vor. In Server Components ist `Modal` nur eine Client-Referenz ohne `extend`, und jede Seite antwortete mit 500. Das Theme nutzt deshalb ein schlichtes Objekt, mit einem Kommentar dazu. Ein Test dafür fehlt, weil Vitest das Server-Rendering von Next nicht ausführt; geprüft ist es am laufenden Dev-Server.
- **Abweichung vom Nudge zu `miw={0}`:** `miw={0}` am `Switch` und `minWidth: 0` am `labelWrapper` hatten im Browser keine Wirkung, weil `overflow-wrap: anywhere` allein die Mindestbreite des Labels klein macht. Beides ist wieder entfernt.
- **Neu gegenüber dem Plan:** „Bearbeiten“ im Bild-Overlay bekommt `flexShrink: 0`, weil der Knopf neben einem langen Namen sonst auf „Bea“ schrumpfte.
- **Hinweis für die Abnahme:** Eine KML-URL mit langem Namen hat neben „Neu laden“ und „Entfernen“ nur eine schmale Namensspalte (73 px bei 1280, 103 px bei 390) und bricht bis zu elfzeilig um. Das erfüllt AC-4 und entspricht dem vereinbarten Design, fällt aber auf.
- **Review:** zwei Durchgänge in frischem Kontext. Der erste fand den 500-Fehler (Blocker), den gekürzten Knopf (Should-fix) und die wirkungslosen Mindestbreiten (Nit); alle drei behoben. Der zweite fand keine Blocker und nichts zu beheben, nur zwei Nits zu den Tests (Testdaten ohne langen Namen, `align="flex-start"` nicht gepinnt); beide behoben.
