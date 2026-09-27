# Solution: Radius im Bereich-Editor, Fadenkreuz zum Verschieben

## Intent

Beantwortet `01-INTENT.md` (daneben) und übernimmt alle Bedingungen C-1 bis
C-6 sowie alle drei Constraints. Das Intent hat keine offenen Fragen. C-5
wurde während dieser Lösungssuche vom Nutzer angepasst: Das Anlegen (C-1) auf
dem Smartphone gilt nur, soweit das bestehende Aufziehen dort funktioniert.

## Approach

Ein Kreis entsteht weiter durch Aufziehen; der Radius wird dabei auf ganze
Meter gerundet. Nach dem Aufziehen eines neuen Kreises öffnet sich der
Bereich-Editor (`AreaEditor`) für ihn von selbst. Der Editor zeigt bei Kreisen
den Radius als Zahlenfeld in Metern. Wer eine Vorgabe umsetzen will, zieht den
Kreis grob auf und tippt die Zahl ein; „Speichern" schreibt den neuen Radius um
denselben Mittelpunkt.

Zum Versetzen bekommt der Editor bei Kreisen den Knopf „Verschieben". Er
schließt den Editor, schließt am Smartphone das Kartenpanel und schaltet
einen neuen Karten-Modus ein: Die Karte
zentriert auf den Mittelpunkt des Kreises, in der Kartenmitte steht ein festes
Fadenkreuz, und der Kreis wird mit unverändertem Radius um die Kartenmitte
gezeichnet, während die Führungskraft die Karte schiebt und zoomt. Wie die
anderen Karten-Modi zeigt ein Modus-Band unter der Suche den Modus an, hier mit
„Hier setzen" und „Abbrechen": „Hier setzen" speichert den neuen Mittelpunkt
einmal; „Abbrechen" verwirft ihn.
Der Finger liegt beim Zielen nie auf dem Zielpunkt, und für größere Strecken
genügt Schieben und Zoomen der Karte.

Radius und Mittelpunkt werden über die bestehenden Server-Actions
`updateAreaGeometryAction` und `updateAreaStyleAction` geschrieben und
erreichen damit über das bestehende Live-Event alle Ansichten.
`createAreaAction` gibt zusätzlich die id des neuen Bereichs zurück, damit der
Editor ihn öffnen kann: Sie merkt sich innerhalb von `run` die id aus
`createArea(...)` und gibt `{ ...result, id }` zurück, mit eigenem
Rückgabetyp. `operationAction` und `ActionResult` bleiben unverändert. Keine
Migration, kein neues Feld in der Datenbank.

Für den Verschiebe-Modus bekommt `MapAdapter` (`src/map/adapter.ts`) ein
Methodenpaar für eine Kreis-Vorschau: Sie zeichnet einen Kreis mit gegebenem
Radius und Stil um die Kartenmitte und folgt ihr bei jedem `move` der Karte,
bis sie beendet wird. Den gespeicherten Kreis blendet `SituationMap` aus,
indem es ihn während des Modus aus den abgeglichenen Bereichen herausfiltert –
nicht im Adapter, damit der Abgleich bei jedem Live-Update ihn nicht wieder
einblendet. Das Fadenkreuz ist ein Element über der Karte in React; „Hier
setzen" liest die Kartenmitte über die bestehende Karten-Ref
(`SituationMapHandle.getView()`).

Die Form folgt den Kriterien des Nutzers: Ein Kreis lässt sich weiter ohne
Zahl malen, und der Radius lässt sich exakt setzen.

Specimen:
[`specimens/A-zahl-und-fadenkreuz.html`](specimens/A-zahl-und-fadenkreuz.html)
– der Bombenfund in drei Schritten (anlegen, versetzen, Radius ändern).

## Behaviour

- **AC-1** Wird ein Kreis aufgezogen – neu oder über „Form neu zeichnen" –,
  wird er mit einem auf ganze Meter gerundeten Radius gespeichert, damit das
  Radiusfeld ihn ohne lange Nachkommastellen exakt anzeigt. *(C-4)*
- **AC-2** Der Bereich-Editor zeigt bei einem Kreis-Bereich ein Feld „Radius"
  mit dem gespeicherten Radius in Metern, exakt und ohne Rundung (deutsches
  Dezimalkomma). Bei Polygon und Linie gibt es das Feld nicht. *(C-4)*
