---
criteria:  CRITERIA.md
closes:    AC-1, AC-2, AC-4, AC-7, AC-12
advances:  AC-8, AC-13, AC-14, AC-15
after:     02-weg-und-kopfzeile
status:    done
attempts:  1
---

## Build
Von und An kommen dazu: Zwei Chip-Zeilen über dem Textfeld mit den
Gesprächspartnern des Gesamteinsatzes, die der Server liefert. Die Reihenfolge
ist vorerst alphabetisch.

## Done when
> **AC-1** Beim neuen Eintrag stehen über dem Textfeld eine Zeile „Von“ und eine Zeile „An“ mit auswählbaren Werten (Chips). Keine Zeile bricht um; weitere Werte erreicht man durch waagerechtes Wischen bzw. Scrollen innerhalb der Zeile.

> **AC-2** Die Werte beider Zeilen sind die Stellen des Gesamteinsatzes und die Von/An-Werte der aktuellen Fassung aller gültigen Einträge dieses Gesamteinsatzes. Werte, die sich nur in Groß- und Kleinschreibung unterscheiden, erscheinen als ein Chip, in der Schreibweise der jüngsten Verwendung; eine Stelle zählt dabei als verwendet, wenn sie angelegt oder umbenannt wird.

> **AC-4** Ein Tipp auf einen Chip wählt ihn aus, ein erneuter Tipp wählt ihn ab. Je Feld ist höchstens ein Wert gewählt.

> **AC-7** Der Text ist Pflicht wie heute. Von, An und Weg sind optional und unabhängig voneinander.

> **AC-12** Legt ein anderes Gerät einen Eintrag an, erscheinen seine Kopfzeile und neue Werte als Chips ohne Neuladen.

Dazu von den ACs unter *Toward*:

- AC-8: Nach erfolgreichem Speichern sind Von und An abgewählt; bei einem Fehler bleiben sie gewählt.
- AC-13: Mit den beiden Chip-Zeilen ist der Bereich für neue Einträge in der 360 px breiten Desktop-Seitenleiste höchstens 80 px höher als vor dieser Änderung.
- AC-14: Bei 360 px Breite scrollt die Seite mit den Chip-Zeilen nicht waagerecht.
- AC-15: Strg/⌘+Enter schickt den neuen Eintrag samt gewähltem Von und An ab.

## Toward
> **AC-8** Nach erfolgreichem Speichern ist der Text leer, Von und An sind abgewählt, offene „andere …“-Felder sind geschlossen, der Weg bleibt. Bei einem Fehler bleiben Text, Von, An und Weg erhalten, und die Fehlermeldung erscheint wie heute. Reihenfolge (AC-3) und gemerkter Weg (AC-6) ändern sich nur bei erfolgreichem Speichern.

> **AC-13** In der Desktop-Seitenleiste (360 px breit) ist der Bereich für neue Einträge höchstens 80 px höher als vor dieser Änderung.

> **AC-14** Bei 360 px Breite scrollt die Seite nicht waagerecht; eine lange Kopfzeile bricht im Eintrag um.

> **AC-15** Strg/⌘+Enter schickt den Eintrag samt Von, An und Weg ab, aus jedem seiner Eingabefelder, beim neuen Eintrag wie beim Korrigieren.

## Nudges
> Die Werteliste aus AC-2 liefert eine Funktion im Journal-Modul; die Seite lädt sie zusammen mit den Einträgen.

> Ein Bauteil für neuen Eintrag und Korrektur; die Kopfzeile formatiert eine reine Funktion mit eigenen Tests.

## Context
**Nach Ticket 02.** `journal_entries` hat `sender`, `recipient`, `channel`;
`appendEntry` und `addJournalEntryAction` nehmen eine `EntryRoute`
(`src/journal/entry-route.ts`); `JournalEntryView` trägt die Route, und
`JournalPanel` zeigt die Kopfzeile. `JournalPanel` hält die Route des neuen
Eintrags im Zustand; Von und An sind dort immer `null`. In
`src/journal/EntryRouteFields.tsx` gibt es `EntryChannelSelect`. Tests:
`JournalPanel.route.test.tsx`, `EntryRouteFields.test.tsx`,
`journal-actions.test.ts`. Ticket 02 hat unter `## Left standing` die Höhe des
Eingabebereichs vor dieser Änderung (Commit `6392481`) und nach Ticket 02
gemessen.

