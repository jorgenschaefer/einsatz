# Intent: Stärke der Stellen ablesen statt zusammensuchen

## Problem

Eine Führungsstelle (z. B. eine Einsatzabschnittsleitung, EAL) muss regelmäßig
die Stärke ihres Einsatzabschnitts nach oben melden. Dazu fragt sie die ihr
unterstellten Stellen ab (Unfallhilfsstellen, Bereitstellungsräume,
Rettungsmittelhalteplätze …) und addiert deren Meldungen. Die Meldungen landen
im ETB, aber nur als Freitext, verteilt über viele Einträge. Daraus lässt sich
weder ablesen, wie stark jede Stelle gerade ist und von wann diese Meldung
stammt, noch wie stark alle zusammen sind, noch wie sich die Stellen und die
Summe im Lauf des Einsatzes entwickelt haben. Die Führungskraft führt dafür
eine zweite Aufzeichnung neben dem Werkzeug. Stattdessen soll sie die aktuelle
Stärke jeder Stelle mit ihrem Zeitpunkt, die Summe und die Entwicklung direkt
ablesen können, ohne nachzurechnen und ohne zweite Aufzeichnung. Jede Meldung
bleibt im ETB dokumentiert.

## Evidence

- Cyclassics 2026, Einsatzabschnitt 4: Die EAL hat das Werkzeug genutzt. Die
  Einsatzleitung fragte stündlich nach der Stärke des Abschnitts; die EAL
  fragte dafür stündlich ihre 4 UHSt ab und gab die Summe weiter. (Mündlich
  vom Nutzer.)
