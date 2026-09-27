# Solution: Hauptansichten über eine Leiste, Karten-Panels als Kartenknöpfe

## Intent

`01-INTENT.md` in diesem Verzeichnis. Übernommen werden C-1 bis C-5.

## Approach

Die Führungsansicht bekommt drei **Hauptansichten**: Lagekarte, ETB und
Stärke (sobald es sie gibt, siehe `intents/2026-09-26-staerkemeldungen/`).
Immer ist genau eine davon zu sehen, und sie füllt die Fläche. Gewechselt wird
über eine **Leiste**: am Handy (unter 768 px Breite, Mantine-Breakpoint `sm`)
unten, am Desktop links als senkrechte Leiste. Dieselben Punkte stehen in
derselben Reihenfolge an beiden Stellen.

Die heutigen Reiter Kartenzeichen, Bereiche und Ebenen gehören zur Lagekarte.
Sie werden zu **Kartenknöpfen** in einer Spalte rechts unten an der Karte, wie
man es aus Karten-Apps kennt. In dieselbe Spalte ziehen alle übrigen
Kartenknöpfe: „Standard-Ausschnitt festlegen" (heute einziger Punkt im
Kartenmenü ⋯ in `SituationMap.tsx`; das Menü entfällt), „Zurück zum
Standard-Ausschnitt" (heute unten rechts). Darunter sitzt Leaflets eigener
Zoom, der dafür auf allen Karten von unten links nach unten rechts zieht
(`leaflet-adapter.ts`, `map.zoomControl.setPosition`). Die Suche oben bekommt
die volle Breite. Der Knopf zum Ein- und Ausklappen der Seitenleiste entfällt.
Ist am Handy ein Blatt offen, wandern die drei Panel-Knöpfe mit nach oben und
sitzen über seiner Kante; die übrigen Knöpfe und der Zoom liegen unter dem
Blatt, bis es schließt. Ein Knopf öffnet sein Panel; es ist immer höchstens
eins offen. Am Handy öffnet das Panel als Blatt über der unteren Hälfte der
Karte, am Desktop als Panel rechts neben der Karte. Der Inhalt der Panels
bleibt, wie er ist. Die Seitenleiste mit ihren Reitern entfällt.

Die **Kopfzeile** am Handy ist 40 px hoch und zeigt den gekürzten Einsatznamen,
den Status und ein Menü ⋮ mit „Teilen" und „Zurück zu Einsätze". Ein Tipp auf
den Namen zeigt ihn vollständig. Am Desktop bleibt die Kopfzeile wie heute.

Beim Wechsel der Hauptansicht bleiben alle Ansichten geladen und werden nur
versteckt. So gehen weder ein angefangener ETB-Eintrag noch der
Kartenausschnitt verloren. Heute baut die Seitenleiste einen Reiter beim
Wechsel ab (`keepMounted={false}` in `src/map/SituationWorkspace.tsx`), und ein
Entwurf geht dabei verloren. Dass die Karte nach dem Wiedereinblenden ihre
Größe neu bestimmt, erledigt bereits der `ResizeObserver` in
`leaflet-adapter.ts` (getestet in `leaflet-adapter.resize.test.ts`).

Welche Hauptansicht beim Öffnen gilt (AC-14), entscheidet bis zum Laden von
JavaScript CSS: Im serverseitig gerenderten HTML ist unter `sm` das ETB zu
sehen, ab `sm` die Lagekarte. So ist das ETB am Handy lesbar, bevor JavaScript
geladen ist, und nichts blitzt auf. Beim ersten Rendern im Browser liest die
Seite per `matchMedia` die Breite und legt die Hauptansicht ausdrücklich fest
(ETB bzw. Lagekarte); ab dann entscheidet nur noch dieser Zustand, und CSS
blendet nichts mehr nach Breite um.

**Modi auf der Karte.** Ist ein Kartenzeichen zum Platzieren gewählt, wird ein
Bereich gezeichnet oder ein Bild-Overlay bearbeitet, zeigt die Karte oben ein
Band mit dem Modus und „Abbrechen" bzw. „Fertig". Heute ist das nur im Panel
zu sehen, das am Handy in diesen Modi geschlossen ist (AC-8). Ein Wechsel der
Hauptansicht bricht einen Modus ab, damit ein späterer Tipp auf die Karte
nicht unerwartet ein Zeichen setzt.