- **AC-3** Wird im Feld ein anderer Wert eingegeben und gespeichert, hat der
  Kreis danach genau diesen Radius um den Mittelpunkt aus dem jüngsten
  Zustand, den der Client beim Speichern kennt – nicht um den beim Öffnen des
  Editors (ein zwischenzeitliches Verschieben von anderer Stelle bleibt also
  erhalten). Das gilt für einen gerade aufgezogenen Kreis ebenso wie für
  einen älteren. *(C-1, C-3)*
- **AC-4** Wird gespeichert und das Radiusfeld hat noch den Wert, den es beim
  Öffnen des Editors hatte, wird die Geometrie nicht geschrieben – nur der
  Stil. Ein zwischenzeitlich von anderer Stelle geänderter Radius wird so
  nicht überschrieben. *(C-3, Constraint: bestehende Kreise)*
- **AC-5** Farbe, Deckkraft und Beschriftung lassen sich im selben Editor wie
  bisher ändern und speichern. *(Constraint: Stil)*
- **AC-6** Ein ungültiger Radius (leer, 0, negativ) wird nicht gespeichert; der
  Editor zeigt einen Fehler und bleibt offen. *(C-1, C-3)*
- **AC-7** Der Editor zeigt bei Kreis-Bereichen den Knopf „Verschieben", bei
  Polygon und Linie nicht. Er schließt den Editor, schließt am Smartphone das
  Kartenpanel (am Desktop bleibt es neben der Karte offen) und schaltet den
  Verschiebe-Modus für diesen Kreis ein. *(C-2, C-5)*
- **AC-11** Der Verschiebe-Modus schließt die anderen Karten-Modi aus
  (Platzieren, Bild-Overlay bearbeiten, Zeichnen): Das Einschalten eines
  anderen Modus beendet ihn und umgekehrt. Ein Wechsel der Hauptansicht
  (Lagekarte/ETB) beendet ihn wie jeden Karten-Modus. *(C-2)*
- **AC-12** Jede gespeicherte Änderung des Radius erscheint live in
  Führungsansicht, Gerätelink- und Ansichtslink-Ansicht. *(Constraint: live)*
- **AC-13** Kreis-Bereiche, die vor der Änderung angelegt wurden, werden mit
  unverändertem Mittelpunkt und Radius angezeigt; nichts schreibt sie um,
  solange niemand ihren Radius oder Mittelpunkt ändert. *(Constraint:
  bestehende Kreise)*
- **AC-15** Nach dem Aufziehen eines neuen Kreises öffnet sich der
  Bereich-Editor für genau diesen Kreis, sobald er gespeichert ist. Nach dem
  Aufziehen eines Polygons oder einer Linie und nach „Form neu zeichnen"
  öffnet er sich nicht. *(C-1)*
- **AC-16** Beim Einschalten des Verschiebe-Modus zentriert die Karte auf den
  Mittelpunkt des Kreises, bei unveränderter Zoomstufe. Ein Fadenkreuz steht fest in der Mitte der Karte;
  der Kreis wird mit unverändertem Radius um die jeweilige Kartenmitte
  gezeichnet und folgt jedem Schieben und Zoomen. Bis „Hier setzen" wird
  nichts gespeichert. *(C-2, C-6)*
- **AC-17** „Hier setzen" speichert als neuen Mittelpunkt die Kartenmitte
  unter dem Fadenkreuz, mit dem Radius aus dem jüngsten Zustand, den der
  Client zu diesem Zeitpunkt kennt, in einem einzigen Schreibvorgang, und
  beendet den Modus. Das Kartenpanel bleibt dabei, wie es ist. *(C-2, C-6)*
- **AC-18** „Abbrechen" beendet den Modus ohne zu speichern; der Kreis steht
  wieder am gespeicherten Mittelpunkt. Das Kartenpanel bleibt dabei, wie es
  ist. *(C-2)*
- **AC-19** Fadenkreuz, „Hier setzen" und „Abbrechen" liegen über der Karte
  und sind auf einem Smartphone sichtbar und per Touch bedienbar, ohne dass
  das Kartenpanel sie verdeckt; die Karte lässt sich im Modus per Touch schieben
  und zoomen. *(C-5)*
- **AC-20** Schlägt das Speichern bei „Hier setzen" fehl, wird der Fehler
  angezeigt und der Modus bleibt aktiv; gespeichert ist nichts, und
  „Abbrechen" stellt die Anzeige des gespeicherten Mittelpunkts her. *(C-2)*
