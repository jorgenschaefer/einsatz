---
criteria:  CRITERIA.md
closes:    AC-9
advances:  AC-6, AC-8, AC-13, AC-14, AC-15
after:     01-journal-panel-tests-aufteilen
status:    done
attempts:  1
---

## Build
Von, An und Weg werden am ETB-Eintrag gespeichert und als Kopfzeile über dem
Text angezeigt. Eingeben lässt sich in diesem Ticket nur der Weg, über eine
Auswahl neben „Eintrag hinzufügen“. Die Von/An-Chips folgen in Ticket 03.

## Done when
> **AC-9** Im ETB steht über dem Text eines Eintrags eine Kopfzeile wie „Von UHSt 2 an EAL · Funk“. Leere Teile fallen weg („An EAL · Telefon“, „Funk“); ohne alle drei Angaben gibt es keine Kopfzeile. Einträge von vor dieser Änderung und automatische Einträge sehen aus wie heute.

Dazu von den ACs unter *Toward*:

- AC-6: Die Weg-Auswahl steht neben „Eintrag hinzufügen“ und bietet *Funk*, *Telefon*, *Persönlich* und *ohne*; vorbelegt ist *Funk*. *Andere …* fehlt noch.
- AC-8: Nach erfolgreichem Speichern ist der Text leer, der Weg bleibt. Bei einem Fehler bleiben Text und Weg erhalten, und die Fehlermeldung erscheint wie heute.
- AC-13: Mit der Weg-Auswahl ist der Bereich für neue Einträge in der 360 px breiten Desktop-Seitenleiste höchstens 80 px höher als vor dieser Änderung.
- AC-14: Bei 360 px Breite scrollt die Seite mit der Weg-Auswahl nicht waagerecht; eine lange Kopfzeile bricht im Eintrag um.
- AC-15: Strg/⌘+Enter im Textfeld und in der Weg-Auswahl des neuen Eintrags schickt ihn samt Weg ab.

## Toward
> **AC-6** Der Weg ist eine Auswahl neben „Eintrag hinzufügen“ mit *Funk*, *Telefon*, *Persönlich*, *Andere …* und *ohne*. *Andere …* macht aus der Auswahl ein Freitextfeld an derselben Stelle, das bei 360 px Breite mindestens 150 px breit ist; „×“ macht wieder die Auswahl daraus. Vorbelegt ist der Weg des zuletzt auf diesem Gerät in diesem Gesamteinsatz gespeicherten neuen Eintrags, auch ein Freitext-Weg und auch *ohne*; eine Korrektur ändert ihn nicht. Auf einem Gerät ohne gemerkten Weg ist es *Funk*.

> **AC-8** Nach erfolgreichem Speichern ist der Text leer, Von und An sind abgewählt, offene „andere …“-Felder sind geschlossen, der Weg bleibt. Bei einem Fehler bleiben Text, Von, An und Weg erhalten, und die Fehlermeldung erscheint wie heute. Reihenfolge (AC-3) und gemerkter Weg (AC-6) ändern sich nur bei erfolgreichem Speichern.

> **AC-13** In der Desktop-Seitenleiste (360 px breit) ist der Bereich für neue Einträge höchstens 80 px höher als vor dieser Änderung.

> **AC-14** Bei 360 px Breite scrollt die Seite nicht waagerecht; eine lange Kopfzeile bricht im Eintrag um.

> **AC-15** Strg/⌘+Enter schickt den Eintrag samt Von, An und Weg ab, aus jedem seiner Eingabefelder, beim neuen Eintrag wie beim Korrigieren.

## Nudges
> Von, An und Weg als eigene, nullable Spalten an `journal_entries` und `journal_entry_revisions` in einer neuen Migration; bestehende Zeilen bleiben NULL.

> `appendEntry` und `reviseEntry` nehmen die drei Werte mit; automatische Einträge übergeben nie welche.

> Ein Bauteil für neuen Eintrag und Korrektur; die Kopfzeile formatiert eine reine Funktion mit eigenen Tests.

> Von, An und Weg in `UBIQUITOUS_LANGUAGE.md` aufnehmen.