**Live.** Jede Action über `operationAction` ruft `revalidateOperation`, das ein
SSE-Ereignis schickt; `SituationWorkspace` ruft darauf `router.refresh()`. Was
`page.tsx` lädt, kommt also ohne Neuladen bei allen Geräten an. Die Werteliste
muss dafür nur von der Seite geladen werden.

**Stellen.** `src/server/strength/stations.ts`: `createStation`,
`renameStation` (kehrt ohne Änderung zurück, wenn der Name exakt gleich ist),
`listStations`. Tabelle `stations` hat `created_at`, aber keinen Zeitpunkt der
letzten Umbenennung. Den braucht AC-2.

**Gestaltung** (vereinbart, nicht neu entwerfen; Muster in
`changes/2026-09-30-von-an-weg-im-etb/specimens/eingabe-am-handy.html`): Über
dem Textfeld je eine Zeile „Von“ und „An“, links ein schmales gedimmtes Label,
daneben Chips in einer Reihe, die waagerecht scrollt und nie umbricht (rechter
Rand weich ausgeblendet, keine sichtbare Scrollbar). Gewählt: DRK-Rot hell
hinterlegt.

**Namen** (in diesem Ticket festgelegt): Die Werteliste heißt
`listCorrespondents`, ein Wert darin ist ein **Gesprächspartner**
(`correspondent`).

## Plan
1. **Glossar.** In `UBIQUITOUS_LANGUAGE.md` **Gesprächspartner**
   (`correspondent`) aufnehmen: eine Stelle oder ein Von/An-Wert aus der
   aktuellen Fassung eines gültigen Eintrags; Werte, die sich nur in Groß- und
   Kleinschreibung unterscheiden, sind einer, in der Schreibweise der jüngsten
   Verwendung.
   *Beweis:* Lesen.
2. **Schema.** `src/server/db/migrations/015_station_named_at.sql` (neu):
   `stations` bekommt `named_at timestamptz NOT NULL DEFAULT now()`, für
   bestehende Zeilen auf `created_at` gesetzt. `createStation` setzt es beim
   Anlegen, `renameStation` bei einer tatsächlichen Umbenennung auf `now()`.
   *Beweis:* `src/server/strength/stations.test.ts`: Umbenennen setzt
   `named_at` neu; ein Umbenennen auf den gleichen Namen nicht.
3. **Gesprächspartner.** `listCorrespondents(db, operationId): Promise<string[]>`
   in `src/server/journal/journal.ts`: Stellen-Namen (Zeitpunkt `named_at`) und
   `sender`/`recipient` aller gültigen Einträge (Zeitpunkt
   `COALESCE(edited_at, created_at)`), gruppiert nach `lower(wert)`, je Gruppe
   die Schreibweise mit dem jüngsten Zeitpunkt, alphabetisch sortiert.
   *Beweis:* `src/server/journal/correspondents.test.ts` (neu), mit
   `freshDb()`: Stellen und Einträge erscheinen; „Eal“, danach „EAL“ ergibt nur
   „EAL“; Stelle „UHSt 2“, danach ein Eintrag mit „UHST 2“ ergibt „UHST 2“,
   danach Umbenennen der Stelle in „Uhst 2“ ergibt „Uhst 2“; ein annullierter
   Eintrag zählt nicht.
4. **Seite und Workspace.** `page.tsx` lädt `listCorrespondents`;
   `SituationWorkspace` bekommt die Prop `correspondents: string[]` und reicht
   sie an `JournalPanel`. Fixtures ergänzen.
   *Beweis:* `npx tsc --noEmit` grün.