Die Wahl fiel auf B. Die Kriterien waren vorab abgestimmt, in dieser
Reihenfolge: Wechsel zwischen ETB und Karte, Platz fürs ETB, ein Muster für
alle Größen, Umbauaufwand. B liegt beim Wechsel gleichauf mit dem Umschalter
oben (A) und gewinnt am Handy durch die Daumenreichweite und durch die
Tastatur, die die Leiste verdrängt. Die Kartenknöpfe statt „Mehr" hat der
Nutzer vorgegeben.

Mockup: `specimens/B-leiste-unten.html`.

**Verhältnis zur Stärke-Lösung.** Die Stärke-Lösung
(`intents/2026-09-26-staerkemeldungen/02-SOLUTION.md`) plant „Stärke" als
Reiter der Seitenleiste. Wird diese Lösung zuerst gebaut, wird „Stärke"
stattdessen der dritte Punkt der Leiste. Wird die Stärke zuerst gebaut, zieht
ihr Reiter mit dieser Lösung in die Leiste um. Die Stärke-Lösung verlangt nur
Bedienbarkeit bei 360 px Breite (dort AC-15), nicht einen bestimmten Ort.

## Behaviour

Handy heißt unter 768 px Breite, Desktop ab 768 px. Gemessen wird wie im Intent
bei 360 × 640 Pixeln mit dem Einsatznamen „Cyclassics 2026 – Einsatzabschnitt 4
Nord".

- **AC-1** Am Handy steht unten eine 56 px hohe Leiste mit den Punkten
  Lagekarte, ETB und (sobald es sie gibt) Stärke. Ein Tipp zeigt die gewählte
  Hauptansicht über die ganze Fläche zwischen Kopfzeile und Leiste. *(C-1,
  C-4, C-5)*
- **AC-2** Während am Handy das ETB oder die Stärke zu sehen ist, ist die
  Lagekarte nirgends sichtbar, und deren Inhalt nimmt die volle Breite ein,
  abzüglich höchstens 16 px Rand je Seite. *(C-1, C-5)*
- **AC-3** Am Handy ist die Kopfzeile 40 px hoch. Zusammen mit der Leiste
  belegen Bedienelemente außerhalb der Hauptansicht 96 px. *(C-2, C-5)*
- **AC-4** Ist am Handy die Bildschirmtastatur offen, ist die Leiste
  ausgeblendet; sie erscheint wieder, sobald die Tastatur geschlossen ist,
  auch wenn das Textfeld den Fokus behält (Android schließt die Tastatur mit
  „Zurück", ohne den Fokus zu nehmen). Erkannt wird die Tastatur daran, dass
  `visualViewport.height` um mehr als 150 px unter `window.innerHeight` liegt;
  ohne `visualViewport` bleibt die Leiste immer sichtbar. *(C-2, C-4)*
- **AC-5** Die Kopfzeile am Handy zeigt den Einsatznamen in einer Zeile,
  gekürzt mit „…", dazu den Status und einen Knopf ⋮. Ein Tipp auf den Namen
  zeigt ihn vollständig in einem Popover. Das Menü ⋮ enthält „Teilen" (öffnet
  die bestehende Verwaltung der Ansichtslinks) und „Zurück zu Einsätze".
  *(C-3)*
- **AC-6** Auf der Lagekarte steht rechts unten eine Spalte von Kartenknöpfen,
  von oben nach unten: Kartenzeichen, Bereiche, Ebenen, Standard-Ausschnitt
  festlegen, Zurück zum Standard-Ausschnitt; darunter Leaflets Zoom + und −,
  der auf allen Karten (auch Geräte- und Ansichtslink-Ansicht) unten rechts
  steht. Jeder Knopf hat ein Symbol und einen zugänglichen Namen. Die Spalte
  hält Abstand zu Zoom und Attributionszeile. Ist am Handy ein Blatt offen
  (AC-7), sitzen die drei Panel-Knöpfe direkt über dessen Kante und bleiben
  antippbar; die übrigen Knöpfe (Festlegen, Zurück) sind ausgeblendet und der
  Zoom liegt unter dem Blatt, bis es schließt. Bei 360 × 640 hätten alle
  sieben Knöpfe über dem Blatt keinen Platz. Ein Tipp öffnet das Panel mit dem
  Inhalt des heutigen Reiters. Ein Tipp auf einen anderen Knopf wechselt das
  Panel, ein Tipp auf den Knopf des offenen Panels oder auf ✕ schließt es.
  *(C-3)*