- **AC-21** Verschwindet der Kreis während des Verschiebe-Modus aus dem
  Zustand (z. B. von anderer Stelle gelöscht), endet der Modus; Fadenkreuz
  und Knöpfe verschwinden. *(C-2)*
- **AC-22** Der Bereich-Editor samt Radiusfeld lässt sich auf einem
  Smartphone per Touch öffnen (über die Liste im Bereiche-Panel oder
  automatisch nach dem Anlegen), ausfüllen und speichern. *(C-5)*
- **AC-23** Jede gespeicherte Änderung des Mittelpunkts erscheint live in
  Führungsansicht, Gerätelink- und Ansichtslink-Ansicht. *(Constraint: live)*

## Edge cases

- **Kreis wird während des Verschiebens anderswo geändert:** Die Vorschau
  folgt weiter der Kartenmitte; ein zwischenzeitlich geänderter Radius wird
  übernommen. „Hier setzen" schreibt den Mittelpunkt mit dem dann
  gespeicherten Radius (AC-17); ein zwischenzeitlich anderswo gesetzter
  Mittelpunkt wird überschrieben – wie überall gilt der letzte
  Schreibvorgang.
- **Speichern im Editor mit geändertem Radius schlägt fehl:** Die Geometrie
  wird zuerst geschrieben; scheitert sie, wird der Stil nicht geschrieben.
  Scheitert erst der Stil, ist der neue Radius schon gespeichert und der
  Editor zeigt den Fehler.
- **Neuer Kreis kommt nicht an** (Speichern beim Aufziehen schlägt fehl): Der
  Fehler erscheint wie heute über den Fehlerkanal der Karte; kein Editor
  öffnet sich.
- **Kreis mit Radius 0** (Mittelpunkt und Rand auf derselben Stelle): wird
  wie heute abgelehnt; kein Editor öffnet sich.
- **Sehr großer Radius:** Keine Obergrenze über die bestehende Prüfung
  (`assertRadius`: endlich und größer als 0) hinaus.

## Non-goals

- Kein Meter-Etikett beim Aufziehen oder Verschieben; abgelesen wird im
  Editor.
- Keine Anzeige des alten Kreises während des Verschiebens; sichtbar ist nur
  der Kreis unter dem Fadenkreuz.
- Kein Verschieben oder Anpassen von Polygonen und Linien.
- Kein gemeinsames Versetzen mehrerer Kreise um denselben Mittelpunkt.
- Keine Radius-Anzeige als Zahl in Gerätelink- und Ansichtslink-Ansicht.
- Kein Anlegen eines Kreises allein aus Zahl und Mittelpunkt, ohne Aufziehen.
- Keine Änderung an „Form neu zeichnen" außer der Rundung (AC-1).
- Keine eigene Arbeit daran, das Aufziehen per Touch zu verbessern (siehe
  `Accepted tradeoffs`).
- Kein Schutz des Stils (Farbe, Deckkraft, Beschriftung) gegen
  zwischenzeitliche Änderungen von anderer Stelle – das Verhalten des Editors
  bleibt dort wie heute.
- Alles weitere aus `Not this` im Intent.

## Accepted tradeoffs

- **Aufziehen per Touch bleibt, wie es ist.** Ob Geoman einen Kreis auf dem
  Smartphone sauber anlegen lässt, ist ungeprüft. Geht es nicht, lässt sich auf dem
  Smartphone kein Kreis anlegen; das angepasste C-5 lässt das zu. Vom Nutzer
  so entschieden: „Was auf dem
  Smartphone nicht geht, geht nicht. Das passt schon." Gekauft: kein eigener
  Anlege-Weg neben dem Aufziehen.
- **Zwei Schritte statt einem beim Anlegen nach Vorgabe:** erst grob
  aufziehen, dann die Zahl eintippen. Gekauft: Das Aufziehen bleibt für alle
  Formen gleich, und ein Kreis ohne Vorgabe braucht weiter keine Zahl.
- **Ein neues Bedienmuster (Fadenkreuz) neben den Griffen der Bild-Overlays.**
  Gekauft: Der Finger verdeckt den Zielpunkt nicht, weite Strecken gehen per
  Schieben und Zoomen, und es geht nur ein Schreibvorgang statt eines je
  Loslassen an alle Ansichten.
