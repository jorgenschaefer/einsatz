# Solution: Stellen mit Stärkemeldungen in eigener Ansicht

## Intent

`01-INTENT.md` in diesem Verzeichnis. Übernommen werden C-1 bis C-8.

## Approach

Zu jedem Gesamteinsatz legt die Führungskraft ihre **Stellen** an (z. B.
„UHSt 1" … „UHSt 4"). Eine Stelle ist ein Name und hat weder Ort noch
Kartenzeichen. Zu jeder Stelle gibt es **Stärkemeldungen**. Eine Meldung
speichert Führer, Unterführer, Helfer, zusätzliches Personal und eine
optionale Notiz. Σ (Führer + Unterführer + Helfer) und Gesamtpersonen
(Σ + zusätzliches Personal) werden nie gespeichert, sondern immer berechnet.
Die Uhrzeit einer Meldung ist ihr Erfassungszeitpunkt und lässt sich wie ein
ETB-Zeitstempel nicht ändern.

Neben Lagekarte und ETB kommt eine dritte Hauptansicht **„Stärke"** hinzu.
Oben steht die Summe mit dem Zeitpunkt der ältesten darin enthaltenen Meldung
und dem Knopf „Gesamtstärke melden". Darunter steht eine Karte je Stelle mit
ihrer letzten Meldung. Tippt die Führungskraft eine Stelle an, öffnet sich das
Formular für eine neue Meldung, vorbelegt mit den letzten Werten, dazu der
Knopf „Unverändert melden" und der Verlauf der Stelle. Der Summenverlauf ist
über die Summenkarte erreichbar.

Jede Änderung steht im ETB, mit dem Nutzer als Urheber:

- eine Stelle anlegen oder umbenennen: neuer Eintrag,
- eine Meldung erfassen: neuer Eintrag,
- eine Meldung korrigieren oder annullieren: am ursprünglichen Eintrag, mit
  dem bestehenden Mechanismus für Handeinträge (durchgestrichene Vorfassung
  bzw. durchgestrichener Eintrag),
- die Gesamtstärke melden: neuer Eintrag.

Diese Einträge sind keine automatischen Einträge. Sie sind Funkverkehr, den
die Führungskraft erfasst: Sie tragen kein Badge „automatisch", und
„Automatische ausblenden" blendet sie nicht aus. Eine Meldung korrigiert
und annulliert man nur in der Ansicht „Stärke", damit Tabelle und ETB nicht
auseinanderlaufen; im ETB hat ihr Eintrag kein „⋯"-Menü. Übersicht und Verlauf
zeigen nur die gültige Fassung, das ETB zeigt die ursprüngliche daneben
durchgestrichen (C-7).

Die Wahl fiel auf B, weil nur eigene Stellen zwei Dinge leisten: Ein Tippfehler
im Namen kann keine zusätzliche Stelle erzeugen, und die letzten Werte lassen
sich vorbelegen. Der Nutzer hat B direkt gewählt; die vorgeschlagenen Kriterien
wurden nicht mehr abgestimmt.