## Context
**Heute.** Ein ETB-Eintrag hat nur Text (`src/server/journal/journal.ts`:
`appendEntry`, `listEntries`, `reviseEntry`; Tabellen `journal_entries` und
`journal_entry_revisions`). Der neue Eintrag entsteht in
`src/app/operations/[id]/JournalPanel.tsx` (Textarea „Neuer Eintrag“, Knopf
„Eintrag hinzufügen“, Strg/⌘+Enter über `submitOnCtrlEnter`) und geht über
`addJournalEntryAction(operationId, text)` in
`src/app/operations/[id]/journal-actions.ts`. Die Seite
`src/app/operations/[id]/page.tsx` bildet Einträge mit `toView` auf
`JournalEntryView` ab und reicht sie über `SituationWorkspace`
(`src/map/SituationWorkspace.tsx`, Props `journalEntries`, `onAddJournalEntry`)
an `JournalPanel`. Nach Ticket 01 liegen die Hilfen der Panel-Tests in
`src/app/operations/[id]/JournalPanel.fixtures.tsx`.

**Gestaltung** (vereinbart, nicht neu entwerfen; Muster in
`changes/2026-09-30-von-an-weg-im-etb/specimens/eingabe-am-handy.html`): Unter
dem Textfeld eine Zeile mit der Weg-Auswahl links und „Eintrag hinzufügen“
rechts. Die Weg-Auswahl ist ein natives `<select>` in Mantine-Optik, ohne
sichtbares Label, nur `aria-label="Weg"`. Die Kopfzeile im Eintrag steht
zwischen der Zeile mit Nummer/Zeit/Urheber und dem Text: „Von X an Y“ fett, der
Weg nach „ · “ gedimmt; steht nur ein Weg da, ist er allein und gedimmt.

**Namen** (in diesem Ticket festgelegt): Von = `sender`, An = `recipient`,
Weg = `channel`; die drei zusammen = `EntryRoute`; die Kopfzeile bildet
`formatEntryRoute`.

**Baseline für AC-13.** Commit `6392481` ist der Stand vor dieser Änderung.

## Plan
1. **Glossar.** In `UBIQUITOUS_LANGUAGE.md` aufnehmen: **Von** (`sender`),
   **An** (`recipient`), **Weg** (`channel`: *Funk*, *Telefon*, *Persönlich*
   oder Freitext) als optionale Angaben eines manuellen ETB-Eintrags und jeder
   seiner Fassungen; die **Kopfzeile** („Von UHSt 2 an EAL · Funk“). Den
   Eintrag **ETB-Eintrag** um Von/An/Weg ergänzen.
   *Beweis:* Lesen; `npm run lint` bleibt grün.
2. **Kopfzeile als reine Funktion.** In `src/journal/entry-route.ts` (neu) der
   Typ `EntryRoute = { sender: string | null; recipient: string | null; channel: string | null }`
   und `formatEntryRoute(route): { parties: string | null; channel: string | null } | null`.
   `parties` ist „Von X an Y“, „Von X“ oder „An Y“; `channel` der Weg; `null`,
   wenn alle drei leer sind. Getrennt, damit der Weg gedimmt gerendert werden
   kann, ohne einen String wieder aufzuspalten.
   *Beweis:* `src/journal/entry-route.test.ts` (neu), eine Tabelle aller
   sieben Kombinationen plus „alles leer“ → `null`.
3. **Schema, eine Migration.** `src/server/db/migrations/014_journal_entry_route.sql`
   (neu): `journal_entries` und `journal_entry_revisions` bekommen je `sender`,
   `recipient`, `channel` (`text`, nullable). Bestehende Zeilen bleiben NULL.
   *Beweis:* `freshDb()` migriert; Schritt 4 läuft dagegen.
4. **Domäne.** `appendEntry` nimmt `route: EntryRoute` mit; jeder Wert wird
   getrimmt, leer wird `null`. `JournalEntry` und `listEntries` liefern
   `sender`, `recipient`, `channel`. Alle bisherigen Aufrufer von
   `appendEntry` (automatische Einträge in `operations`, Stellen in
   `src/server/strength/stations.ts`, Stärke in
   `src/server/strength/strength-reports.ts` und `total-strength.ts`) übergeben
   ausdrücklich eine leere Route. `reviseEntry` bleibt in diesem Ticket
   unverändert; die Revisions-Spalten nutzt Ticket 05.
   *Beweis:* `src/server/journal/journal.test.ts`: Eintrag mit Route wird
   getrimmt gespeichert und gelesen; „  “ wird `null`; ein Eintrag ohne Route
   hat drei `null`.
