# Criteria: Ebenen und Meldungen nachbessern

## Problem
Nach einer Aktion auf der Karte oder im Ebenen-Panel sieht man nicht
verlässlich, was die Aktion bewirkt hat:

- Eine Fehlermeldung erscheint außerhalb des sichtbaren Bereichs des Panels,
  bleibt auf der Karte stehen, nachdem der Modus beendet ist, zu dem sie
  gehört, oder verschwindet, weil eine andere Aktion gelungen ist, obwohl sie
  weiter gilt.
- Ein Bild-Overlay steht nach gescheitertem Speichern an einer Stelle, die
  nicht gespeichert ist.
- Eine KML-URL, die kein KML liefert, erscheint als eingebundene Ebene, die
  nichts zeigt.
- Ein neu hochgeladenes Bild-Overlay landet außerhalb des Ausschnitts, den man
  sieht, und ist von dort nicht zu erreichen.

Stattdessen sieht man nach jeder dieser Aktionen, ohne zu suchen, was
tatsächlich gilt: ob sie gescheitert ist, was gespeichert ist und wo das
Ergebnis liegt.

Aufgefallen bei Review und Abnahme von „Einsatz-Actions vereinheitlichen“
(2026-09-30), „Karte und Ebenen nachbessern“ und „Adresssuche markiert den
Treffer“ (beide 2026-10-01); die Einzelheiten stehen in den Backlog-Tickets
`panel-meldung-ausserhalb-des-sichtbaren-bereichs`,
`kartenmeldung-bleibt-nach-abbrechen-stehen`,
`entfernen-loescht-fremde-fehlermeldung`,
`bild-overlay-springt-bei-fehler-nicht-zurueck`,
`bild-overlay-startet-ausserhalb-des-ausschnitts` und
`kml-url-ohne-kml-ablehnen`. Einen Vorfall im Einsatz gab es nicht.