**Stelle** und **Stärkemeldung** kommen als Begriffe in
`UBIQUITOUS_LANGUAGE.md`, ebenso **Gesamteinsatz** als Sprechweise für den
Einsatz (`Operation`) in Abgrenzung zum Einsatz als Schadensereignis (siehe
`IDEAS.md`). Die Einträge **Korrigieren** und **Annullieren** gelten dort
heute nur für manuelle ETB-Einträge; sie werden erweitert: Annullieren auch
für „Gesamtstärke gemeldet" und für Stärkemeldungen, Korrigieren auch für
Stärkemeldungen (beides nur in der Ansicht „Stärke").

**Datenmodell.** Zwei neue Tabellen:

- *Stellen*: Id, Einsatz, Name, Anlagezeit.
- *Stärkemeldungen*: Id, Stelle, Führer, Unterführer, Helfer, zusätzliches
  Personal, Notiz und ein Verweis auf den ETB-Eintrag, der die Meldung
  festhält.

Die Meldung hat keine eigene Uhrzeit und keinen eigenen Zustand. Beides kommt
aus ihrem ETB-Eintrag: Uhrzeit ist dessen `created_at`, gültig/annulliert
dessen `state`. Die Reihenfolge der Meldungen ist die Nummer ihres
ETB-Eintrags. Meldung und Eintrag entstehen in derselben Transaktion. Eine
Korrektur ändert die Meldungszeile direkt und korrigiert in derselben
Transaktion den ETB-Eintrag über den bestehenden Fassungsmechanismus
(`journal_entry_revisions`). Eine eigene Fassungstabelle für Meldungen gibt es
nicht. Beide Fremdschlüssel (Stelle → Einsatz, Meldung → Stelle) und der
Verweis auf den ETB-Eintrag löschen kaskadierend, damit `deleteOperation`
weiter funktioniert.

Neue Werte für `JournalEntryType` (in `src/server/journal/journal.ts` und in
der Kopie in `JournalPanel.tsx`): `stelle-angelegt`, `stelle-umbenannt`,
`stärkemeldung`, `gesamtstärke-gemeldet`. „Automatisch" sind weiterhin nur
`einsatz-eröffnet` und `einsatz-geschlossen`. Im ETB korrigierbar bleibt nur
`manuell`; annullierbar sind `manuell` und `gesamtstärke-gemeldet`. Im
„⋯"-Menü eines `gesamtstärke-gemeldet`-Eintrags steht deshalb nur
„Annullieren …". `stärkemeldung`-Einträge ändert nur die Ansicht „Stärke",
Einträge zu Stellen sind unantastbar.

„Stärke" wird der dritte Punkt der Hauptansichtsleiste (`MainViewBar`, nach
Lagekarte und ETB): am Smartphone die Leiste unten, am Desktop die Leiste
links. Wie die beiden anderen Ansichten bleibt sie beim Wechsel eingehängt,
damit ein angefangenes Meldungsformular erhalten bleibt.

Mockup: `specimens/B-stellen-mit-meldungen.html`.

## Behaviour

- **AC-1** In der Ansicht „Stärke" legt die Führungskraft eine Stelle mit einem
  Namen an. Der Name wird getrimmt und darf nicht leer sein. Innerhalb eines
  Gesamteinsatzes ist er eindeutig, ohne Rücksicht auf Groß- und
  Kleinschreibung („UHSt 3" und „uhst 3" gelten als dieselbe Stelle). Es
  entsteht der ETB-Eintrag „Stelle angelegt: UHSt 3". *(C-1, C-2)*
- **AC-2** Die Führungskraft kann eine Stelle umbenennen, mit denselben Regeln
  für den Namen; eine Umbenennung, die nur die Groß- und Kleinschreibung
  ändert, ist erlaubt. Ihre Meldungen bleiben an ihr. Es entsteht der
  ETB-Eintrag „Stelle umbenannt: UHSt 3 → UHSt 3 Nord". *(C-1)*
- **AC-3** Für eine Stelle wird eine Meldung erfasst. Führer, Unterführer,
  Helfer und zusätzliches Personal sind ganze Zahlen ab 0 und werden mit der
  Zifferntastatur eingegeben; die Notiz ist Freitext und optional. Σ und
  Gesamtpersonen zeigt das Formular berechnet an. Bei der ersten Meldung einer
  Stelle stehen alle Zahlen auf 0, danach sind die Werte der letzten gültigen
  Meldung vorbelegt, Notiz eingeschlossen. *(C-1, C-6)*
- **AC-4** „Unverändert melden" legt mit einem Tipp eine neue Meldung mit den
  Werten und der Notiz der letzten gültigen Meldung an. Hat die Stelle noch
  keine Meldung, ist der Knopf nicht vorhanden. *(C-6)*
- **AC-5** Jede erfasste Meldung schreibt einen ETB-Eintrag im
  Format „Stärkemeldung UHSt 3: 0/1/6//7, +2 zusätzlich, 9 Personen – 2
  einsatzbereite Streifen". Ohne Notiz entfällt „ – …". Der Zeitstempel des
  Eintrags ist die Uhrzeit der Meldung. *(C-5)*
- **AC-6** Für jede Stelle zeigt die Ansicht die letzte gültige Meldung mit
  Führer/Unterführer/Helfer//Σ, zusätzlichem Personal, Gesamtpersonen, Notiz
  und Uhrzeit. Eine Stelle ohne gültige Meldung zeigt „noch keine Meldung".
  *(C-1)*
