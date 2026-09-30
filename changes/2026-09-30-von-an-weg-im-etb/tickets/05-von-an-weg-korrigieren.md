---
criteria:  CRITERIA.md
closes:    AC-10, AC-11, AC-14, AC-15
advances:
after:     04-andere-werte-frei-eingeben
status:    done
attempts:  1
---

## Build
Korrigieren umfasst Von, An und Weg: Das Korrekturformular bietet dieselben
Bedienelemente wie der neue Eintrag, jede Fassung speichert ihre Route, und
Vorfassungen und annullierte Einträge zeigen ihre Kopfzeile durchgestrichen.

## Done when
> **AC-10** Korrigieren bietet dieselben Bedienelemente, vorbelegt mit Von, An und Weg des Eintrags; ein vorbelegter Chip steht vorne in seiner Zeile. Eine Korrektur, die nur Von, An oder Weg ändert, erzeugt eine neue Fassung. Die Vorfassung ist samt Kopfzeile durchgestrichen zu sehen, mit Urheber und Zeit.

> **AC-11** Ein annullierter Eintrag zeigt seine Kopfzeile durchgestrichen.

> **AC-14** Bei 360 px Breite scrollt die Seite nicht waagerecht; eine lange Kopfzeile bricht im Eintrag um.

> **AC-15** Strg/⌘+Enter schickt den Eintrag samt Von, An und Weg ab, aus jedem seiner Eingabefelder, beim neuen Eintrag wie beim Korrigieren.

## Nudges
> Von, An und Weg als eigene, nullable Spalten an `journal_entries` und `journal_entry_revisions` in einer neuen Migration; bestehende Zeilen bleiben NULL.

> `appendEntry` und `reviseEntry` nehmen die drei Werte mit; automatische Einträge übergeben nie welche.

> Ein Bauteil für neuen Eintrag und Korrektur; die Kopfzeile formatiert eine reine Funktion mit eigenen Tests.

## Context
**Heute.** Korrigieren: `correctEntry(db, entryId, newText, author)` →
`reviseEntry(tx, entryId, newText, author)` in `src/server/journal/journal.ts`.
`reviseEntry` schreibt die bisherige Fassung (Text, Urheber, Zeitpunkt) nach
`journal_entry_revisions` und die neue in `journal_entries`. `reviseEntry` ruft
auch `correctStrengthReport` in `src/server/strength/strength-reports.ts`
(Zeile ~125) für den ETB-Eintrag einer Stärkemeldung. Die Action ist
`correctEntryAction(entryId, text)` in `src/app/operations/[id]/journal-actions.ts`.
Im ETB (`src/app/operations/[id]/JournalPanel.tsx`) öffnet „Korrigieren“ im
Menü des Eintrags eine Textarea „Korrektur“ mit „Speichern“/„Abbrechen“ und
Strg/⌘+Enter; Vorfassungen stehen als `<del>` mit Urheber und Zeit darüber,
ein annullierter Eintrag zeigt seinen Text in `<del>`.

**Nach Ticket 02 bis 04.** `journal_entries` und `journal_entry_revisions`
haben `sender`, `recipient`, `channel` (Migration 014; die Revisions-Spalten
sind bisher unbenutzt); `appendEntry` nimmt eine `EntryRoute`; `formatEntryRoute` in
`src/journal/entry-route.ts` bildet die Kopfzeile; `src/journal/EntryRouteFields.tsx`
bietet Chip-Zeilen mit „andere …“ (`EntryRouteChips`) und die Weg-Auswahl mit
*Andere …* (`EntryChannelSelect`, natives `<select>`);
`JournalPanel` zeigt die Kopfzeile gültiger Einträge und schickt beim neuen
Eintrag mit Strg/⌘+Enter aus jedem Feld ab. Tests: `JournalPanel.route.test.tsx`,
`JournalPanel.correct.test.tsx`, `src/server/journal/journal-history.test.ts`.

**Gestaltung.** Das Korrekturformular sitzt im `Paper` des Eintrags und ist
dadurch etwas schmaler als der Eingabebereich. Die Anordnung ist dieselbe wie
beim neuen Eintrag (Chip-Zeilen über der Textarea, Weg-Auswahl in der Zeile mit
„Speichern“/„Abbrechen“).

## Plan
1. **Domäne.** `reviseEntry(tx, entryId, content: { text: string } & EntryRoute, author)`
   und `correctEntry` ebenso: Die bisherige Fassung wandert samt Route nach
   `journal_entry_revisions`, die neue Route wird getrimmt (leer → `null`)
   gespeichert. `JournalRevision` und `listEntries`/`loadEntry` liefern die
   Route der Vorfassungen. `correctStrengthReport` übergibt eine leere Route.
   *Beweis:* `src/server/journal/journal-history.test.ts`: Korrektur, die nur
   den Weg ändert, erzeugt eine neue Fassung mit alter Route in der Vorfassung;
   die Stärke-Tests in `src/server/strength/strength-reports.test.ts` bleiben grün.
