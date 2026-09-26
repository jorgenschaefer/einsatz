# Intent: Vorgegebene Radien auf die Lagekarte bringen

## Problem

Bei einer Gefahrenlage (z. B. einem Bombenfund) bekommt die Führungskraft einen
Sperr- oder Evakuierungsradius in Metern vorgegeben und muss ihn auf der
Lagekarte darstellen. Die Einsatzkräfte vor Ort lesen daran ab, wohin sie
dürfen und wo ein Bereitstellungsraum liegen kann. Heute kann die Führungskraft
die vorgegebene Größe nicht verlässlich auf die Karte bringen, und sobald sich
der Mittelpunkt ändert, ist die mühsam getroffene Größe wieder verloren.
Stattdessen soll die Karte einen Bereich zeigen, der der Vorgabe entspricht –
auch nachdem der Mittelpunkt oder die Vorgabe sich geändert hat.

## Evidence

- Letzter Bombenfund: Die Führungskraft hat den Radius in Google Maps
  abgemessen und im Tool nach Augenmaß nachgezeichnet. Als der Fundort genauer
  bekannt war, hat sie das komplett wiederholt. (Mündlich; Datum und Einsatz
  nicht erfasst.)
- Der Mittelpunkt kam dabei in zwei Stufen: zuerst nur als „Kreuzung X-Straße
  und Y-Straße", später als offizielle Karte der Feuerwehr (manchmal auch
  warnung.bund.de) mit Evakuierungs- und Warnradius. Die Führungskraft hat
  diese Karte neben der Lagekarte angesehen und den Mittelpunkt nach Augenmaß
  übertragen. Als Bild-Overlay eingebunden wäre sie nicht genauer, weil das
  Overlay selbst nach Augenmaß eingepasst wird.
- Ein Kreis-Bereich entsteht nur durch Aufziehen mit der Maus (Geoman,
  `src/map/leaflet-adapter.ts`, `enableDraw`). Der Bereich-Editor
  (`src/map/AreaEditor.tsx`) bietet danach Farbe, Deckkraft, Beschriftung und
  „Form neu zeichnen" – weder Größe noch Position sind danach änderbar, und die
  Größe wird nirgends angezeigt.
- Die Führungsansicht wird im Einsatz auf dem Smartphone bedient: Der
  Screenshot vom Gesamteinsatz „Cyclassics 2026" zeigt die Führungsansicht
  (Knöpfe „Teilen", Status „AKTIV") im Mobilbrowser eines Android-Telefons.
  (Vom Nutzer im Gespräch gezeigt, nicht im Repo archiviert.)
- Gespeichert wird der Radius bereits in Metern (`area.ts`:
  `{ shape: "circle"; center; radius }`).

## Done when

- **C-1** Die Führungskraft kann einen Kreis-Bereich mit einem vorgegebenen
  Radius anlegen, der vom Vorgabewert um höchstens 1 m abweicht, ohne ein
  anderes Werkzeug zur Messung zu benutzen.
- **C-2** Wird der Mittelpunkt eines bestehenden Kreis-Bereichs versetzt, hat
  er danach denselben Radius wie vorher, ohne dass die Führungskraft die Größe
  erneut abmessen oder nach Augenmaß nachziehen muss.
- **C-3** Der Radius eines bestehenden Kreis-Bereichs lässt sich auf einen
  neuen Vorgabewert ändern (Abweichung höchstens 1 m), ohne dass sich der
  Mittelpunkt verschiebt.
- **C-4** Die Führungskraft kann den Radius eines bestehenden Kreis-Bereichs in
  Metern ablesen.
- **C-5** C-2 bis C-4 und C-6 gelingen auf einem Smartphone mit
  Touch-Bedienung. C-1 gilt auf dem Smartphone nur, soweit das bestehende
  Aufziehen dort funktioniert (vom Nutzer entschieden: „Was auf dem
  Smartphone nicht geht, geht nicht.").
- **C-6** Die Führungskraft kann den Mittelpunkt eines Kreis-Bereichs auf
  einen Punkt setzen, den sie in der höchsten Zoomstufe der Lagekarte erkennt
  (z. B. eine Kreuzung), mit höchstens 5 m Abstand zu diesem Punkt.

## Constraints

- Änderungen an einem Kreis-Bereich erscheinen wie bisher live bei allen, die
  die Lagekarte sehen (Führungsansicht, Gerätelink, Ansichtslink). Eine
  Lösung, die nur beim Bearbeitenden sichtbar wird, scheidet aus.
- Kreis-Bereiche, die es vor der Änderung schon gibt, überstehen sie mit
  unverändertem Mittelpunkt und Radius. Das schließt eine Umstellung aus, die
  bestehende Kreise verwirft, umrechnet oder neu zeichnen lässt.
- Farbe, Deckkraft und Beschriftung bleiben wie bisher einstellbar.

## Not this

- Den Radius als Zahl in Geräte- und Ansichtsansicht zeigen: Einsatzkräften
  reicht der dargestellte Kreis (vom Nutzer entschieden).
- Allgemeines Entfernungsmessen – kein konkreter Anwendungsfall (IDEAS.md, 4).
- Überlagernde Beschriftungen konzentrischer Kreise (IDEAS.md, 5).
- Reihenfolge überlappender Bereiche (IDEAS.md, 6).
- Die Kreuzung oder Adresse überhaupt auf der Karte finden (IDEAS.md, 3).
- Mehrere Kreise um denselben Mittelpunkt gemeinsam versetzen oder auf
  demselben Mittelpunkt halten. Jeder Kreis wird für sich platziert; so vom
  Nutzer entschieden („erstmal reicht beide einzeln zu verschieben").
- Den Mittelpunkt genauer treffen, als die Vorlage es hergibt: Er kommt als
  Beschreibung oder als fremde Karte und wird nach Augenmaß übertragen.
- Nachträgliches Verschieben oder Anpassen von Polygonen und Linien. Hat
  dieselbe Lücke im Editor, aber keinen berichteten Fall.

## User's solution

„Measure Distance, bzw. eigentlich ‚Größe des Kreises in m'" – den Kreis mit
500 m Radius erstellen und dann verschieben, bis er exakt steht; bei neuen
Infos erneut anpassen, ohne jedes Mal neu 500 m zu messen.

Nebenbei aufgekommen: Kreise oder Polygone von warnung.bund.de übernehmen –
dort ist aber meist nur einer der beiden Kreise zu sehen.