## Acceptance criteria
- **AC-1** Scheitert eine Aktion im KML-, Bild-Overlay- oder Ansichtslink-Panel oder eine Kartenaktion (Kartenzeichen platzieren, Bereich zeichnen, Bereich neu zeichnen, Kreis verschieben), erscheint ihre Meldung als Benachrichtigung – am Handy oben mittig, am Desktop oben rechts über der Karte –, sichtbar ohne Scrollen, egal wie weit das Panel gescrollt ist. Sie liegt unter der Kopfzeile und verdeckt keines ihrer Bedienelemente (Status, Verbindungsanzeige, „Teilen“, Menü); am Desktop verdeckt sie die Seitenleiste nicht. Über dem Panel und unten auf der Karte steht keine Meldung mehr.
- **AC-2** Der Titel der Benachrichtigung nennt die Quelle („KML-Ebenen“, „Bild-Overlays“, „Ansichtslinks“, „Karte“), ihr Text ist die bisherige Meldung.
- **AC-3** Eine Benachrichtigung schließt sich nie von selbst; ihr „ד schließt sie.
- **AC-4** Je Quelle steht höchstens eine Benachrichtigung. Sie schließt sich, sobald man in derselben Quelle etwas Neues beginnt – KML: Datei wählen, Sichtbarkeit schalten, „Neu laden“, „Per URL einbinden“, „Entfernen“ öffnen, Entfernen bestätigen; Bild-Overlays: Datei wählen, Sichtbarkeit schalten, „Bearbeiten“, eine neue Platzierung wird gespeichert (Ende einer Verschieben-, Skalieren- oder Drehen-Geste), Deckkraft ändern, „Ersetzen“, „Löschen“ bestätigen, „Fertig“; Ansichtslinks: „Ansichtslink erzeugen“, Löschen-Rückfrage öffnen, Löschen bestätigen; Karte: ein Kartenmodus beginnt oder wird beendet (Kartenzeichen scharf schalten, Zeichnen oder Neu zeichnen beginnen, Kreis „Verschieben“, Bild „Bearbeiten“, „Abbrechen“, „Fertig“, „Hier setzen“) oder ein Kartenzeichen wird gesetzt. Endet ein Kartenmodus nur, weil die Karte ausgeblendet wird (am Handy Wechsel zu ETB oder Stärke, Fenster schmaler als 48 em), bleibt die Benachrichtigung „Karte“ stehen. Eine Meldung, die eintrifft, während eine Rückfrage offen ist, schließt erst das Bestätigen; bis dahin ist sie zu sehen (AC-7).
- **AC-5** Eine Benachrichtigung bleibt stehen, wenn man in einer anderen Quelle etwas beginnt, in „Name“, „KML-/KMZ-URL“ oder „Bezeichnung“ tippt, die Karte verschiebt oder zoomt, ein Panel öffnet, schließt oder wechselt, den Dialog „Ansichtslinks teilen“ schließt oder am Handy zwischen Karte und ETB wechselt.
- **AC-6** Gelingt eine Aktion, erscheint keine Benachrichtigung.
- **AC-7** Eine Benachrichtigung, die erscheint, während eine Rückfrage (Entfernen, Löschen) offen ist, ist über dem Dialog zu sehen und lässt sich dort schließen.
- **AC-8** Ist die Sitzung abgelaufen und man löst eine dieser Aktionen aus, erscheint die Anmeldeseite, ohne dass vorher eine Benachrichtigung zu sehen ist.
- **AC-9** Verlässt man die Lageansicht, etwa zur Einsatzliste, ist keine ihrer Benachrichtigungen mehr zu sehen.
- **AC-10** Scheitert am Handy eine Kartenaktion, bleibt ein offenes Blatt offen.
- **AC-11** Formulare, Editoren und Dialoge zeigen ihre Fehler weiter in sich: der Bild-Overlay-Editor für Deckkraft und Ersetzen, der Bereich-Editor, der Kartenzeichen-Dialog, die Rückfragen zum Entfernen und Löschen, das Stärke-Panel, die ETB-Eingabe, die Anmeldung, die Passwortänderung, das Formular für einen neuen Einsatz und die Nutzerverwaltung. Ebenso bleibt der Hinweis „Kopieren nicht möglich – …“ im Ansichtslink- und im Gerätelink-Panel, wo er ist.
- **AC-12** Scheitert das Speichern von Verschieben, Skalieren oder Drehen eines Bild-Overlays, stehen Bild und alle Griffe danach auf der gespeicherten Platzierung, und es erscheint eine Benachrichtigung „Bild-Overlays“ mit der Meldung. Im Editor erscheint dazu keine Meldung.
- **AC-13** Ein neu hochgeladenes Bild-Overlay liegt bei allen Clients mittig auf dem Kartenausschnitt, den der Hochladende beim Hochladen sieht – der ganzen Kartenfläche, auch unter einem offenen Blatt –, unabhängig vom Standard-Ausschnitt des Einsatzes.
- **AC-14** Ein neu hochgeladenes Bild-Overlay ist höchstens halb so breit und höchstens halb so hoch wie dieser Ausschnitt, und eine der beiden Grenzen ist erreicht – gemessen in Metern am Boden, auf 5 % genau.
- **AC-15** Liefert eine URL beim Einbinden einen Inhalt, dessen Wurzelelement nicht `<kml>` ist (davor nur XML-Deklaration, Kommentare und Leerraum), entsteht kein Overlay; es erscheint „Die Adresse liefert keine KML-Datei.“, und „Name“ und „KML-/KMZ-URL“ behalten ihren Inhalt.
- **AC-16** Liefert eine bestehende URL beim „Neu laden“ kein KML im Sinne von AC-15 mehr, bleibt der bisherige Inhalt des Overlays, und es erscheint „Die Adresse liefert keine KML-Datei.“.
- **AC-17** Ist eine eingebundene Datei – bei einem KMZ dessen Haupt-KML – kein KML im Sinne von AC-15, entsteht kein Overlay, und es erscheint „Die Datei ist keine KML- oder KMZ-Datei.“.
- **AC-18** KML- und KMZ-Dateien und -URLs, die heute funktionieren, funktionieren weiter, auch „Meine Karten“ mit NetworkLink. Ein NetworkLink-Ziel, das kein KML liefert, wird übersprungen wie ein toter Verweis.

