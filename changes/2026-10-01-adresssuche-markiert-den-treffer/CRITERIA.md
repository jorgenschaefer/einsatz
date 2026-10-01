# Criteria: Adresssuche markiert den Treffer

## Problem
Nach der Wahl eines Adresstreffers in der Kartensuche ist nicht zu erkennen,
welche Stelle auf der Karte die Adresse ist: Die Karte springt grob dorthin und
markiert nichts. Wer die Adresse gesucht hat, will meist genau dort etwas tun –
meist ein Kartenzeichen setzen – und muss die Stelle erst auf der Grundkarte
suchen. Stattdessen soll die genaue Stelle des Treffers sichtbar bleiben, bis
man mit ihr fertig ist.

Der Fall: Gesucht war die Adresse eines Schulgebäudes; nach dem Sprung musste
die Karte nach dem Gebäude abgesucht werden. Datum und Einsatz sind nicht
festgehalten.

## Acceptance criteria
- **AC-1** Nach der Wahl eines Adresstreffers liegt eine Markierung genau auf der Position dieses Treffers – in der Führungsansicht, in der Ansicht (Ansichtslink) und in der Geräteansicht.
- **AC-2** Die Markierung sieht aus wie die Stecknadel aus Alternative 1 im Specimen: orange, ohne Beschriftung.
- **AC-3** Die Markierung bleibt stehen, während die Karte verschoben oder gezoomt wird, der Suchtext geändert, aber nicht geleert wird, ohne einen Treffer zu wählen, Panels geöffnet oder geschlossen werden, ein Kartenzeichen gesetzt wird, Änderungen anderer Nutzer per Live-Aktualisierung ankommen und auf dem Telefon zwischen Karte und ETB gewechselt wird.
- **AC-4** Die Wahl eines anderen Adresstreffers setzt die Markierung auf diesen Treffer; es gibt nie mehr als eine Markierung.
- **AC-5** Leeren der Suche – über „Suche löschen" (×) oder durch Löschen des Textes – entfernt die Markierung.
- **AC-6** Die Wahl eines Treffers unter „Einsatzobjekte" entfernt die Markierung.
- **AC-7** Die Markierung liegt über Kartenzeichen samt Bezeichnung, Bereichen samt Beschriftung, KML- und Bild-Overlays.
- **AC-8** Ein Tap auf die Markierung wirkt, als wäre sie nicht da: Ist ein Kartenzeichen zum Platzieren gewählt, wird es an der getippten Stelle gesetzt; ein Kartenzeichen unter der Markierung lässt sich antippen.
- **AC-9** Die Markierung sieht nur, wer gesucht hat: Andere Clients sehen sie nicht, und nach dem Neuladen der Seite ist sie weg.
- **AC-10** Nach der Wahl eines Treffers – Adresse oder Einsatzobjekt – schließt sich die Trefferliste; der Suchtext bleibt im Feld stehen.
- **AC-11** Enthält das Suchfeld Text, öffnet die Trefferliste sich wieder, sobald das Feld den Fokus bekommt (Tap, Klick oder Tastatur), in das Feld getippt oder geklickt wird – auch wenn es den Fokus schon hat – oder der Suchtext geändert wird.
- **AC-14** Ein Tap oder Klick außerhalb von Suchfeld und Trefferliste sowie Escape schließen die Trefferliste; der Suchtext und die Markierung bleiben.
- **AC-12** Die Wahl eines Treffers zentriert die Karte auf ihn. Ist die Karte weiter herausgezoomt als Zoomstufe 16, zoomt sie auf 16; ist sie auf 16 oder näher, bleibt die Zoomstufe.
- **AC-13** Für jeden anderen Sprung zu einem Punkt gilt dasselbe wie in AC-12: Springen aus dem Kartenzeichen- und dem Bereichs-Panel, Sprung zur eigenen Position in der Geräteansicht und Auswahl eines Kartenzeichens in der Ansicht.

## Agreed design
Eine eigene, unbeschriftete Markierung (Stecknadel) auf dem Treffer, wie
Alternative 1 im Specimen:
[Artifact](https://claude.ai/artifact/B3YAaSxCieiwQ4KG1noZFj) ·
[`specimens/adresssuche-specimen.html`](specimens/adresssuche-specimen.html).
Die Alternativen „Today", „2" und „3" im Specimen sind nur der Vergleich.

**Agreed; build to this, do not redesign.**

## Nudges
- Die Markierung als neues Aufrufpaar am `MapAdapter` zeichnen (etwa `setSearchHit(position)` / `clearSearchHit()`), im Leaflet-Adapter als Marker mit `interactive: false` und hohem `zIndexOffset`.
- Den Zustand der Markierung bei der gemeinsamen Suche halten (`useMapSearch` / `SearchBar`), damit alle drei Ansichten ihn aus demselben Code bekommen, statt ihn je Ansicht nachzubauen.
- Die Trefferliste in `SearchBar` schließen, ohne den Suchtext zu leeren.
- AC-12 und AC-13 an einer Stelle umsetzen, über die alle Sprünge laufen (heute setzt `useMapFocus.jumpTo` das Ziel, `SituationMap` wendet es mit `setView` an und kennt die aktuelle Zoomstufe).

## Out of scope
- Ein gewähltes Einsatzobjekt auf der Karte hervorheben.
- Ein Kartenzeichen direkt aus dem Suchtreffer heraus setzen.

## Ruled out
- **Kurzes Aufleuchten des Treffers (Alternative 2)** - nach wenigen Sekunden weg; wer gerade wegschaut, hat die Stelle verloren.
- **Aus dem Treffer direkt ins Platzieren (Alternative 3)** - geht nur in der Führungsansicht, Ansicht und Geräteansicht bräuchten trotzdem eine Markierung; mehr Aufwand, als das Problem braucht.
- **Beschriftung der Markierung mit der Adresse** - den Treffer hat man gerade selbst gewählt; die Beschriftung bringt nichts und macht auf dem Telefon Platzprobleme.