- **Die Vorschau im Verschiebe-Modus sieht nur, wer verschiebt.** Das ist
  kein Verstoß gegen die Live-Constraint, weil bis „Hier setzen" nichts
  geändert ist; gekauft wird, dass keine Zwischenstände live rausgehen.
- **`createAreaAction` bekommt als einzige Einsatz-Action einen eigenen
  Rückgabetyp mit `id`.** Gekauft: Der neue Kreis muss nicht als unbenannter
  „Bereich" im Bereiche-Panel gesucht werden, ohne den gemeinsamen
  Choke-Point `operationAction` oder den geteilten Typ `ActionResult` zu
  ändern.
- **`MapAdapter` wächst um eine Kreis-Vorschau**, die nur der
  Verschiebe-Modus nutzt. Gekauft: Die Kartenmitte bleibt hinter der
  einzigen Grenze zu Leaflet, statt dass React Kartenereignisse selbst
  abonniert.
- **Das Kartenpanel schließt beim Verschieben nur am Smartphone.** Dort liegt
  es als Blatt über der unteren Kartenhälfte und verdeckte Fadenkreuz und
  Kreis; am Desktop steht es neben der Karte und bleibt offen. Gekauft: eine
  Breitenabfrage, aber dieselbe (`closeSheetOnPhone`), mit der Platzieren,
  Zeichnen und Bild-Overlay-Bearbeiten das Panel schon behandeln.
- **Zwei Schreibvorgänge und zwei Live-Events beim Speichern mit geändertem
  Radius**, mit möglichem Teilerfolg (Radius gespeichert, Stil nicht).
  Gekauft: keine neue Server-Action für „Stil und Geometrie zusammen".
- **Ältere Kreise zeigen Nachkommastellen im Radiusfeld.** Gekauft: Sie
  bleiben unverändert, ohne Sonderlogik.

## Ruled out

- **Griff im Mittelpunkt zum Verschieben** (wie beim Bild-Overlay, jedes
  Loslassen speichert): Der Finger verdeckt den Zielpunkt; bei maximalem Zoom
  zeigt ein Handy nur etwa 70 m, größere Strecken brauchen
  Heraus- und Hineinzoomen samt mehrfachem Speichern, und jedes Loslassen
  geht live an alle Ansichten. Außerdem ist der Griff-Code an Bild-Overlays
  gebunden und müsste verallgemeinert werden. Zuerst gewählt, nach der
  Prüfung zugunsten des Fadenkreuzes verworfen.
- **Zahl zuerst, Mittelpunkt per Fadenkreuz auch beim Anlegen:** Als Ersatz
  des Aufziehens ließe sich kein Kreis mehr ohne Radius malen. Als
  zusätzlicher Anlege-Weg wäre es günstig, weil das Fadenkreuz ohnehin gebaut
  wird – aber ein zweiter Weg für dasselbe, solange nicht feststeht, dass das
  Aufziehen per Touch versagt (siehe `Open concerns`).
- **Direkt ziehen mit Meter-Anzeige und Einrasten (10 m):** Der Radius ließe
  sich nicht exakt setzen, nur in Rasterschritten treffen, und ein
  1000-m-Kreis verlangt Herauszoomen zum Ziehen.
- **Radien als Eigenschaft eines Kartenzeichens**, die beim Verschieben
  mitwandern: Löst nebenbei das gemeinsame Versetzen mehrerer Kreise, das das
  Intent ausdrücklich ausklammert.
- **Übernahme von warnung.bund.de:** Hilft nicht, wenn der Radius nur als Zahl
  ankommt, und zeigt meist nur einen der beiden Kreise.
- **Mittelpunkt als Koordinaten eingeben:** Der Fundort kommt nie als
  Koordinaten an, sondern als Kreuzung oder fremde Karte.
- **Geoman-Bearbeitungsmodus** (eingebaute Griffe für Mitte und Rand): Hat
  dieselben Nachteile wie der Griff beim Verschieben, und der Randgriff trifft
  ohne Einrasten keine exakte Zahl.

## Open concerns

- **Aufziehen per Touch:** Ungeprüft, ob Geoman auf dem Smartphone einen Kreis
  anlegen lässt (Geoman zeichnet Kreise per Tippen auf den Mittelpunkt und
  Tippen auf den Rand, nicht per Ziehen). Klärt sich mit einem Versuch auf
  einem echten Telefon. Versagt es, wäre der zusätzliche Anlege-Weg per
  Fadenkreuz (siehe `Ruled out`) die naheliegende Ergänzung.