- **AC-7** Am Handy öffnet ein Panel als Blatt über der unteren Hälfte der
  Kartenfläche, mit Titel und ✕. Das Blatt lässt sich nicht ziehen, sein
  Inhalt scrollt. *(C-3)*
- **AC-8** Wird am Handy ein Kartenzeichen zum Platzieren gewählt, das
  Zeichnen eines Bereichs begonnen oder aus dem Panel ein Kartenzeichen
  angesprungen, oder beginnt das Bearbeiten eines Bild-Overlays, schließt das
  Blatt. *(C-3)*
- **AC-9** Beim Wechsel zwischen Hauptansichten bleiben ein angefangener
  ETB-Eintrag (und ein angefangenes Stärke-Formular) und der Kartenausschnitt
  erhalten. *(C-4)*
- **AC-10** Nach dem Wechsel zur Lagekarte füllt die Karte die Fläche ohne
  graue, nicht geladene Ränder. *(C-4)*
- **AC-11** Bei 360 px Breite scrollt nichts waagerecht: keine Hauptansicht,
  keine Kopfzeile, keine Leiste, kein Blatt und kein Modal. *(C-3)*
- **AC-12** Am Desktop steht die Leiste links, 72 px breit, mit denselben
  Punkten in derselben Reihenfolge. Die Kopfzeile bleibt bis auf AC-22 wie
  heute. *(Constraint: alle Funktionen auf jeder Größe)*
- **AC-13** Am Desktop wird das ETB auf höchstens 720 px Breite begrenzt und
  links ausgerichtet. *(Constraint: alle Funktionen auf jeder Größe)*
- **AC-14** Beim Öffnen der Führungsansicht ist am Handy das ETB die
  Hauptansicht, am Desktop die Lagekarte, schon bevor JavaScript geladen ist.
  *(C-1)*
- **AC-15** Jede Funktion, die heute über Kopfzeile oder Seitenleiste
  erreichbar ist, ist auf beiden Größen weiter erreichbar. *(Constraint)*
- **AC-17** Kommen per Live-Aktualisierung neue ETB-Einträge an, während eine
  andere Hauptansicht als das ETB zu sehen ist, zeigt der Punkt „ETB" in der
  Leiste ihre Anzahl. Gezählt werden nur Einträge, deren Urheber nicht der
  angemeldete Nutzer ist. Ein Wechsel ins ETB setzt den Zähler auf null. Der
  Zähler lebt nur in der geöffneten Seite: Grundlage ist die höchste
  Eintragsnummer, die zu sehen war, als das ETB zuletzt offen war; nach dem
  Neuladen beginnt er bei null. Beim Laden der Seite gelten alle vorhandenen
  Einträge als gesehen, auch wenn das ETB noch nicht offen war. Gespeichert
  wird nichts. *(C-4; vom Nutzer als Ausgleich dafür gewünscht, dass Karte und
  ETB nicht mehr gleichzeitig zu sehen sind)*
