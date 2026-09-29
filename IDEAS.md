# Ideen

Rückmeldungen aus dem Einsatz (u. a. Cyclassics 2026), gebündelt zu vier
Themen. Jedes Thema wird als Ganzes umgesetzt. Die Lösung steht jeweils fest;
sie ist nicht mehr zu hinterfragen, sondern umzusetzen. Offene Detailfragen
entscheidet die Umsetzung im Sinne von „Einfachheit vor Funktionsfülle".

Erledigt: Kreise in vorgegebener Größe (früher #4). In Arbeit: Stärkemeldungen
(früher #8), siehe `intents/2026-09-26-staerkemeldungen/`.

**Begriff „Einsatz".** In der Domäne doppelt belegt: das Ereignis, zu dem
Einheiten geschickt werden, und die ganze Lage (z. B. „Cyclassics 2026"). Hier
steht **Gesamteinsatz** für die Lage (im Code `Operation`, im Glossar heute
noch „Einsatz"), **Einsatz** für das Ereignis.

## Thema 1: Bereiche auf der Karte

Löst die früheren Punkte 5 (Text frei platzieren), 6 (Reihenfolge
überlappender Bereiche) und 7 (Bereichsbeschriftungen verdecken Kartenzeichen).

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

## Thema 2: Absender, Empfänger und Weg im ETB

Löst den früheren Punkt 9.

Ein ETB-Eintrag bekommt drei optionale, getrennt gespeicherte Felder: **Von**,
**An** und **Weg**. Der Freitext bleibt der Inhalt des Eintrags. Im ETB
erscheinen die Felder als Zeile über dem Text, z. B. „Von UHSt 2 an EAL ·
Funk". Leere Felder werden weggelassen. Alte Einträge haben keine Werte.

- **Von/An** sind bei jedem neuen Eintrag leer. Beim Tippen werden Werte
  vorgeschlagen: die Stellen des Gesamteinsatzes (aus den Stärkemeldungen) und
  alle bisher in diesem Gesamteinsatz verwendeten Von/An-Werte. Freitext ist
  immer erlaubt.
- **Weg** ist eine feste Auswahl aus _Funk_, _Telefon_ und _Persönlich_, mit
  Freitext als Ausweichmöglichkeit. Vorbelegt ist der Weg des letzten Eintrags,
  den dieselbe Führungskraft angelegt hat.
- Die Felder gehören zum Eintrag, deshalb deckt Korrigieren sie mit ab: Die
  Vorfassung bleibt samt Von/An/Weg durchgestrichen sichtbar.

## Thema 3: Eigene Vorlagen für Taktische Zeichen

Löst den früheren Punkt 2.

Neben der festen Schnellauswahl kann die Führungskraft **Vorlagen** anlegen.
Eine Vorlage hat einen Namen, eine DV-102-Komposition und optional eine
Standard-Bezeichnung.

- Vorlagen gehören zu genau einem Gesamteinsatz und sind nur dort sichtbar.
- Angelegt, bearbeitet und gelöscht werden sie in einem Abschnitt „Vorlagen"
  im Kartenzeichen-Panel. Zusammengestellt wird die Komposition mit dem
  bestehenden erweiterten Zeichenformular (`AdvancedSymbolForm`), ohne vorher
  etwas zu platzieren.
- In der Schnellauswahl stehen die Vorlagen hinter den festen Einträgen und
  werden genauso platziert. Die Standard-Bezeichnung ist dabei vorbelegt.
- Ändern oder Löschen einer Vorlage betrifft bereits platzierte Kartenzeichen
  nicht.
- Andere Nutzer desselben Gesamteinsatzes sehen neue und geänderte Vorlagen
  live über den bestehenden SSE-Event-Bus.

## Thema 4: Desktop-Layout mit Seitenleiste

Baut auf den Stärkemeldungen auf (`intents/2026-09-26-staerkemeldungen/`).

Am Desktop füllt die Lagekarte immer den Bildschirm. Rechts sitzt eine
Seitenleiste in Smartphone-Breite, im Grunde der Smartphone-Bildschirm: oben
zwei Knöpfe **ETB** und **Stärke**, darunter die gewählte Ansicht. Die
Hauptansichtsleiste links (`MainViewBar`) entfällt am Desktop. Die Karte ist
dort keine umschaltbare Ansicht mehr. Die Stärkemeldungs-Lösung, die „Stärke"
als dritten Punkt dieser Leiste vorsieht, gilt am Desktop dann nicht mehr.

- Beide Ansichten der Seitenleiste bleiben beim Umschalten eingehängt,
  angefangene Eingaben bleiben also erhalten.
- Zeigt die Seitenleiste „Stärke", zählt der ETB-Knopf neue Einträge wie
  heute die Hauptansichtsleiste.
- Am Smartphone bleibt alles wie es ist: Leiste unten mit Lagekarte, ETB und
  Stärke.

## Später

Offen und keinem Thema zugeordnet. Die Nummern sind die alten.

- **1. Wartende Einheiten verstopfen die Karte.** Einheiten wechseln zwischen
  _im Einsatz_ (Position zählt) und _wartend_, meist an ihrer UHSt (Position
  egal). Wartende sollen aus dem Weg, aber auffindbar bleiben (aufklappbar
  reicht). Nett wäre ein Hinweis an der UHSt wie „2 Streifen verfügbar". Heute
  behilft man sich mit „Ablage"-Bereichen neben dem Einsatzgebiet. Einheiten
  mit meldendem Gerätelink sind vorerst ausgenommen.
- **3. Nach der Adresssuche ist die Stelle nicht zu finden.** Die Suche
  verschiebt nur den Kartenausschnitt und markiert den Treffer nicht. Ziel
  ist, genau dort ein Kartenzeichen zu setzen.
- **10. Kein Überblick, welche Einheiten an welchem Einsatz sind.** Bei
  mehreren gleichzeitigen Einsätzen mit je einer Einsatzstelle. Eher Vision
  als akuter Bedarf, nicht primär ein Kartenproblem.

**Querschnitt: Dinge jenseits der Karte.** Heute ist alles ein Kartenzeichen;
„Einheit" ist nur ein Wort. Einheiten (Zustand wartend/im Einsatz, 1, 10),
Stellen (Stärke, Von/An im ETB) und Einsätze mit Einsatzstelle (10) existieren
aber unabhängig von der Karte. Mit den Stellen aus den Stärkemeldungen ist der
erste davon angelegt.
