# Criteria: Karte und Ebenen nachbessern

## Problem

Auf der Karte und in den Panels der Lageansicht melden Aktionen ihr Ergebnis
anders als im Rest der App:

- Eine Fehlermeldung im Ebenen-Panel bleibt stehen, nachdem man sich längst
  etwas anderem zugewandt hat. Das Ansichtslink-Panel läuft über denselben
  Mechanismus und verhält sich genauso.
- Kartenaktionen zeigen einen eigenen Fehlertext, und bei abgelaufener Sitzung
  blitzt eine Meldung auf, bevor die Anmeldeseite kommt.
- Der KML-Schalter lässt sich umschalten, während noch gespeichert wird.

Dazu erscheint ein KML-Punkt ohne eigenes Symbol als kaputtes Bild, und eine
falsche Einsatz-ID in der URL endet in einem Serverfehler. Und das Löschen
eines Bild-Overlays ist die einzige Einsatz-Action, die nicht über den
gemeinsamen Ablauf läuft; ein `redirect` oder `notFound` darin ginge verloren.

Stattdessen meldet jede Aktion dort ihr Ergebnis wie überall sonst, man sieht
nur Meldungen, die noch gelten, und jeder KML-Punkt ist auf der Karte zu sehen.

Aufgefallen bei Review und Abnahme von „Einsatz-Actions vereinheitlichen“ und
`2026-09-30-ziel-erkennbar-und-erreichbar` am 2026-09-30; die Einzelheiten
stehen in den Backlog-Tickets `alte-meldung-im-ebenen-panel-bleibt-stehen`,
`kartenfehler-wie-die-anderen-actions`, `kml-schalter-waehrend-speichern-sperren`,
`kml-punkte-ohne-markerbild` und `bild-overlay-loeschen-ueber-operation-action`.
Einen Vorfall im Einsatz gab es nicht.

## Acceptance criteria

- **AC-1** Im Bild-Overlay-, KML- und Ansichtslink-Panel hat die Fehlermeldung über dem Panel ein „×“; ein Klick darauf entfernt sie. Gemeint ist die Meldung über der Liste, nicht die im Editor eines Bild-Overlays.
- **AC-2** Die Meldung eines Panels verschwindet, sobald man darin etwas Neues beginnt – Bild-Overlay: Datei wählen, Sichtbarkeit schalten, „Bearbeiten“; KML: Datei wählen, Sichtbarkeit schalten, „Neu laden“, „Per URL einbinden“, „Entfernen“ öffnen; Ansichtslinks: „Ansichtslink erzeugen“, Löschen-Rückfrage öffnen.
- **AC-3** Solange eine Aktion eines Panels läuft, steht dort keine Meldung einer früheren Aktion. Scheitert sie, erscheint ihre Meldung; gelingt sie, keine.
- **AC-4** Tippen in „Name“, „KML-/KMZ-URL“ oder „Bezeichnung“ lässt eine stehende Meldung stehen.
- **AC-5** Scheitert Kartenzeichen platzieren, Bereich zeichnen, Bereich neu zeichnen oder Kreis verschieben unerwartet (die Action wirft), steht unten auf der Karte „Das hat nicht geklappt. Bitte erneut versuchen.“.
- **AC-6** Ist die Sitzung abgelaufen und man löst eine dieser Kartenaktionen aus, erscheint die Anmeldeseite, ohne dass vorher eine Meldung auf der Karte zu sehen ist.
- **AC-7** Solange eine Aktion des KML-Panels läuft (Einbinden per Datei oder URL, „Neu laden“, Sichtbarkeit schalten), sind die Sichtbarkeits-Schalter aller KML-Overlays gesperrt – wie die der Bild-Overlays.
- **AC-8** Ein KML-Punkt ohne verwendbare Bild-URL im `<IconStyle>` (verwendbar ist eine `http://`-, `https://`- oder `data:`-URL) erscheint in Führungs-, Ansichts- und Geräteansicht als farbiger Kreis von 14 px Durchmesser mit einem 2,5 px breiten weißen Rand außen herum (zusammen 19 px), wie im Specimen. Das gilt auch für Punkte mit relativer oder fehlender `<href>`.
- **AC-9** Hat der Punkt `<IconStyle><color>`, ist der Kreis in dieser Farbe, sonst in `#3388ff`, der Standardfarbe der KML-Linien. Der Kreis ist immer voll deckend; eine Deckkraft aus der KML-Farbe bleibt unbeachtet.
- **AC-10** Beim Anzeigen einer KML-Ebene mit solchen Punkten wird weder `marker-icon.png` noch `marker-shadow.png` angefragt, und keine durch die Punkte ausgelöste Anfrage endet mit einem Fehler.
- **AC-11** Die Tippfläche eines solchen Kreises ist mindestens 32 × 32 px groß und um den Punkt zentriert; Tippen oder Klicken öffnet wie bisher das Popup mit Name und Beschreibung.
- **AC-12** KML-Punkte mit verwendbarer Bild-URL im `<IconStyle>` sehen aus wie bisher.
- **AC-13** Ein angemeldeter Nutzer, der `/operations/<keine UUID>` öffnet, bekommt die Seite „nicht gefunden“ (404), keinen Serverfehler.
- **AC-14** `/operations/<id>/overlays/<keine UUID>`, `/view/<token>/overlays/<keine UUID>` und `/device/<token>/overlays/<keine UUID>` antworten jedem, der Zugang hat, mit 404.
- **AC-15** Ein Bild-Overlay löschen verhält sich wie bisher: Es verschwindet bei allen Clients. Scheitert nur das Aufräumen der Datei, bekommt der Nutzer keine Meldung, und der Dateipfad steht im Server-Log. Scheitert das Löschen selbst, erscheint „Das Bild-Overlay konnte nicht gelöscht werden.“.