## Agreed design
Fehler von Aktionen, deren Oberfläche man nicht gerade vor sich hat – die
Panels der Lagekarte und die Karte selbst –, erscheinen als Mantine-
Benachrichtigung: rot, mit der Quelle als Titel, ohne automatisches Schließen,
eine je Quelle, unter der Kopfzeile – am Handy oben mittig, am Desktop oben rechts über der Karte, links neben der Seitenleiste. Formulare,
Editoren und Dialoge behalten ihre Meldung inline. Ausnahme ist das
Ansichtslink-Panel: Es steht im Dialog „Ansichtslinks teilen“, zählt aber als
Panel und meldet über eine Benachrichtigung. Specimen (Alternative 1,
„Top“):
[Artifact](https://claude.ai/artifact/5ncUehbzsViBCHbUwujbs8) ·
[`specimens/benachrichtigung-specimen.html`](specimens/benachrichtigung-specimen.html).
Die Alternativen „Bottom“ und „Bottom of the map“ im Specimen sind nur der
Vergleich.

Ein neues Bild-Overlay startet mittig auf dem aktuellen Ausschnitt in einer
Größe, mit der Bild und Griffe darin Platz haben. KML wird an seinem
Wurzelelement erkannt.

**Agreed; build to this, do not redesign.**

## Nudges
- Ein gemeinsamer Hook ersetzt die Meldung in `useActionRunner` und `useMapActionError`: feste Notification-ID und Titel je Quelle, `notifications.hide(id)` beim Start, `notifications.show({ id, title, message, color: "red", autoClose: false })` bei einem Fehler.
- `MapErrorAlert` und das Schließen des Blatts in `useMapActionError` entfallen; `ErrorAlert` bleibt für das Stärke-Panel und die ETB-Eingabe.
- Die Position des einen `<Notifications />` hängt am Breakpoint `48em` wie das Layout der Lageansicht: oben mittig bzw. oben rechts, nach unten versetzt um die Höhe der Kopfzeile und am Desktop nach links um die Breite der Seitenleiste. Sein z-Index liegt über dem der Modals.
- Das Schließen der Karten-Benachrichtigung hängt an den Übergängen von `useMapMode`, nicht an den einzelnen Knöpfen; das Zurücksetzen über `onMapHidden` in `useMainView` schließt sie nicht.
- `SituationWorkspace` schließt beim Unmount die IDs seiner Quellen (AC-9).
- `saveImagePlacement` in `useImageOverlayEditing` läuft über den Hook der Quelle „Bild-Overlays“ (die Benachrichtigung schließt beim Speichern am Ende der Geste); Deckkraft und Ersetzen behalten ihren eigenen `useActionRunner` für den Editor und schließen beim Start zusätzlich die Benachrichtigung „Bild-Overlays“, ebenso „Löschen“ und „Fertig“.
- Tests rendern `<Notifications />` im Test-Wrapper und prüfen über `role="alert"`.
- AC-12: Nach einem Fehler setzt der Adapter das Overlay aus der gespeicherten Platzierung neu, statt die unveränderte Signatur zu überspringen.
- AC-13/14: Der Client gibt Mitte und Ausdehnung des Ausschnitts in Metern an `addImageOverlayAction`; der Server rechnet mit dem Seitenverhältnis des Bildes `scaleM` aus, in `defaultImagePlacement`, das den Standard-Ausschnitt dann nicht mehr braucht.
- AC-15–17: eine Prüfung im Server (etwa `assertKmlDocument(text, message)`), aufgerufen in `fetchKmlFromUrl` und `addKmlFileAction`, jeweils mit ihrem Text.

## Out of scope
- Leere, aber gültige KML-Dateien.
- Der Name des betroffenen Objekts im Titel der Benachrichtigung.
- Erfolgsmeldungen.
- Fehler in Ansichts- und Geräteansicht.

## Ruled out
- **Meldung beim Erscheinen in den Blick scrollen** - löste nur die Sichtbarkeit im Panel; die Benachrichtigung löst sie für Panels und Karte zugleich und ersetzt zwei Muster durch eines.
- **Meldung oben im Panel anheften (sticky)** - haftet nur innerhalb ihres Panel-Abschnitts und verdeckt Zeilen.
- **Meldung je Zeile** - Zustand je Zeile für einen seltenen Fall (schon in „Karte und Ebenen nachbessern“ verworfen).
- **Benachrichtigung unten oder unten auf der Karte** - verdeckt am Handy die Knöpfe des Blatts bzw. hängt an der sichtbaren Karte und verschwindet in der ETB-Ansicht.
- **Nur „ד schließt** - eine gelungene Wiederholung ließe die Meldung des Fehlschlags stehen.
- **Jede Interaktion schließt die Karten-Benachrichtigung** - Öffnen des Blatts, um den Fehler zu beheben, schlösse die Meldung, die man gerade liest.
- **Objektname im Titel** - je Quelle steht nur eine Benachrichtigung, und sie gehört fast immer zur eben ausgelösten Aktion; die Namen durch alle Actions zu reichen lohnt nicht.
- **Benachrichtigungen auch für Formulare und Dialoge** - wer ein offenes Formular vor sich hat, erwartet den Fehler dort, nicht hinter oder über dem Dialog.
- **Benachrichtigung nach einer Zeit ausblenden** - im Einsatz übersieht man sie leicht.
- **Ansichtslink-Panel als Dialog mit Meldung inline** - die Meldung oben im Dialog kann bei vielen Links aus dem Blick scrollen; die Benachrichtigung ist unabhängig davon zu sehen.
- **Meldung nur behalten, wenn sie ein anderes Overlay betrifft** - braucht eine Zuordnung von Meldung zu Overlay, also fast Zustand je Zeile.
- **Bild-Overlay mit fester Breite von 1000 m** - bei nahem Zoom liegen Griffe außerhalb, bei fernem ist es ein Punkt.
- **Karte nach dem Hochladen aufs Bild zoomen** - zieht dem Nutzer den Ausschnitt weg.
- **KML zusätzlich auf Placemarks prüfen oder voll parsen** - weist auch „Meine Karten“-Exporte mit toten NetworkLinks ab bzw. braucht einen XML-Parser im Server, für Fälle, die niemand gemeldet hat.
