# Ideen

Rückmeldungen aus dem Einsatz (u. a. Cyclassics 2026), als Probleme gefasst
zum Priorisieren. Lösungen sind bewusst offen.

Nach Priorität, die Nummern bleiben stabil:

**Zuerst**
- 4. Kreise lassen sich nicht in einer vorgegebenen Größe zeichnen
- 3. Nach der Adresssuche ist die gesuchte Stelle nicht zu finden
- 5. Text lässt sich nicht frei auf der Karte platzieren
- 7. Bereichsbeschriftungen verdecken Beschriftungen von Kartenzeichen

**Danach**
- 9. Absender, Empfänger und Weg im ETB müssen jedes Mal getippt werden
- 8. Stärkemeldungen stehen nur als Text im ETB, ohne Überblick
- 2. Häufige Zeichen müssen im Einsatz jedes Mal zusammengebaut werden

**Später**
- 1. Die Karte läuft voll mit Einheiten, die gerade nicht im Einsatz sind
- 6. Die Reihenfolge überlappender Bereiche ist nicht steuerbar
- 10. Kein Überblick, welche Einheiten an welchem Einsatz sind

Querschnitt: Viele dieser Probleme betreffen Dinge, die es unabhängig von der
Karte gibt – siehe [Einheiten, Stellen und Einsätze jenseits der
Karte](#einheiten-stellen-und-einsätze-jenseits-der-karte).

**Begriff „Einsatz".** In der Domäne doppelt belegt: das Ereignis, zu dem
Einheiten geschickt werden, und die ganze Lage (z. B. „Cyclassics 2026"). Zur
Trennung hier: **Einsatz** für das Ereignis, **Gesamteinsatz** für die Lage,
**Einsatzstelle** für den Ort eines Einsatzes. Im Code und im Glossar heißt
der Gesamteinsatz heute noch „Einsatz" (`Operation`).

## 1. Die Karte läuft voll mit Einheiten, die gerade nicht im Einsatz sind

**Problem.** Eine Einheit (z. B. eine Streife) wechselt im Lauf eines
Gesamteinsatzes mehrfach zwischen zwei Zuständen: *im Einsatz*, dann zählt
ihre Position, und *wartend*, meist an ihrer UHSt, dann interessiert die
Position nicht. Die Karte kennt nur den ersten Zustand. Wartende Einheiten
stehen als Kartenzeichen irgendwo herum und machen die Karte unübersichtlich.

**Beobachtet.** Der Einsatzleiter bei den Cyclassics hat neben dem
Einsatzgebiet Bereiche „Ablage Streifen" und „Ablage weitere Einsatzmittel"
angelegt, die Einheiten vorab dort erstellt, bei Bedarf auf die Karte gezogen
und danach zurückgelegt.

**Was zählt.** Kritisch ist das Aufräumen: wartende Einheiten aus dem Weg.
Sie sollen aber noch auffindbar sein (aufklappbar reicht), um zu sehen, was
verfügbar ist. Nett wäre ein Hinweis an der UHSt wie „2 Streifen verfügbar".
Von welcher UHSt eine Streife kommt, weiß die Führungskraft auch so.

**Ausgenommen.** Einheiten mit meldendem Gerätelink – erstmal nicht betrachtet.

## 2. Häufige Zeichen müssen im Einsatz jedes Mal zusammengebaut werden

**Problem.** Die Schnellauswahl ist eine feste Liste. Zeichen, die in einem
Gesamteinsatz immer wieder gebraucht werden, aber nicht darin stehen (z. B.
„Einsatz", „Einsatz (vermutlich)", „besondere Lage"), muss die Führungskraft
unter Zeitdruck von Hand zusammenstellen.

**Beobachtet.** Der Einsatzleiter hat sie vorab gebaut und in einem Bereich
„Ablage Ereignis" geparkt, um sie bei Bedarf zu kopieren.

**Was zählt.** Einmal pro Gesamteinsatz anlegen reicht; über Gesamteinsätze
hinweg wiederverwendbar wäre schön, ist aber nicht nötig.

## 3. Nach der Adresssuche ist die gesuchte Stelle nicht zu finden

**Problem.** Die Suche bewegt den Kartenausschnitt, zeigt aber nicht, wo der
Treffer genau liegt. Wer z. B. eine Kreuzung sucht, sucht eine der beiden
Straßen und findet sie dann im Kartenbild nicht.

**Was zählt.** Ziel ist, an genau dieser Stelle ein Kartenzeichen zu setzen.

## 4. Kreise lassen sich nicht in einer vorgegebenen Größe zeichnen

**Problem.** Vorgaben kommen in Metern („500 m Evakuierungsradius"). Die
Führungskraft kann einen Kreis weder in dieser Größe anlegen noch sehen, wie
groß er ist. Sie zeichnet ihn, verschiebt ihn, bis er richtig steht, und passt
ihn bei neuen Informationen erneut an – ohne jedes Mal neu messen zu wollen.

**Nicht gefragt.** Allgemeines Entfernungsmessen: kam nur auf, weil andere
Karten es können; kein konkreter Anwendungsfall.

## 5. Text lässt sich nicht frei auf der Karte platzieren

**Problem.** Beschriften lassen sich nur Kartenzeichen und Bereiche, und die
Bereichsbeschriftung sitzt fest in der Mitte. Bei Evakuierungs- und Warnradius
um denselben Ort liegen beide Texte übereinander. Die Führungskraft würde die
Kreise lieber unbeschriftet lassen und den Text selbst passend hinsetzen.

## 6. Die Reihenfolge überlappender Bereiche ist nicht steuerbar

**Problem.** Liegt ein größerer Bereich über einem kleineren (z. B. Warnradius
über Evakuierungsradius), ist der kleinere schlechter zu sehen und schlechter
anzuklicken. Bisher nicht akut, wird aber relevant.

## 7. Bereichsbeschriftungen verdecken Beschriftungen von Kartenzeichen

**Problem.** Kartenzeichen werden überallhin gezogen; landet ihre Beschriftung
unter der eines Bereichs, ist sie verdeckt. Die Beschriftung des
Kartenzeichens ist die wichtigere.

## 8. Stärkemeldungen stehen nur als Text im ETB, ohne Überblick

**Problem.** Jede UHSt meldet stündlich ihre Stärke: `x/y/z//Σ`, Anzahl
einsatzbereiter Streifen, zuzüglich Praktikanten. Das gehört ins ETB, aber dort
steht es nur als Text. Wie stark jede UHSt gerade ist und wie stark alle
zusammen sind, muss die Führungskraft aus den Einträgen zusammensuchen und
selbst addieren.

**Was zählt.** Eine aktuelle Übersicht je UHSt mit Summe; jede Änderung
dokumentiert im ETB. Eine Verbindung zu den Kartenzeichen ist nicht nötig –
Stärke aus den Einheiten auf der Karte abzuleiten wäre aufwändig und
fehleranfällig.

## 9. Absender, Empfänger und Weg im ETB müssen jedes Mal getippt werden

**Problem.** Viele Einträge haben die Form „Von UHSt-2 an EAL: benötigen RTW
für 42/m mit KoPlaWu, an Gustav-Schleswig-Str. 23". Absender und Empfänger
stammen aus einem kleinen, sich ständig wiederholenden Kreis von Stellen, werden
aber jedes Mal frei getippt. Dasselbe gilt für den Übermittlungsweg (Funk,
Draht …), der meist derselbe ist wie beim vorigen Eintrag.

**Was zählt.** Freitext muss immer möglich bleiben.

## 10. Kein Überblick, welche Einheiten an welchem Einsatz sind

**Problem.** Bei mehreren gleichzeitigen Einsätzen (jeder mit Einsatzstelle)
fehlt der Überblick, welche Einheiten welchem Einsatz zugeordnet sind und wo
diese sich befinden. Ein anderes Tool löst das, aber schlecht.

**Stand.** Langfristig, eher Vision als akuter Bedarf. Nicht primär ein
Kartenproblem.

## Einheiten, Stellen und Einsätze jenseits der Karte

Heute ist alles ein Kartenzeichen; „Einheit" ist laut Glossar nur ein Wort,
kein eigenes Objekt. Die Rückmeldungen zeigen aber Dinge, die unabhängig von
der Karte existieren und nur manchmal darauf erscheinen:

- **Einheiten** (Streifen, RTW, KTW …) – mit Zustand wartend/im Einsatz (1, 10)
- **Stellen** wie UHSt oder EAL – melden Stärke (8), sind Absender und
  Empfänger im ETB (9)
- **Einsätze** mit ihrer Einsatzstelle – bekommen Einheiten zugeordnet (10)

Das ist keine Lösung, sondern ein Hinweis, dass mehrere Probleme vielleicht
dieselbe Ursache haben: Das Werkzeug kennt nur die Karte.
