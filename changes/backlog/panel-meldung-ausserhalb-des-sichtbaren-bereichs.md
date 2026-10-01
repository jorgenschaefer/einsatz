---
effort: S
complexity: S
utility: L
---

# Die Meldung eines Panels steht außerhalb des sichtbaren Bereichs

Die Fehlermeldung im Bild-Overlay-, KML- und Ansichtslink-Panel steht oben
über dem Panel. Das Ebenen-Panel ist lang, und wer unten etwas auslöst, hat es
meist nach unten gescrollt. Scheitert die Aktion, erscheint die Meldung oben,
wo man sie nicht sieht. Für den Nutzer passiert scheinbar nichts.

Am Handy (360 px) ist das der Normalfall: „Per URL einbinden“ mit einer nicht
erlaubten Adresse schlägt fehl, die Meldung liegt bei y 179–235, der Kopf des
Panels („Ebenen“) bei y 415 – sie ist ganz aus dem Bild gescrollt. Am Desktop
passiert dasselbe, sobald das Panel gescrollt ist, etwa bei einem
fehlgeschlagenen „Neu laden“ weiter unten in der Liste.

Das folgt aus dem vereinbarten Design von „Karte und Ebenen nachbessern“
(Meldung über dem Panel, nach dem Muster von `StrengthPanel`), nicht aus der
Umsetzung. Alle Kriterien waren erfüllt, aber „jede Aktion meldet ihr
Ergebnis“ gilt nicht, solange man das Ergebnis nicht sieht. Aufgefallen bei
der Abnahme am 2026-10-01.

Gewünscht: Erscheint eine Meldung, sieht man sie, ohne zu scrollen. Eine
Möglichkeit ist, die Meldung beim Erscheinen in den sichtbaren Bereich zu
scrollen.
