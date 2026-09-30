# Criteria: Von, An und Weg im ETB

## Problem

Viele ETB-Einträge beginnen mit Absender, Empfänger und Übermittlungsweg,
z. B. „Von UHSt-2 an EAL: benötigen RTW für 42/m mit KoPlaWu, an
Gustav-Schleswig-Str. 23“. Absender und Empfänger stammen aus einem kleinen,
sich ständig wiederholenden Kreis, der Weg ist meist derselbe wie zuvor.
Trotzdem tippt die Führungskraft alles jedes Mal von Hand, oft am Handy und
unter Zeitdruck. Deshalb sieht es jedes Mal anders aus („Von UHSt-2 an EAL“,
„UHSt2 → EAL“, „EAL von UHSt 2“). Stattdessen sollte sie Absender, Empfänger
und Weg am Handy schnell angeben können, und sie sollten in allen Einträgen
gleich aussehen. Freitext muss immer möglich bleiben.

Cyclassics 2026: Einträge dieser Form wurden jedes Mal frei getippt
(Rückmeldung 9 in `IDEAS.md`, Commit `ece1f8e`). Wie viele es waren und was es
an Zeit gekostet hat, ist nicht festgehalten.

## Acceptance criteria

- **AC-1** Beim neuen Eintrag stehen über dem Textfeld eine Zeile „Von“ und eine Zeile „An“ mit auswählbaren Werten (Chips). Keine Zeile bricht um; weitere Werte erreicht man durch waagerechtes Wischen bzw. Scrollen innerhalb der Zeile.
- **AC-2** Die Werte beider Zeilen sind die Stellen des Gesamteinsatzes und die Von/An-Werte der aktuellen Fassung aller gültigen Einträge dieses Gesamteinsatzes. Werte, die sich nur in Groß- und Kleinschreibung unterscheiden, erscheinen als ein Chip, in der Schreibweise der jüngsten Verwendung; eine Stelle zählt dabei als verwendet, wenn sie angelegt oder umbenannt wird.
- **AC-3** Jede Zeile ist sortiert nach der letzten erfolgreichen Verwendung in diesem Feld auf diesem Gerät in diesem Gesamteinsatz, die zuletzt benutzte zuerst; danach folgen die übrigen Werte alphabetisch. Groß- und Kleinschreibung zählen dabei nicht. Als Verwendung zählt nur das Speichern eines neuen Eintrags, keine Korrektur. Die Reihenfolge übersteht ein Neuladen der Seite. Ohne Browser-Speicher (z. B. privater Modus) ist alles alphabetisch, und alles andere funktioniert.
- **AC-4** Ein Tipp auf einen Chip wählt ihn aus, ein erneuter Tipp wählt ihn ab. Je Feld ist höchstens ein Wert gewählt.
- **AC-5** „andere …“ ist in jeder Zeile ohne Wischen sichtbar. Ein Tipp darauf ersetzt die Chips in derselben Zeile durch ein Eingabefeld, das beim Tippen die Werte aus AC-2 vorschlägt, die das Getippte ohne Rücksicht auf Groß- und Kleinschreibung irgendwo enthalten („2“ schlägt „UHSt 2“ vor). Enter übernimmt den markierten Vorschlag. Öffnen von „andere …“ wählt einen gewählten Chip ab; „×“ verwirft die Eingabe und holt die Chips zurück. Die Eingabe wird getrimmt und so gespeichert, wie sie getippt wurde.
- **AC-6** Der Weg ist eine Auswahl neben „Eintrag hinzufügen“ mit *Funk*, *Telefon*, *Persönlich*, *Andere …* und *ohne*. *Andere …* macht aus der Auswahl ein Freitextfeld an derselben Stelle, das bei 360 px Breite mindestens 150 px breit ist; „×“ macht wieder die Auswahl daraus. Vorbelegt ist der Weg des zuletzt auf diesem Gerät in diesem Gesamteinsatz gespeicherten neuen Eintrags, auch ein Freitext-Weg und auch *ohne*; eine Korrektur ändert ihn nicht. Auf einem Gerät ohne gemerkten Weg ist es *Funk*.
- **AC-7** Der Text ist Pflicht wie heute. Von, An und Weg sind optional und unabhängig voneinander.
- **AC-8** Nach erfolgreichem Speichern ist der Text leer, Von und An sind abgewählt, offene „andere …“-Felder sind geschlossen, der Weg bleibt. Bei einem Fehler bleiben Text, Von, An und Weg erhalten, und die Fehlermeldung erscheint wie heute. Reihenfolge (AC-3) und gemerkter Weg (AC-6) ändern sich nur bei erfolgreichem Speichern.
- **AC-9** Im ETB steht über dem Text eines Eintrags eine Kopfzeile wie „Von UHSt 2 an EAL · Funk“. Leere Teile fallen weg („An EAL · Telefon“, „Funk“); ohne alle drei Angaben gibt es keine Kopfzeile. Einträge von vor dieser Änderung und automatische Einträge sehen aus wie heute.
- **AC-10** Korrigieren bietet dieselben Bedienelemente, vorbelegt mit Von, An und Weg des Eintrags; ein vorbelegter Chip steht vorne in seiner Zeile. Eine Korrektur, die nur Von, An oder Weg ändert, erzeugt eine neue Fassung. Die Vorfassung ist samt Kopfzeile durchgestrichen zu sehen, mit Urheber und Zeit.
- **AC-11** Ein annullierter Eintrag zeigt seine Kopfzeile durchgestrichen.
- **AC-12** Legt ein anderes Gerät einen Eintrag an, erscheinen seine Kopfzeile und neue Werte als Chips ohne Neuladen.
- **AC-13** In der Desktop-Seitenleiste (360 px breit) ist der Bereich für neue Einträge höchstens 80 px höher als vor dieser Änderung.
- **AC-14** Bei 360 px Breite scrollt die Seite nicht waagerecht; eine lange Kopfzeile bricht im Eintrag um.
- **AC-15** Strg/⌘+Enter schickt den Eintrag samt Von, An und Weg ab, aus jedem seiner Eingabefelder, beim neuen Eintrag wie beim Korrigieren.