5. **Chip-Zeilen.** `EntryRouteChips` in `src/journal/EntryRouteFields.tsx`
   (kontrolliert: `label`, `value: string | null`, `onChange`, `options`):
   Mantine `Chip` kontrolliert; ein Tipp wählt, ein erneuter Tipp wählt ab,
   höchstens einer. Reihe mit `flex-wrap: nowrap` und `overflow-x: auto`.
   Sortierung alphabetisch (`localeCompare` mit `de`, `sensitivity: "base"`).
   Chips sind Knöpfe, keine Eingabefelder; Strg/⌘+Enter muss auf ihnen nichts tun.
   *Beweis:* `src/journal/EntryRouteFields.test.tsx`: Chips zeigen die Werte;
   Tipp wählt, erneuter Tipp wählt ab; Tipp auf einen zweiten Chip wechselt.
6. **AC-1, AC-4, AC-7, AC-12 im ETB.** `JournalPanel` bekommt `correspondents`
   und zeigt die Zeilen „Von“ und „An“ über dem Textfeld. Nach Erfolg sind Von
   und An `null`; bei Fehler bleiben sie.
   *Beweis:* Tests in `JournalPanel.route.test.tsx`: Von „UHSt 2“ und An „EAL“
   antippen, Text, absenden → `onAdd` mit beiden; nach Erfolg abgewählt; bei
   `{ error }` gewählt; nur Von, nur An, nur Weg und nichts davon lassen sich
   speichern, ohne Text nichts (AC-7); Strg+Enter schickt mit Von und An;
   `rerender` mit einem weiteren Eintrag samt Route und einem neuen Wert in
   `correspondents` zeigt dessen Kopfzeile und den neuen Chip (AC-12).
7. **Im Browser prüfen.** Mit dem Skill `run-einsatz` bei 360 px (Handy) und in
   der Desktop-Seitenleiste: Chip-Zeilen wischen, brechen nicht um, keine
   waagerechte Seiten-Scrollbar; Höhe des Eingabebereichs gegen den Wert vor
   dieser Änderung aus Ticket 02 (≤ 80 px mehr). Zwei Browserfenster: Eintrag im
   einen, Chip und Kopfzeile erscheinen im anderen ohne Neuladen.
   *Beweis:* Messwert und Beobachtung unter `## Left standing`.

## Not here
- Kein „andere …“: Ticket `04-andere-werte-frei-eingeben`.
- Keine Reihenfolge nach letzter Verwendung; die Chips sind hier alphabetisch: Ticket `06-reihenfolge-und-weg-je-geraet`.
- Kein Korrigieren von Von/An: Ticket `05-von-an-weg-korrigieren`.
- Aus *Out of scope*: Chips entfernen, z. B. durch langes Drücken. Wird gebaut, falls vertippte Werte im Einsatz stören.
- Aus *Out of scope*: Abgleich ähnlicher Schreibweisen über Groß- und Kleinschreibung hinaus („UHSt2“ und „UHSt 2“).

## Left standing
- Review-Nit nicht umgesetzt: Ist ein Chip gewählt und benennt ein anderes
  Gerät die Stelle nur in Groß- und Kleinschreibung um („UHSt 1“ → „Uhst 1“),
  zeigt die Zeile beide Schreibweisen, und Speichern macht die alte wieder zur
  jüngsten. Der gewählte Wert bleibt absichtlich als Chip stehen (siehe unten);
  ihn stattdessen still auf die neue Schreibweise umzustellen, hieße, etwas
  anderes zu speichern, als der Nutzer angetippt hat. Der Fall ist selten und
  heilt sich mit dem nächsten Eintrag. Ich habe ihn gelassen.
- Review-Nit nicht umgesetzt: Jeder Chip ist ein eigener Tab-Halt (Mantine
  `Chip` ist eine Checkbox). Bei 13 Gesprächspartnern liegen 26 Tab-Halte
  zwischen Liste und Textfeld. Eine Tastatur-Führung mit einem Halt je Zeile
  verlangt kein Kriterium dieses Tickets.
- Offen für Ticket 04: Trägt ein Eintrag denselben Wert in Von und An in
  verschiedener Schreibweise („Eal“ / „EAL“), haben beide denselben Zeitpunkt,
  und `listCorrespondents` wählt eine davon ohne feste Regel. Mit Chips allein
  entsteht das nicht, mit freier Eingabe schon.