5. **Action.** `addJournalEntryAction(operationId, entry: { text: string } & EntryRoute)`
   reicht die Route an `appendEntry`.
   *Beweis:* `src/app/operations/[id]/journal-actions.test.ts` (neu), nach dem
   Muster von `strength-actions.test.ts` (echte DB über `freshDb()`, Session
   gefälscht): Der Eintrag wird samt Route gespeichert, und es wird genau ein
   Ereignis auf dem SSE-Bus des Einsatzes veröffentlicht (`subscribeOperation`).
6. **Seite und Workspace.** `toView` in `page.tsx` gibt `sender`, `recipient`,
   `channel` in `JournalEntryView` weiter; `onAddJournalEntry` in
   `SituationWorkspace` und `onAdd` in `JournalPanel` bekommen den Typ
   `(entry: { text: string } & EntryRoute) => Promise<ActionResult>`. Fixtures
   in `src/map/SituationWorkspace.fixtures.tsx` und `JournalPanel.fixtures.tsx`
   anpassen.
   *Beweis:* `npx tsc --noEmit` grün; bestehende Tests grün.
7. **AC-9 als Test, dann die Kopfzeile.** In
   `src/app/operations/[id]/JournalPanel.route.test.tsx` (neu, Hilfen aus
   `JournalPanel.fixtures.tsx`): Einträge mit allen Kombinationen zeigen die
   Kopfzeile („Von UHSt 2 an EAL · Funk“, „An EAL · Telefon“, „Funk“); ein
   Eintrag ohne Route und ein automatischer Eintrag haben keine. Dann in
   `JournalPanel` die Kopfzeile aus `formatEntryRoute` zwischen Kopf und Text
   rendern. Lange Kopfzeilen brechen um (das Panel hat `overflowWrap: "break-word"`).
   *Beweis:* Test erst rot, dann grün.
8. **Weg-Auswahl.** `src/journal/EntryRouteFields.tsx` (neu) exportiert
   `EntryChannelSelect` (kontrolliert: `value: string | null`, `onChange`,
   `onKeyDown`): natives `<select aria-label="Weg">` mit *Funk*, *Telefon*,
   *Persönlich*, *ohne*; *ohne* ist `null`. Die Chip-Zeilen kommen in Ticket 03
   in dieselbe Datei.
   *Beweis:* `src/journal/EntryRouteFields.test.tsx` (neu): Auswahl liefert
   den Wert, *ohne* liefert `null`.
9. **Neuer Eintrag mit Weg.** `JournalPanel` hält die Route im Zustand (Von/An
   `null`, Weg *Funk*), stellt die Weg-Auswahl links neben „Eintrag
   hinzufügen“ in eine Zeile und schickt `{ text, ...route }` ab. Nach Erfolg:
   Text leer, Weg bleibt. Bei Fehler bleibt alles. Strg/⌘+Enter im Textfeld und
   in der Weg-Auswahl schickt ab. Die Klasse `journal-new-entry` bleibt am
   Eingabebereich (Desktop-Layout in `src/map/situation-workspace.css`).
   *Beweis:* Tests in `JournalPanel.route.test.tsx`: *Telefon* wählen, Text
   tippen, „Eintrag hinzufügen“ → `onAdd` mit `channel: "Telefon"`; nach
   Erfolg Text leer, Weg *Telefon*; bei `{ error }` bleibt beides;
   Strg+Enter aus Textfeld und Weg-Auswahl schickt ab.
10. **Im Browser prüfen.** Mit dem Skill `run-einsatz` bei 360 px (Handy) und
    in der Desktop-Seitenleiste: keine waagerechte Seiten-Scrollbar; lange
    Kopfzeile bricht um; Höhe des Eingabebereichs gegenüber Commit `6392481`
    messen.
    *Beweis:* Beide Messwerte (vorher, nachher) unter `## Left standing`,
    damit Ticket 03 und 04 dagegen messen können.