## Agreed design

Die Panel-Meldungen folgen dem Muster von `StrengthPanel`: ein roter `Alert`
mit „×“ über dem Panel, der verschwindet, sobald man im Panel etwas Neues
beginnt.

Ein KML-Punkt ohne eigenes Symbol ist ein Kreis von 14 px in der KML-Farbe
mit 2,5 px weißem Rand außen herum (zusammen 19 px), ohne Bilddatei, mit einer Tippfläche von mindestens
32 px. Specimen:
[Artifact](https://claude.ai/artifact/BbUoqbRZvFMrF35m4XjAma), Kopie in
[`specimens/kml-punkt-ohne-symbol.html`](specimens/kml-punkt-ohne-symbol.html).

**Agreed; build to this, do not redesign.**

## Nudges

- `run` in `useActionRunner` leert die Meldung beim Start; für Schritte außerhalb von `run` („Bearbeiten“, „Entfernen“ bzw. Löschen-Rückfrage öffnen, eine Datei wählen, deren Lesen scheitert) rufen die Panels selbst `setError(null)`.
- `runMapAction` in `src/map/SituationWorkspace.tsx` nutzt `ACTION_FAILED` und `isNextNavigation` aus `src/app/action-failure.ts`, keinen eigenen Text.
- Eine ID, die keine UUID ist, wird in den Lookups (`getOperation`, `getImageOverlay`) abgefangen, die dann `null` liefern – kein Sonderfall je Route.
- Der KML-Kreis braucht keine Bilddatei: kein `L.Icon.Default`, nichts unter `public/`; etwa ein `L.divIcon` mit 32-px-Box und dem Kreis in der Mitte.
- `deleteImageOverlayAction` läuft über `operationAction(…, DELETE_FAILED)`; ein Fehler beim Aufräumen der Datei wird innerhalb von `run` abgefangen und mit Pfad geloggt. Danach `toError` und den Export von `toFormError` entfernen; die Tests von `toFormError` in `operation-action.test.ts` gehen mit, sein Verhalten pinnen die Tests von `operationAction`.
- Im `KmlPanel` bekommt der Schalter `disabled={busy}` wie im `ImageOverlayPanel`.

## Out of scope

- Die Fehlermeldung im Editor eines Bild-Overlays (`ImageOverlayEditor`); sie wird schon beim Öffnen und Schließen des Editors geleert.
- Den Treffer der Adresssuche markieren (`adresssuche-markiert-den-treffer-nicht`).
- KML-URLs ablehnen, die kein KML liefern (`kml-url-ohne-kml-ablehnen`).
- Bild-Overlay nach fehlgeschlagenem Speichern zurückspringen lassen (`bild-overlay-springt-bei-fehler-nicht-zurueck`).
- KML-Punkte mit verwendbarer Bild-URL, die nicht lädt.
- Andere Fehlertexte.

## Ruled out

- **Leaflet-Standardmarker mit reparierter Bildquelle** – sieht aus wie ein Suchtreffer-Pin und ignoriert die KML-Farbe.
- **Vektor-Stecknadel in KML-Farbe** – eine eigene Form mehr zu pflegen, kaum Gewinn gegenüber dem Kreis.
- **Größerer sichtbarer Kreis statt größerer Tippfläche** – verdeckt mehr Karte, Kartenzeichen verlieren an Gewicht.
- **Meldung je Zeile statt über dem Panel** – Zustand je Zeile für einen seltenen Fall.
- **Meldung nach einer Zeit ausblenden** – im Einsatz übersieht man sie leicht.
- **Nur `/operations/[id]` auf 404 umstellen** – ließe denselben 500er in den Overlay-Routen stehen.