- Dabei führte die EAL eine separate Papierliste, weil sich die Stärken aus
  dem ETB schlecht herauslesen lassen. Auf dem Papier war auch die
  Entwicklung sichtbar („UHSt 3 meldet jetzt 2 Einsatzkräfte weniger als vor
  einer Stunde"). (Mündlich vom Nutzer.)
- Format einer Meldung laut `IDEAS.md`, Punkt 8: `x/y/z//Σ`, Anzahl
  einsatzbereiter Streifen, zuzüglich Praktikanten. Vom Nutzer präzisiert am
  Beispiel „UHSt 3, 0/1/6//7, 2 zusätzliche Personen, 2 einsatzbereite
  Streifen": Stelle „UHSt 3", Stärke 0/1/6//7, zusätzliches Personal 2,
  Gesamtpersonen 9, Notiz „2 einsatzbereite Streifen". Relevant ist vor allem
  das zusätzliche Personal; die Anzahl Einheiten nur begrenzt, sie reicht als
  Notiz.
- ETB-Einträge sind heute Freitext mit einem Typ; Handeinträge haben den Typ
  `manuell` (`src/server/journal/journal.ts`). Im Code gibt es nichts zu
  Stärke oder Stärkemeldungen (`grep -ri "stärke\|strength" src`: keine
  Treffer).

## Done when

- **C-1** Für jede Stelle kann die Führungskraft ihre letzte Stärkemeldung
  mit deren Uhrzeit ablesen, ohne ETB-Einträge zu öffnen oder zu durchsuchen:
  Führer, Unterführer, Helfer, Gesamt (x/y/z//Σ), zusätzliches Personal,
  Gesamtpersonen (Σ + zusätzliches Personal) und die Notiz.
- **C-2** Die Führungskraft kann die Summe jedes Zahlenwerts aus C-1 über die
  ihr unterstellten Stellen ablesen, ohne selbst zu addieren.
- **C-3** Zur Summe ist ablesbar, von wann die älteste darin enthaltene
  Meldung stammt; Meldungen mit 0 Gesamtpersonen (etwa einer abgebauten
  Stelle) zählen dabei nicht. (Ausnahme vom Nutzer bei der Lösungssuche
  entschieden: „Gesamtpersonenzahl 0 heißt keine ‚veraltet'-Meldung.")
- **C-4** Für jede Stelle kann die Führungskraft alle früheren Meldungen
  dieses Gesamteinsatzes mit ihren Werten und Uhrzeiten ablesen, ebenso die
  früheren Summen mit dem Zeitpunkt, zu dem sie galten – ohne ETB-Einträge zu
  öffnen oder zu durchsuchen (vom Nutzer so gefasst: Verlauf der Werte statt
  nur der Veränderung zur vorigen Meldung).
- **C-5** Jede Stärkemeldung erscheint als ETB-Eintrag mit Stelle, Uhrzeit,
  allen gemeldeten Werten und der Notiz.
- **C-6** Die EAL-Runde der Cyclassics (4 Stellen, stündlich, über einen
  ganzen Einsatztag) lässt sich im Werkzeug abbilden, ohne dass die
  Führungskraft eine zweite Aufzeichnung braucht, um C-1 bis C-4 zu
  beantworten.
- **C-7** Eine falsch erfasste Stärkemeldung lässt sich korrigieren. Danach
  zeigen C-1 bis C-4 die korrigierten Werte, und im Verlauf der Stelle
  erscheint die Meldung einmal mit den korrigierten Werten, nicht als
  zusätzliche Meldung. Im ETB bleibt die ursprüngliche Fassung als
  Korrektur-Historie sichtbar. (Vom Nutzer gewünscht; ohne Korrektur stünde
  bis zur nächsten Meldung ein falscher Wert als aktuell da und dauerhaft im
  Verlauf.)
- **C-8** Gibt die Führungskraft die Gesamtstärke an die übergeordnete
  Führungsstelle weiter, steht im ETB, welche Summe sie wann weitergegeben
  hat, ohne dass sie die Werte dafür abtippen muss. (Vom Nutzer nachgereicht
  bei der Lösungssuche: „Die aktuelle Gesamtmeldung wird so an die EL
  gemeldet, das gehört ins ETB.")

## Constraints

- Eine Stelle muss keinen Ort auf der Lagekarte haben. Eine Lösung, die das
  Platzieren einer Stelle auf der Karte voraussetzt, scheidet aus.
- Die Führungsansicht wird im Einsatz auf dem Smartphone bedient: Ein
  Screenshot vom Gesamteinsatz „Cyclassics 2026" zeigt sie im Mobilbrowser
  eines Android-Telefons (vom Nutzer im Gespräch gezeigt, nicht im Repo
  archiviert). Eine Lösung, die nur am großen Bildschirm bedienbar ist,
  scheidet aus (vom Nutzer für diese Übersicht bestätigt: „Smartphone sollte
  funktionieren").
- Die Beweiskraft des ETB bleibt erhalten: nicht editierbare Zeitstempel,
  Korrekturen als sichtbare Historie. Eine Lösung, die gemeldete Werte ohne
  Spur im ETB überschreibt, scheidet aus.

## Not this

- Einheiten als eigene Objekte mit Zustand wartend/im Einsatz (`IDEAS.md`, 1).
- Welche Einheiten an welchem Einsatz sind (`IDEAS.md`, 10).
- Einsätze (Schadensereignisse) zählen – aus derselben Idee, zurückgestellt.
- Absender, Empfänger und Übermittlungsweg im ETB vorbelegen (`IDEAS.md`, 9).
- Die Stärke aus den Kartenzeichen ableiten – laut `IDEAS.md`, 8 aufwändig und
  fehleranfällig, nicht gewünscht.
- Die Summe an die übergeordnete Führungsstelle übermitteln; das geschieht
  weiter per Funk oder Draht. Nur das Dokumentieren der Weitergabe gehört
  dazu (C-8).

## User's solution

„Die aktuelle Anwendung ist Kartenzentriert. Im realen Einsatz gibt es andere
Sichtweisen, die nur peripher an der Karte hängen: Ressourcen, Wache und
Einsätze. Eine Wache (schlechter Name – Obermenge von Wache,
Unfallhilfsstelle, Bereitstellungsraum, Rettungsmittelhalteplatz etc.) ist
ein Ort, an dem Ressourcen stehen. Wachen berichten regelmäßig deren Stärke
(Stärkemeldung im Katastrophenschutz mit X/Y/Z//G zzgl. ‚andere') und den
noch vorhandenen Einheiten. […] Stärkemeldungen der Wachen und Anzahl der
Einsätze werden gezählt. Es ist möglich, aber nicht nötig, dass Wachen,
Ressourcen und Einsätze einen Ort haben – theoretisch geht das komplett ohne
Lagekarte – aber alle Änderungen tauchen im ETB auf."
