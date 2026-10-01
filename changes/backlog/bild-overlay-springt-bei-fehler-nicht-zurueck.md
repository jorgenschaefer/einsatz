---
effort: S
complexity: S
utility: M
---

# Bild-Overlay bleibt nach fehlgeschlagenem Verschieben an der falschen Stelle

Zieht man ein Bild-Overlay im Bearbeiten-Modus an eine neue Stelle und das
Speichern scheitert, erscheint im Editor „Das hat nicht geklappt. Bitte erneut
versuchen.“. Das Bild und der Mittelpunkt-Griff bleiben aber an der neuen,
nicht gespeicherten Stelle stehen, die Ecken- und Dreh-Griffe an der
gespeicherten. Die anderen Clients sehen weiter die alte Position. Wer die
Meldung übersieht, hält das Overlay für verschoben.

Der Grund: Die Geste verändert das Overlay direkt in Leaflet, und
`SituationMap` setzt die Platzierung nur neu, wenn sich die `imageOverlays`
ändern. Nach einem Fehler ändert sich dort nichts. Das war schon vor
„Einsatz-Actions vereinheitlichen“ so (`persistImage` in `0edf093`), damals
nur ohne Meldung. Aufgefallen bei der Abnahme dieser Änderung am 2026-09-30.

Gewünscht: Scheitert das Speichern einer Platzierung, springt das Overlay samt
Griffen auf die gespeicherte Platzierung zurück. Gilt für Verschieben,
Skalieren und Drehen.