2. **AC-10 als Test, rot.** In `src/app/operations/[id]/JournalPanel.correct.test.tsx`:
   Korrigieren eines Eintrags mit Route „Von UHSt 2 an EAL · Funk“ zeigt die
   Chips mit UHSt 2 und EAL gewählt und je vorne in ihrer Zeile, auch wenn
   `correspondents` sie alphabetisch weiter hinten führt; Weg *Funk*. Nur den
   Weg auf *Telefon* ändern und speichern → `onCorrect` mit gleichem Text und
   neuer Route. Vorfassung wird mit durchgestrichener Kopfzeile, Urheber und
   Zeit angezeigt. Ein Freitext-Weg („Melder“) erscheint vorbelegt im
   Freitextfeld. Schreibweise: Ein Eintrag mit Von „UHST 2“, während
   `correspondents` „UHSt 2“ führt, zeigt den Chip „UHSt 2“ gewählt und vorne;
   speichert man, ohne Von anzutippen, bleibt „UHST 2“ gespeichert.
   *Beweis:* rot, weil das Formular nur Text kennt.
3. **Action.** `correctEntryAction(entryId, content: { text: string } & EntryRoute)`.
   *Beweis:* `src/app/operations/[id]/journal-actions.test.ts`: Korrektur
   speichert die Route und veröffentlicht genau ein Ereignis.
4. **Korrekturformular.** `JournalPanel` nutzt beim Korrigieren
   `EntryRouteChips` und `EntryChannelSelect`, vorbelegt mit der Route des
   Eintrags; die Chip-Zeilen stellen einen vorbelegten Wert an den Anfang
   (Prop des Bauteils, z. B. `pinned`). Der vorbelegte Chip wird ohne Rücksicht
   auf Groß- und Kleinschreibung gefunden (AC-2 zeigt nur eine Schreibweise);
   solange das Feld nicht angetippt wurde, wird beim Speichern der Wert des
   Eintrags in seiner eigenen Schreibweise übergeben, damit eine reine
   Textkorrektur keine Schreibweise umschreibt (entschieden in diesem Ticket).
   Ein Freitext-Weg erscheint im Freitextfeld. Strg/⌘+Enter aus Textarea,
   Weg-Auswahl, „andere …“-Feld und Freitext-Weg speichert. `onCorrect` bekommt
   `{ text, ...route }`; `SituationWorkspace`, `page.tsx` und die Fixtures
   passen den Typ an.
   *Beweis:* Test aus Schritt 2 grün; Strg+Enter aus Weg-Auswahl,
   „andere …“-Feld und Freitext-Weg im Korrekturformular speichert (AC-15).
5. **Durchgestrichene Kopfzeilen.** Vorfassungen zeigen `formatEntryRoute(rev)`
   in `<del>` vor ihrem Text; ein annullierter Eintrag zeigt seine Kopfzeile in
   `<del>`.
   *Beweis:* Tests in `JournalPanel.correct.test.tsx` (Vorfassung) und
   `JournalPanel.annul.test.tsx` (annulliert, AC-11).
6. **Im Browser prüfen.** Mit dem Skill `run-einsatz` bei 360 px: Eintrag mit
   langer Route korrigieren, „andere …“ öffnen, *Andere …* beim Weg wählen;
   keine waagerechte Seiten-Scrollbar, Freitext-Weg im Korrekturformular
   benutzbar, lange Kopfzeile bricht um.
   *Beweis:* Beobachtung unter `## Left standing`.

## Not here
- Die Reihenfolge der Chips nach letzter Verwendung und der gemerkte Weg: Ticket `06-reihenfolge-und-weg-je-geraet`. Eine Korrektur schreibt nichts in den Browser-Speicher.
- Aus *Out of scope*: Von, An und Weg an automatischen Einträgen und Stärkemeldungen. Die Korrektur einer Stärkemeldung übergibt eine leere Route und zeigt keine Route-Felder.

## Left standing
- Review-Nit nicht umgesetzt: `EntryForm` hat die zwei Schalter `pinned` und
  `compact`, und die Korrektur setzt immer beide. Sie bedeuten Verschiedenes:
  `pinned` stellt die vorbelegten Chips voran, `compact` macht Weg-Auswahl und
  Knöpfe klein, weil der Platz im Eintrag schmaler ist. Ein gemeinsamer
  „Korrektur-Modus“ würde das verdecken.
- Review-Beobachtung, nicht behoben: Nach dem Speichern schließt die Korrektur,
  bevor die neue Fassung über das Live-Ereignis ankommt. Kurz steht der Eintrag
  noch in der alten Fassung da. Das war bei der reinen Textkorrektur schon so.