- Zusätzlich zum Plan (Should-fix aus der ersten Review): Verschwindet der
  gewählte Wert aus den Gesprächspartnern (Stelle umbenannt, einziger Eintrag
  annulliert), bleibt er als gewählter Chip stehen. Vorher blieb er unsichtbar
  gewählt und wurde trotzdem gespeichert. Gepinnt in `EntryRouteFields.test.tsx`.
- AC-1 (kein Umbruch, waagerechtes Wischen) und AC-14 prüft kein
  automatischer Test, das ist CSS. Der Reviewer hat es im Browser geprüft: Mit
  12–15 Chips bleibt jede Zeile einzeilig (28 px hoch, 290 px sichtbar), ein
  Wischen am Handy scrollt die Zeile, ohne einen Chip zu wählen. Bei 360 px ist
  `scrollWidth` gleich `clientWidth`, nichts ragt über den rechten Rand. Keine
  sichtbare Scrollbar, rechter Rand blendet aus, gewählt DRK-Rot hell.
- AC-13 prüft kein automatischer Test, sondern der Reviewer im Browser. Höhe von
  `.journal-new-entry`: Desktop-Seitenleiste (1920×1080) und Handy bei 360 px
  je 178,375 px, gegenüber 102,375 px vor dieser Änderung (Ticket 02): +76 px.
  Ohne Gesprächspartner (nur die Labels) 165,75 px. Ticket 04 bleiben also
  4 px Spielraum, wenn „andere …“ in dieselben Zeilen kommt.
- AC-12: Der Test in `JournalPanel.route.test.tsx` rendert das Panel mit neuen
  Props neu; den Weg über SSE und `router.refresh()` prüft er nicht. Den hat
  der Reviewer mit zwei Browserfenstern geprüft: Eintrag samt Kopfzeile und
  eine neu angelegte Stelle als Chip erschienen im anderen Fenster ohne
  Neuladen.
- Abweichung vom Plan, Schritt 3: `listCorrespondents` sortiert nicht, die
  Reihenfolge legt nur `EntryRouteChips` fest (alphabetisch, `localeCompare`
  mit `de`). So steht die Reihenfolge an einer Stelle, und Ticket 06 ändert
  sie dort. Die Tests in `correspondents.test.ts` vergleichen deshalb sortiert.
- Abweichung vom Plan, Schritt 2: `createStation` setzt `named_at` nicht
  selbst; das tut der Spaltenvorgabewert `now()` beim Anlegen.
- Abweichung vom Plan, Schritt 5: Die Zeile ist ein `<fieldset>` mit
  `aria-label` statt eines `div` mit `role="group"`, weil Biome das verlangt.
  Die Chips sind Mantine-`Chip`s, also Checkboxen; Strg/⌘+Enter tut auf ihnen
  nichts.
- Abweichung vom Plan, Schritt 7: Im Browser habe ich nicht selbst geprüft.
  Das hat der Reviewer übernommen, mit den Messwerten oben.
- Zu den Nudges: `EntryRouteChips` ist so gebaut, dass Ticket 05 es beim
  Korrigieren wiederverwenden kann; den Eingabebereich selbst habe ich nicht in
  ein eigenes Bauteil gezogen, das gehört zum Korrigieren. `JournalPanel` hält
  jetzt, wie Ticket 02 es vorsah, eine ganze `EntryRoute` im Zustand.
- Zum TDD-Ablauf: Einige Tests liefen gleich grün, weil ihr Erwartungswert
  „nichts“ ist: „has none in a new Gesamteinsatz“, „does not list the Weg“,
  „leaves out the Von and An of an annulled entry“, „leaves out the Stellen
  and entries of another Gesamteinsatz“, „unchooses the value on a second
  tap“, „unchooses Von and An and keeps the Weg after adding“, „keeps when the
  Stelle was named when the name stays the same“, „starts a new entry without
  Von and An“, „adds a new entry with only Weg / none of them“ und „adds
  nothing without text“. Für die ersten fünf und „unchooses Von and An …“ habe
  ich den Code probeweise kaputt gemacht (Filter entfernt, Abwählen und
  Zurücksetzen gestrichen); sie schlugen dann fehl. Die übrigen habe ich so
  nicht geprüft.