- **AC-18** Solange ein Kartenzeichen zum Platzieren gewählt ist, ein Bereich
  gezeichnet oder ein Bild-Overlay bearbeitet wird, zeigt die Karte oben ein
  Band mit dem Modus („Kartenzeichen platzieren", „Bereich zeichnen",
  „Bild-Overlay bearbeiten") und einem Knopf „Abbrechen" bzw. beim
  Bild-Overlay „Fertig". Das Band sitzt direkt unter der Suche. Deckkraft,
  Ersetzen und Löschen des Bild-Overlays bleiben im Panel Ebenen; es während
  des Bearbeitens zu öffnen, beendet den Modus nicht. *(C-3)*
- **AC-19** Ein Wechsel der Hauptansicht bricht Platzieren und Zeichnen ab und
  beendet das Bearbeiten eines Bild-Overlays. *(C-4)*
- **AC-20** „Standard-Ausschnitt festlegen" fragt vor dem Speichern nach in
  einem Modal („Aktuellen Ausschnitt als Standard festlegen?" mit „Festlegen"
  und „Abbrechen"); erst die Bestätigung speichert. Das Kartenmenü ⋯ gibt es
  nicht mehr. *(C-3, Constraint)*
- **AC-21** Die Suche oben auf der Karte nimmt am Handy die volle Breite ein,
  abzüglich 12 px Rand je Seite, und überdeckt keinen Kartenknopf. *(C-3)*
- **AC-22** Ist die Live-Verbindung getrennt, zeigt die Kopfzeile neben dem
  Status ein orangefarbenes Symbol mit dem zugänglichen Namen „Verbindung
  getrennt – wird automatisch wiederhergestellt"; ein Tipp zeigt diesen Text.
  Der bisherige Hinweisbalken über der Arbeitsfläche entfällt. Ein
  Kartenfehler (heute roter Balken, `mapError`) erscheint als schließbare
  Meldung über der Karte, ohne die Arbeitsfläche zu verkleinern. Beides gilt
  auf beiden Größen. *(C-2; vom Nutzer entschieden, Variante b)*
- **AC-23** Am Desktop gibt es die Kartenknöpfe wie in AC-6; das Panel öffnet
  rechts neben der Karte, 360 px breit, und verkleinert die Karte.
  *(Constraint: alle Funktionen auf jeder Größe)*
- **AC-24** Beim Wechsel zwischen Hauptansichten bleibt ein offenes
  Kartenpanel erhalten. *(C-4)*
- **AC-25** Beim Öffnen der Führungsansicht ist kein Kartenpanel offen. *(C-1)*

## Edge cases

- **Fenster wird über 768 px hinweg verbreitert oder verschmälert** (Tablet
  oder großes Handy drehen): Die Hauptansicht bleibt, auch wenn sie noch nie
  per Tipp gewählt wurde (sie ist seit dem ersten Rendern festgelegt). Ein
  offenes Panel bleibt; nur Ort der Leiste und Form des Panels wechseln. Ein
  Modus auf der Karte läuft weiter.
- **Verbindung getrennt oder Kartenfehler:** siehe AC-22. Keiner der beiden
  Hinweise verschiebt die Hauptansicht; C-2 gilt auch dann.
- **Ein Kartenzeichen wird aus dem Panel „Kartenzeichen" angesprungen**
  (`jumpTo`): Am Handy schließt das Blatt (AC-8), damit das Ziel nicht
  darunter liegt. Die Karten-Schnittstelle muss dafür nichts Neues können.
- **Kartenzeichen-Detail, Bereich-Editor und „Erweitert …"** sind heute
  Modale. Sie bleiben Modale, auf beiden Größen.
- **Namen der Urheber für AC-17:** Die Seite muss dem Client den Nutzernamen
  des angemeldeten Nutzers mitgeben; heute tut sie das nicht.
- **Stärke gibt es noch nicht:** Die Leiste hat zwei Punkte.

## Non-goals

- Das Blatt am Handy ziehen oder in Stufen einrasten lassen.
- Ein gespeicherter Gelesen-Zustand je Nutzer oder Gerät; der Zähler aus
  AC-17 gilt nur für die geöffnete Seite.
- Die zuletzt gewählte Hauptansicht über ein Neuladen hinweg merken.
- Karte und ETB am Desktop gleichzeitig zeigen.
- Geräte- und Ansichtslink-Ansicht (`DeviceView`, `ViewLinkView`), laut Intent
  ausgeschlossen. Einzige Berührung: Ihr Zoom steht künftig unten rechts wie
  überall.
- Kartenwerkzeuge selbst am Handy verbessern (Zeichnen, Platzieren), laut
  Intent ausgeschlossen.

## Accepted tradeoffs

- **Am Desktop sind Karte und ETB nicht mehr gleichzeitig zu sehen.** Wer im
  ELW Karte und ETB zusammen braucht, wechselt mit einem Klick. Dafür bedient
  sich die Führungsansicht auf jeder Größe gleich. (Vom Nutzer entschieden:
  „Wenn es dort dann auch zwei Tabs sind, ist das auch ok.")
- **Kartenzeichen, Bereiche und Ebenen sind vom ETB aus zwei Tipps entfernt**
  statt einem. Dafür gehören sie sichtbar zur Karte und belegen keinen Platz in
  der Leiste. (Vom Nutzer entschieden; C-3 entsprechend geändert.)
- **„Zurück zu Einsätze" und „Teilen" liegen am Handy im Menü** und sind damit
  einen Tipp entfernt. Dafür passt die Kopfzeile in 40 px ohne Umbruch. (Vom
  Nutzer entschieden, „Zurück" ins Menü.)
- **Alle Hauptansichten bleiben geladen.** Das kostet Speicher und hält die
  Karte auch dann im Speicher, wenn nur das ETB genutzt wird. Dafür gehen
  Entwürfe und Kartenausschnitt beim Wechsel nicht verloren.
- **Ein Blatt über der halben Karte** verdeckt beim Arbeiten im Panel die
  untere Kartenhälfte. Dafür braucht es keine Wischgesten, die mit dem Scrollen
  im Panel kollidieren könnten.
- **Ein offenes Blatt verdeckt die untere Kartenhälfte samt
  Attributionszeile.** Die drei Panel-Knöpfe wandern mit; Festlegen, Zurück
  zum Standard-Ausschnitt, Zoom und die Attribution (und damit Impressum und
  Datenschutz) sind erst nach ✕ wieder da. Dafür bleibt über dem Blatt Platz
  für die Karte statt für eine Knopfsäule.
- **„Standard-Ausschnitt festlegen" ist ein Knopf mit Rückfrage** statt ein
  Menüpunkt: weiter zwei Tipps, aber sichtbar. Dafür entfällt das Menü ⋯ mit
  nur einem Eintrag. (Vom Nutzer entschieden.)
- **Der Zoom zieht auf allen Karten nach unten rechts,** auch in Geräte- und
  Ansichtslink-Ansicht, die der Intent sonst ausschließt. Wer ihn dort unten
  links gewohnt ist, sucht ihn anfangs. Dafür gibt es nur eine Zoom-Variante:
  Leaflets eigenen Zoom, umgesetzt mit einer Zeile, ohne eigene Zoom-Knöpfe und
  ohne neue Adapter-Option. (Vom Nutzer entschieden.)
- **Impressum und Datenschutz** stehen nur in der Attributionszeile der Karte.
  Aus ETB und Stärke heraus sind sie einen Tipp entfernt (zur Lagekarte).
- **Zwei Formen desselben Panels** (Blatt am Handy, Panel rechts am Desktop)
  müssen gepflegt werden, bei gleichem Inhalt.

- **Startansicht zuerst per CSS, dann per Media-Query.** Bis JavaScript
  geladen ist, sind Karte und ETB beide gerendert und CSS blendet je nach
  Breite eins aus; danach legt `matchMedia` die Ansicht einmal fest. Das kostet
  eine kleine Sonderregel an einer Stelle, spart aber ein leeres Bild bis zum
  Laden von JavaScript, gerade im schwachen Mobilnetz.

## Ruled out

- **A: Umschalter oben.** Lagekarte | ETB | Stärke als Umschalter unter der
  Kopfzeile. Gleichauf beim Wechsel und fast gleichauf beim Platz, aber am
  Handy außerhalb der Daumenreichweite. Den Platz mit offener Tastatur könnte
  A genauso gewinnen, indem der Umschalter beim Tippen verschwindet; das
  unterscheidet die beiden nicht.
- **C: Seitenleiste als ziehbares Blatt über der Karte.** Die Karte bleibt
  Hintergrund, das Blatt rastet in drei Stufen ein. Wischgesten kollidieren
  mit dem Scrollen im ETB, fünf Reiter auf 360 px sind eng, und es entsteht
  kein Muster, das auch am Desktop trägt. Höchster Umbauaufwand.
- **D: Eigene ETB-Seite.** Das ETB zusätzlich unter eigener Adresse. Am
  billigsten und mit dem meisten Platz, aber der Wechsel zur Karte lädt eine
  andere Seite, ein Entwurf geht verloren, und das ETB gäbe es an zwei Orten.
- **B mit „Mehr" für die Karten-Reiter** (die erste Fassung von B).
  Kartenzeichen, Bereiche und Ebenen hätten unter einem vierten Punkt „Mehr"
  gelegen, getrennt von der Karte, zu der sie gehören. Vom Nutzer verworfen.