- Abweichung von der Gestaltung: Hat die Korrektur einen Freitext-Weg, stehen
  „Speichern“ und „Abbrechen“ in der nächsten Zeile. Mindestens 150 px Feld
  plus beide Knöpfe brauchen etwa 349 px, im Eintrag sind aber nur 302 px
  Platz. Mit der Auswahl, auch mit *Persönlich*, passt alles in eine Zeile.
  Dafür sind Weg-Auswahl und Knöpfe in der Korrektur klein (`xs`), wie die
  Knöpfe der Korrektur vorher auch. Das sollte bei der Abnahme bestätigt
  werden.
- AC-14 und die Anordnung prüft kein automatischer Test, denn jsdom misst kein
  Layout. Der Reviewer hat in der zweiten Runde bei 360 px und in der
  Desktop-Seitenleiste (1920×1080) gemessen:
  - Seite: `scrollWidth` gleich `clientWidth`, in allen Zuständen, auch mit
    langer Route, offenem „andere …“ und Freitext-Weg in der Korrektur.
  - Eine lange Kopfzeile bricht im Eintrag um.
  - Korrektur: Weg-Auswahl 97 px, „Speichern“ 88 px und „Abbrechen“ 92,7 px
    in einer Zeile. Der Freitext-Weg ist 302 px breit, die Knöpfe stehen
    darunter.
  - Eingabebereich unverändert: `.journal-new-entry` 178,375 px hoch,
    Freitext-Weg 151,23 px, „Eintrag hinzufügen“ ungekürzt.

  Im Browser hat er außerdem geprüft: Vorfassungen und annullierte Einträge
  zeigen ihre Kopfzeile durchgestrichen. Beim Öffnen einer Korrektur springt
  der Fokus nirgendwohin. Strg+Enter aus dem Freitext-Weg der Korrektur
  speichert.
- Abweichung vom Plan, Schritt 6: Im Browser habe ich nicht selbst geprüft.
  Das hat der Reviewer in beiden Runden übernommen, mit den Messwerten oben.
- Abweichung vom Nudge „in einer neuen Migration“: Es gibt keine neue
  Migration. Die Spalten an beiden Tabellen hat Migration 014 aus Ticket 02
  schon angelegt; sie werden hier nur beschrieben und gelesen.
- In diesem Ticket entschieden (der Plan sagt dazu nichts): Hat der Eintrag
  einen Freitext-Weg, führt „×“ in der Korrektur zur Auswahl mit *Funk*, dem
  Weg, mit dem auch ein neuer Eintrag beginnt. Der Freitext-Weg bekommt den
  Fokus nur, wenn man *Andere …* wählt, nicht schon beim Öffnen der Korrektur
  (Nit aus der ersten Review).
- Auswirkung auf den neuen Eintrag: Die Chips vergleichen jetzt ohne Rücksicht
  auf Groß- und Kleinschreibung, beim neuen Eintrag wie bei der Korrektur. Den
  seltenen Fall aus Ticket 03 (gewählter Chip, ein anderes Gerät benennt die
  Stelle nur in der Schreibweise um) zeigt die Zeile jetzt als einen Chip in
  der neuen Schreibweise, gewählt. Gespeichert wird die alte Schreibweise, bis
  jemand den Chip antippt. Das ist dieselbe Regel wie bei der Korrektur.
- Nicht in diesem Ticket, aber bei der Review aufgefallen: Ändert eine
  Korrektur nur den Weg eines Eintrags mit „UHST 2“, bleibt dessen
  Schreibweise gespeichert (so entschieden). Weil `listCorrespondents` den
  Zeitpunkt der Korrektur als Verwendung zählt, wird „UHST 2“ damit wieder die
  jüngste Schreibweise in allen Chip-Zeilen. Das gehört zu AC-2 und
  `listCorrespondents`, nicht hierher.
- Zum TDD-Ablauf: Einige Tests liefen gleich grün, weil der Code dafür schon
  mit einem früheren Schritt kam: „keeps the unchosen prefilled chip first in
  its row“, „saves a correction with Strg+Enter in the field for another Von“
  sowie in `EntryRouteFields.test.tsx` „puts the pinned value first“, „keeps
  the pinned value as a chip once unchosen …“ und „unchooses a value in
  another spelling …“. Die letzten beiden und „closes the correction once it
  is saved“ habe ich probeweise gegen kaputten Code laufen lassen; sie
  schlugen fehl. Die übrigen habe ich so nicht geprüft. Der Test für die
  Aktion schlug zuerst mit einem `TypeError` fehl statt an der Assertion. Ich
  habe dann die Signatur geändert und die Route noch verworfen; danach schlug
  er an der Assertion fehl.