## Not here
- Keine Von/An-Chips und keine Werteliste der Gesprächspartner: Ticket `03-von-an-chips`.
- Kein „andere …“ und kein *Andere …* beim Weg: Ticket `04-andere-werte-frei-eingeben`.
- Kein Korrigieren von Von/An/Weg und keine durchgestrichene Kopfzeile bei Vorfassungen oder annullierten Einträgen: Ticket `05-von-an-weg-korrigieren`. Die Spalten an `journal_entry_revisions` entstehen hier schon, weil die Route in einer Migration kommt, werden aber erst dort beschrieben und gelesen.
- Kein gemerkter Weg; er startet immer mit *Funk*: Ticket `06-reihenfolge-und-weg-je-geraet`.
- Aus *Out of scope*: Von, An und Weg an automatischen Einträgen und Stärkemeldungen.
- Aus *Out of scope*: Filtern oder Auswerten des ETB nach Von, An oder Weg.

## Left standing
- Review-Nit nicht umgesetzt: `journal-actions.test.ts` kopiert den Aufbau
  (`vi.mock`-Block, `loginAs`, `liveEventsFor`) aus `strength-actions.test.ts`,
  wie Schritt 5 es vorgibt („nach dem Muster von“). Diese Hilfen in eine
  gemeinsame Datei zu ziehen, würde `strength-actions.test.ts` ändern. Das
  gehört nicht zu diesem Ticket.
- AC-13 prüft kein automatischer Test, sondern der Reviewer im Browser. Er hat
  die Höhe von `.journal-new-entry` gemessen, die Baseline in einem eigenen
  Worktree auf Commit `6392481`:
  - Desktop-Seitenleiste (360 px breit, bei 1920×1080 und 768×1024): vorher
    102,375 px, nachher 102,375 px.
  - Handy mit 360 px Breite: vorher 102,375 px, nachher 102,375 px.

  Die Höhe bleibt gleich, weil die Weg-Auswahl in der Zeile steht, die der
  Knopf schon vorher allein belegt hat.
- AC-14 prüft kein automatischer Test, sondern der Reviewer im Browser: Bei
  360 px ist `scrollWidth` gleich `clientWidth` (360), und kein Element ragt
  über den rechten Rand. Eine lange Kopfzeile mit mehreren Wörtern und eine
  mit einem Wort aus 78 Zeichen ohne Leerzeichen brechen am Handy und in der
  Seitenleiste im Eintrag um. Die Von/An-Werte dafür hat er direkt in die
  Dev-Datenbank geschrieben, weil es für sie noch keine Eingabe gibt.
- Auch die Gestaltung prüft kein Test: dass die Weg-Auswahl links neben
  „Eintrag hinzufügen“ steht und kein sichtbares Label hat, dass „Von X an Y“
  fett und der Weg gedimmt ist. Das hat der Reviewer im Browser
  nachgesehen. Strg+Enter in der Weg-Auswahl hat er dort auch ausprobiert.
- Abweichung vom Plan, Schritt 9: `JournalPanel` hält nur den Weg im Zustand,
  nicht eine ganze Route mit Von/An `null`. Es gibt noch keine Eingabe für Von
  und An, deshalb schickt das Panel für sie ausdrücklich `null`. Ticket 03
  legt den Zustand für Von und An an, wenn es die Chips einbaut.
- Abweichung vom Plan, Schritt 10: Im Browser habe ich nicht selbst geprüft.
  Das hat der Reviewer bei 360 px und in der Desktop-Seitenleiste übernommen,
  mit den Messwerten oben.
- Abweichung vom Plan, Schritt 7: Hat ein Eintrag frühere Fassungen, steht die
  Kopfzeile direkt unter der Zeile mit Nummer, Zeit und Urheber, also über den
  durchgestrichenen Fassungen und nicht direkt über dem Text. Wie Kopfzeile und
  frühere Fassungen zusammen aussehen, entscheidet Ticket 05.
- Die „leere Route“ aus Schritt 4 ist die Konstante `NO_ROUTE` in
  `src/journal/entry-route.ts`. Alle Aufrufer von `appendEntry` übergeben sie
  ausdrücklich, auch die in bestehenden Tests.
- Zum TDD-Ablauf: Vier Tests in `JournalPanel.route.test.tsx` sind nie an
  einer Assertion gescheitert, nur daran, dass es die Weg-Auswahl noch nicht
  gab: „presets the Weg of a new entry to Funk“, „empties the text and keeps
  the Weg after adding“, „keeps text and Weg and shows the error when adding
  fails“ und „adds a new entry with Weg ohne“. Sobald die Auswahl im Panel
  stand, noch ohne Anschluss an `onAdd`, liefen sie durch. Die übrigen drei
  sind an ihrer Assertion gescheitert.