- **AC-7** Die Summe addiert Führer, Unterführer, Helfer, Σ, zusätzliches
  Personal und Gesamtpersonen über die letzte gültige Meldung jeder Stelle.
  Stellen ohne gültige Meldung zählen nicht mit. *(C-2)*
- **AC-8** Zur Summe steht die Uhrzeit der ältesten Meldung, die in sie
  eingeht. Ist diese älter als 60 Minuten, wird sie hervorgehoben, ebenso die
  Uhrzeit jeder Stellenkarte, deren letzte Meldung älter als 60 Minuten ist.
  *(C-3)*
- **AC-9** Der Verlauf einer Stelle listet alle ihre gültigen Meldungen,
  neueste zuerst, jeweils mit Uhrzeit, allen Werten und Notiz. *(C-4)*
- **AC-10** Der Summenverlauf hat eine Zeile je gültiger Meldung, neueste
  zuerst. Jede Zeile trägt die Uhrzeit dieser Meldung und die Summe, die zu
  diesem Zeitpunkt galt: die jüngste gültige Meldung jeder Stelle mit Uhrzeit
  ≤ der Zeile. *(C-4)*
- **AC-11** Eine Meldung lässt sich korrigieren. Ändern lassen sich Stelle,
  Werte und Notiz, die Uhrzeit bleibt. Danach zeigen AC-6 bis AC-10 überall
  die korrigierten Werte, auch in früheren Zeilen des Summenverlaufs, und die
  Meldung steht einmal im Verlauf ihrer (neuen) Stelle. Ihr ETB-Eintrag
  wird korrigiert wie ein Handeintrag heute: Die bisherige Fassung bleibt
  durchgestrichen mit Urheber und Zeit stehen, die neue Fassung im Format aus
  AC-5 (mit dem Stellennamen zum Zeitpunkt der Korrektur) wird zur aktuellen,
  mit „korrigiert hh:mm". Nummer und Zeitstempel des Eintrags bleiben.
  *(C-7, C-5)*
- **AC-12** Eine Meldung lässt sich annullieren, z. B. wenn sie versehentlich
  erfasst wurde. Wie im ETB fragt vorher ein Modal nach der Bestätigung.
  Danach fällt sie aus AC-6 bis AC-10 heraus. Ihr ETB-Eintrag wird
  annulliert wie ein Handeintrag heute: Er bleibt mit Nummer und Text
  durchgestrichen stehen. Eine annullierte Meldung lässt sich weder
  korrigieren noch wiederherstellen. *(C-7)*