## Agreed design

Je Feld eine Zeile Chips, die waagerecht wischt und nie umbricht, mit
„andere …“ fest am rechten Rand; darunter das Textfeld; der Weg als Auswahl
neben „Eintrag hinzufügen“. Am Handy und in der Desktop-Seitenleiste gleich.
Von, An und Weg werden getrennt vom Text gespeichert.

Muster: https://claude.ai/artifact/TkdoDxv4rg5gjDct1zX41P, Kopie in
[`specimens/eingabe-am-handy.html`](specimens/eingabe-am-handy.html).

**Agreed; build to this, do not redesign.**

## Nudges

- Von, An und Weg als eigene, nullable Spalten an `journal_entries` und `journal_entry_revisions` in einer neuen Migration; bestehende Zeilen bleiben NULL.
- `appendEntry` und `reviseEntry` nehmen die drei Werte mit; automatische Einträge übergeben nie welche.
- Die Werteliste aus AC-2 liefert eine Funktion im Journal-Modul; die Seite lädt sie zusammen mit den Einträgen.
- Reihenfolge und gemerkten Weg nach dem Muster von `src/map/last-view-storage.ts` im `localStorage` halten: Schlüssel je Gesamteinsatz, jeder Zugriff in try/catch.
- Ein Bauteil für neuen Eintrag und Korrektur; die Kopfzeile formatiert eine reine Funktion mit eigenen Tests.
- Von, An und Weg in `UBIQUITOUS_LANGUAGE.md` aufnehmen.

## Out of scope

- Chips entfernen, z. B. durch langes Drücken. Wird gebaut, falls vertippte Werte im Einsatz stören.
- Von, An und Weg an automatischen Einträgen und Stärkemeldungen.
- Filtern oder Auswerten des ETB nach Von, An oder Weg.
- Abgleich ähnlicher Schreibweisen über Groß- und Kleinschreibung hinaus („UHSt2“ und „UHSt 2“).

## Ruled out

- **Kopfzeile als Anfang des Textes speichern** - Vorschläge müssten aus dem Freitext gelesen werden, und das Format verrutscht beim Korrigieren.
- **Vorschläge im Textfeld selbst** - am Handy fummelig, und das Format bleibt frei.
- **Felder mit Vorschlagsliste** - etwa 5 Tipps je Feld, und die Liste teilt sich den Bildschirm mit der Tastatur.
- **Chips mit zuletzt benutzten Paaren („UHSt 2 → EAL“)** - braucht mehr Platz und spart gegenüber einem Chip je Feld nur einen Tipp.
- **Chips, die umbrechen** - etwa doppelt so hoch; das ETB in der Seitenleiste wird kürzer.
- **Sortierung nach Häufigkeit** - ein neuer, gerade wichtiger Gesprächspartner bliebe lange hinten.
- **Reihenfolge und Weg auf dem Server, Weg aus dem letzten Eintrag derselben Führungskraft** - unnötig; je Gerät passt zu den Gesprächspartnern der jeweiligen Führungskraft.
- **Vorhandene Schreibweise gewinnt** - dann ließen sich Tippfehler nie korrigieren.
