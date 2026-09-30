---
effort: XL
complexity: L
utility: L
---

# Bereiche auf der Karte

Rückmeldung aus dem Einsatz (u. a. Cyclassics 2026). Die Lösung steht fest
und wird als Ganzes umgesetzt; offene Detailfragen entscheidet die Umsetzung
im Sinne von „Einfachheit vor Funktionsfülle".

Löst drei frühere Probleme: Text lässt sich nicht frei auf der Karte
platzieren, die Reihenfolge überlappender Bereiche ist nicht klar, und
Bereichsbeschriftungen verdecken Kartenzeichen.

**Beschriftung von Bereichen nicht mehr auf der Karte.** Ein Bereich behält
seinen Namen, er wird aber nicht mehr auf der Karte gezeichnet – weder in der
Führungsansicht noch in Ansichts- und Geräteansicht. Sichtbar bleibt er in der
Bereichsliste und im Bereich-Editor. Text auf der Karte übernimmt die neue
Form „Text".

**Neue Bereich-Form „Text".** Eine vierte Form neben Polygon, Linie und Kreis:
ein Ankerpunkt, ein Text und eine Farbe. Sie läuft über dieselben Wege wie die
anderen Formen: Bereichs-Panel, Bereich-Editor, Speicherung als Bereich. Bei
dieser Form _ist_ der Name der Text, und er wird gezeichnet.

- Der Text skaliert mit dem Zoom wie Schrift auf einer gedruckten Karte: Seine
  Größe ist eine Größe in der Welt (Meter), nicht in Pixeln.
- Die Größe stellt man über einen Anfasser direkt auf der Karte ein, so wie
  man einen Kreis aufzieht. Ein Zahlenfeld im Editor gibt es nicht. Ein neuer
  Text startet in einer Größe, die beim aktuellen Zoom gut lesbar ist.

**Feste Stapelreihenfolge.** Die Reihenfolge ergibt sich aus dem Objekttyp
und lässt sich nicht einstellen. Von oben nach unten:

1. Kartenzeichen samt Bezeichnung
2. Text
3. Linien
4. Kreise und Polygone, kleinere (nach Fläche) über größeren

Oben liegt auch vorn beim Anklicken: Liegt ein kleiner Kreis in einem großen,
trifft ein Klick auf den kleinen den kleinen.

**Einheitliche Auswahl.** Jedes Objekt (Kartenzeichen und alle Bereich-Formen
einschließlich Text) wird gleich behandelt:

- Wenn der Editor geöffnet ist, wird der Bereich auf der Karte hervorgehoben.
  Wie die Hervorhebung aussieht, ist offen. Sie muss aber für alle Formen
  gleich gut funktionieren, etwa als kontrastierende Kontur oder Glühen, bei
  Kartenzeichen als Ring.
- Verschoben wird ein Bereich jeder Form über die Aktion „Verschieben" im
  Editor, wie heute der Kreis: Das Objekt wird unter dem festen Fadenkreuz
  positioniert und mit „Hier setzen" abgelegt. Polygone und Linien werden
  dabei als Ganzes versetzt. Direktes Ziehen von Bereichen gibt es nicht.
- Kartenzeichen bleiben wie heute direkt ziehbar.