- **AC-13** „Gesamtstärke melden" schreibt den ETB-Eintrag
  „Gesamtstärke gemeldet: 2/6/25//33, +6 zusätzlich, 39 Personen (4 Stellen,
  älteste Meldung 10:10)" mit den Werten von AC-7 und AC-8 zu diesem Zeitpunkt;
  gezählt werden die Stellen, die in die Summe eingehen (AC-7), außer denen
  nach AC-19. Zählt keine Stelle, entfällt „, älteste Meldung …"
  („(0 Stellen)"); bei genau einer heißt es „1 Stelle". Die Summe wird erst unter der Einsatzsperre von `appendEntry`
  berechnet, damit keine parallel eingehende Meldung vor dem Eintrag im ETB
  steht, ohne in ihm enthalten zu sein. Ohne gültige Meldung ist der Knopf
  deaktiviert. Ein versehentlich geschriebener Eintrag lässt sich im ETB
  über sein „⋯"-Menü annullieren. *(C-8)*
- **AC-14** Jede Änderung aus AC-1 bis AC-13 und AC-19 erscheint in
  allen offenen Führungsansichten dieses Gesamteinsatzes, ohne dass jemand
  neu lädt. Dafür wird der bestehende SSE-Bus genutzt. *(C-1, C-2)*
- **AC-15** AC-1 bis AC-13 lassen sich bei 360 px Breite vollständig
  bedienen, ohne waagerecht zu scrollen. *(C-6)*
- **AC-16** Ein Gesamteinsatz mit 4 Stellen und 13 Meldungen je Stelle (einmal
  stündlich von 08:00 bis 20:00) liefert für AC-6 bis AC-10 die richtigen
  Werte. Ein Test pinnt das an genau diesem Datensatz. *(C-6)*
- **AC-19** Hat die letzte gültige Meldung einer Stelle 0 Gesamtpersonen
  (z. B. weil die Stelle abgebaut ist), wird ihre Uhrzeit nie als veraltet
  hervorgehoben. Die Meldung zählt nicht zur ältesten Uhrzeit der Summe
  (AC-8) und nicht zur Stellenzahl in „Gesamtstärke gemeldet" (AC-13). Meldet
  die Stelle später wieder Personen, gilt das normale Verhalten. *(C-3)*

## Edge cases

- **Keine Stellen:** Die Ansicht zeigt nur „Stelle anlegen", keine Summe.
- **Stelle ohne Meldung:** Sie zählt nicht zur Summe und nicht zur ältesten
  Uhrzeit (AC-7, AC-8).
- **Stelle abgebaut:** Die Führungskraft meldet einmal 0/0/0//0 mit 0
  zusätzlichem Personal (AC-19). Die Karte bleibt mit Nullwerten stehen. Vom
  Nutzer so entschieden; ein Stilllegen mit gespeicherten Zustandswechseln
  wurde erwogen und als zu aufwendig verworfen.
- **Alle Stellen auf 0:** Die Summe zeigt 0 ohne älteste Uhrzeit. „Gesamtstärke
  melden" bleibt möglich und meldet 0 Stellen.
- **Zwei Meldungen derselben Stelle zur selben Minute:** Beide werden
  gespeichert. Als „letzte" gilt die mit der höheren ETB-Nummer.
- **Gleichzeitige Korrekturen derselben Meldung:** Sie laufen nacheinander
  (Zeilensperre). Beide hinterlassen eine Fassung am ETB-Eintrag; die spätere
  gilt.
- **Abgeschlossener Gesamteinsatz:** Es gilt dasselbe wie für Handeinträge im
  ETB heute: Die Aktionen prüfen den Status nicht.
- **„Automatische ausblenden" im ETB** blendet die Stärke-Einträge nicht aus
  (siehe Approach).
- **Gesamteinsatz löschen:** Stellen, Meldungen und ihre ETB-Einträge
  verschwinden mit ihm, wie heute alles andere (kaskadierend).

## Non-goals

- Stellen als Absender oder Empfänger von ETB-Einträgen (`IDEAS.md`, 9).
- Einheiten als Objekte, Einheiten an Stellen oder an Einsätzen (`IDEAS.md`, 1
  und 10). „Einsatzbereite Streifen" bleibt Text in der Notiz.
- Ort oder Kartenzeichen für eine Stelle.
- Stärke in der Ansicht über Ansichts- oder Gerätelink.
- Eine Stelle löschen, stilllegen oder ausblenden. Eine versehentlich
  angelegte Stelle bleibt ohne Meldung stehen und stört die Summe nicht; eine
  abgebaute meldet 0 (AC-19).
- Eine abweichende Meldungszeit eintragen (z. B. „gemeldet 11:01, erfasst
  11:04").
- Empfänger der Gesamtstärke erfassen; der ETB-Eintrag nennt keinen.
- Diagramme des Verlaufs; der Verlauf ist eine Tabelle.

## Accepted tradeoffs

- **Anlegen vor der ersten Meldung.** Jede Stelle muss einmal angelegt werden,
  bevor sie melden kann: vier zusätzliche Handgriffe zu Beginn eines
  Gesamteinsatzes. Im Gegenzug kann ein Tippfehler im Namen keine
  Phantom-Stelle erzeugen, die die Summe spaltet, und die letzten Werte lassen
  sich vorbelegen.
- **Zwei neue Tabellen** (Stellen, Stärkemeldungen) statt eines
  ETB-Eintragstyps mit Feldern wie in A. Im Gegenzug bleibt der ETB-Eintrag
  reiner Text, und die Werte liegen dort, wo sich Stellen erzwingen lassen.
- **Stärke-Einträge sind im ETB nur teilweise bedienbar.** Wer eine Meldung im
  ETB sieht, muss zum Korrigieren oder Annullieren in die Ansicht „Stärke"
  wechseln. Dafür können Meldungstabelle und ETB-Text nicht auseinanderlaufen.
- **Die Werte stehen doppelt**, als Zahlen in der Meldung und als Text im
  ETB-Eintrag, und werden bei jeder Korrektur gemeinsam geschrieben. Dafür
  bleibt das ETB lesbar, ohne die Tabelle zu kennen.
- **Uhrzeit = Erfassungszeit.** Zwischen dem Funkspruch und dem Eintippen
  vergehen einige Minuten, die verloren gehen. Dafür ist die Uhrzeit wie im ETB
  unveränderlich und nicht manipulierbar.
- **Gesamtpersonen und Σ werden immer berechnet** statt gespeichert. Eine
  Stelle kann deshalb keine Σ melden, die nicht zu x+y+z passt; die
  Führungskraft muss so eine Meldung beim Eintippen klären.
- **Eine Führungsstelle je Gesamteinsatz.** Die Summe umfasst alle Stellen
  eines Gesamteinsatzes. Das entspricht C-2 („die ihr unterstellten Stellen")
  nur, solange im Werkzeug genau eine Führungsstelle den Gesamteinsatz führt,
  bei den Cyclassics die EAL 4. Arbeiten mehrere Führungsstellen in einem
  Gesamteinsatz, braucht jede ihren eigenen Gesamteinsatz. Dafür kommen
  Stellen ohne Zuordnung zu einer Führungsstelle aus. (Vom Nutzer
  entschieden: „Das gilt jetzt erstmal so.")
- **Abgebaute Stellen bleiben sichtbar.** Eine abgebaute Stelle steht mit
  ihrer Nullmeldung für den Rest des Gesamteinsatzes in der Liste. Dafür
  braucht es weder Zustandswechsel mit Uhrzeit noch eine zweite Sicht auf
  stillgelegte Stellen (vom Nutzer entschieden).
- **Nullmeldungen werden nicht als veraltet markiert.** Eine Stelle, die
  vorübergehend wirklich mit null Personen besetzt ist, fällt damit auch aus
  der Altersprüfung. Dafür bleibt die älteste Uhrzeit zur Summe nach einem
  Abbau aussagekräftig. (Vom Nutzer entschieden: „Gesamtpersonenzahl 0 heißt
  keine ‚veraltet'-Meldung"; C-3 ist entsprechend angepasst.)
- **Feste Schwelle von 60 Minuten** für „veraltet" (AC-8). Bei stündlichen
  Runden färben sich die Karten kurz vor jeder Runde; ein anderer
  Meldetakt passt nicht. Dafür gibt es nichts einzustellen.

## Ruled out

- **A: die Stärkemeldung als ETB-Eintrag mit Feldern.** Die Stelle wäre nur ein
  Name mit Vorschlägen gewesen. Ein Tippfehler („UHST 3") hätte still eine
  fünfte Stelle erzeugt und die Summe gespalten. Außerdem hätte sich die
  letzte Meldung nicht zuverlässig vorbelegen lassen.
- **C: Stärke aus dem ETB-Freitext parsen.** Nichts Neues im Modell, aber ein
  nicht erkannter Eintrag fehlt still in der Summe. Außerdem ist „/" bzw. „//"
  am Smartphone nur über die Volltastatur erreichbar.
- **D: stündliche Meldungsrunde als Tabelle.** Während eine Runde offen ist,
  lassen sich Werte ohne Spur im ETB ändern; das verletzt die Constraint zur
  Beweiskraft des ETB. Mit einem ETB-Eintrag je Zeile wäre D nur B mit anderer
  Oberfläche. Außerdem passt eine Meldung außerhalb des Takts nicht in die
  Runde.
- **Korrektur als eigener, unantastbarer ETB-Eintrag** mit Verweis auf den
  ursprünglichen („Stärkemeldung #44 korrigiert: …"), alle Stärke-Einträge
  als automatisch. Wer im ETB liest, hätte den Verweiseintrag suchen müssen,
  und „Automatische ausblenden" hätte genau die Meldungen versteckt, die C-5
  und C-8 dokumentieren sollen.
- **Stelle stilllegen und reaktivieren.** Hätte abgebaute Stellen aus Liste
  und Summe genommen, brauchte aber für einen richtigen Summenverlauf eine
  dritte Tabelle mit Zustandswechseln samt Uhrzeit. Die Nullmeldung (AC-19)
  erreicht dasselbe für die Summe ohne neues Konzept.
