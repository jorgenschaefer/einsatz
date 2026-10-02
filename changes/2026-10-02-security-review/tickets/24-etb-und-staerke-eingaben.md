---
criteria:  CRITERIA.md
closes:
advances:  AC-22
after:     23-kartenobjekte-eingaben
status:    ready
attempts:  0
---

## Build
The ETB and Stärke server actions check their inputs - types, UUID ids and
lengths - and reject bad ones with a message instead of a server error,
storing nothing.

## Done when
Toward AC-22, this slice makes it true for the actions in
`src/app/operations/[id]/journal-actions.ts` and `strength-actions.ts`: each
rejects ids that are not a UUID, a content or values argument that is not an
object, a text, Von, An, Weg, Stellenname or note of the wrong type, an
ETB-Text over 10,000 characters, Von, An or a Stellenname over 200 and a
Stärkemeldung note over 2,000, with a message, and then stores nothing.

## Toward
> **AC-22** Jede Server Action lehnt falsche Typen, IDs, die keine UUID sind, unbekannte Bereichsformen (alles außer Polygon, Linie, Kreis) und Strings über ihrer Höchstlänge mit einer Meldung ab statt mit einem Serverfehler, und speichert dann nichts. Höchstlängen: Namen, Bezeichnungen, Beschriftungen, Von/An und Weg 200 Zeichen; KML-URL 2.000; Einsatzbeschreibung und Notizen 2.000; ETB-Text 10.000; Bereichsfarbe genau `#` und sechs Hex-Ziffern. Ein Polygon hat mindestens 3 Punkte, eine Linie mindestens 2.

## Nudges
> Keine neuen Abhängigkeiten. Eingabeprüfung in `src/server/validation.ts` erweitern, ohne zod.

## Context
- **Helpers from ticket 23** in `src/server/validation.ts`: `assertUuid`
  ("Ungültige ID."), `assertText(value, field, max)` ("<field> muss Text
  sein." / "<field> darf höchstens <max> Zeichen lang sein.", `max` with
  German digit grouping), `assertBoolean`, `assertObject(value, message)`,
  `assertHexColor`. Use them; add a helper only for a check none of them
  makes.
- **ETB** (`src/app/operations/[id]/journal-actions.ts` →
  `src/server/journal/journal.ts`, 358 lines):
  - `addJournalEntryAction(operationId, { text, ...route })` destructures its
    second argument in the parameter list, so a `null` content throws before
    `operationAction` - before `requireUser()` too.
  - `appendEntry(tx, { operationId, text, type, author, route })` and
    `reviseEntry(tx, entryId, content, author)` call `requireEntryText`
    (`.trim()` on `text`) and `trimRouteValue` (`src/journal/entry-route.ts`,
    `.trim()` on Von/An/Weg); a non-string throws a `TypeError`. No length
    limits. `correctEntry(db, entryId, content, author)` and
    `annulEntry(db, entryId)` query by `entryId` first. `appendEntry` is also
    called by `createOperation`, the Stärke code and the Stelle code with
    trusted content; `reviseEntry` also by `correctStrengthReport`.
  - Weg (`channel`) is *Funk*, *Telefon*, *Persönlich* or free text
    (`src/journal/EntryRouteFields.tsx`); AC-22 gives it no length.
- **Stärke** (`strength-actions.ts` → `src/server/strength/stations.ts`,
  `strength-reports.ts`, `total-strength.ts`): `requireStationName` trims
  without a type check and has no limit; `requireStrengthValues` checks the
  counts and that `note` is a string or `null`, but not that `values` is an
  object (a `null` throws on `values.leaders`) and not the note's length.
  Ids unchecked in `createStation` (`operationId`), `renameStation`
  (`stationId`), `recordStrengthReport` (`stationId`),
  `correctStrengthReport` (`reportId`, `stationId`), `annulStrengthReport`
  (`reportId`), `reportTotalStrength` (`operationId`).
- **Lengths in AC-22 mapped to fields:** ETB-Text 10,000; Von and An 200
  each; Stellenname 200 ("Namen"); Stärkemeldung note 2,000 ("Notizen").
  Checked after trimming, on what would be stored.
- **The auth guard comes first.** `src/app/auth-enforcement.test.ts` calls
  every action with placeholder ids and expects the login redirect. Every
  new check runs inside `operationAction`'s `run` or in the domain function.
- **Test patterns.** `journal-actions.test.ts` (138 lines) and
  `strength-actions.test.ts` (344 lines) show the action harness;
  `strength-reports.test.ts` (579 lines) is over the size limit and
  `strength-actions.test.ts` near it: no new tests in either, new tests go in
  new files.

## Plan
1. **Red: ETB and Stärke actions reject bad input.** New
   `src/app/operations/[id]/journal-actions.validation.test.ts` and
   `strength-actions.validation.test.ts`, real DB (harness as in the existing
   action tests), one Einsatz with a manual ETB entry, a Stelle and a
   Stärkemeldung. A table of bad calls per file, each expecting
   `{ error: <message> }` and an unchanged database (compare
   `listEntries`, `listStations`, `listStrengthReports` of the Einsatz before
   and after):
   - ids not a UUID: `operationId`, `entryId`, `stationId`, `reportId`;
   - wrong types: content / values `null` or a string; `text`, `sender`,
     `recipient`, `channel`, Stellenname, `note` as a number;
   - lengths, each with the boundary accepted in a separate test: ETB-Text
     10,001 (10,000 accepted, also with surrounding blanks - stored trimmed),
     Von and An 201, Weg over `MAX_CHANNEL_LENGTH`, Stellenname 201 (create
     and rename), note 2,001 (record and correct).
   *Proof:* red - most rows end in a thrown error today.
2. **Green: ETB content.** In `journal.ts`, one check for an entry's content,
   used by `appendEntry` and `reviseEntry` before anything is written:
   `text` a string, at most 10,000 characters after trimming ("Der Text");
   `sender` and `recipient` `null` or a string of at most 200 after trimming
   ("Von", "An"); `channel` `null` or a string of at most
   `MAX_CHANNEL_LENGTH` after trimming ("Der Weg"), one constant, proposed
   200. `addJournalEntryAction` takes `content: EntryContent` whole, checks it
   with `assertObject` inside `run`, then splits it. Unit tests in a new
   `src/server/journal/journal.validation.test.ts`.
   *Proof:* the content rows of step 1 green.
3. **Green: ETB ids.** `operationId` in `appendEntry` and `entryId` in
   `correctEntry`, `annulEntry` through `assertUuid`.
   *Proof:* the ETB id rows of step 1 green.
4. **Green: Stärke.** `requireStationName` rejects a non-string and more
   than 200 characters ("Der Name der Stelle"); `requireStrengthValues`
   rejects a non-object and a note over 2,000 characters ("Die Notiz");
   the ids listed under Context through `assertUuid`. Unit tests in a new
   `src/server/strength/strength-input.test.ts`.
   *Proof:* the Stärke rows of step 1 green.
5. **In the browser** (skill `run-einsatz`): write an ETB entry with Von, An
   and Weg, correct one, annul one; create and rename a Stelle, report Stärke
   with a note, correct and annul it, report the Gesamtstärke. All work as
   before. Paste a 10,001-character ETB text → the length message, nothing
   written.
   *Proof:* observations under `## Left standing`.
6. `npm run check` green.

Decided here (show at approval): lengths are checked after trimming, on what
would be stored; the field names in the messages ("Der Text", "Von", "An",
"Der Weg", "Der Name der Stelle", "Die Notiz").

Open product point (the answer changes one constant): the longest Weg of an
ETB entry, `MAX_CHANNEL_LENGTH`, proposed 200 like Von and An.

## Not here
- The helpers themselves and the Lagekarte actions: ticket
  `23-kartenobjekte-eingaben`.
- Einsatz anlegen, lifecycle, Nutzerverwaltung, Konto, Login, Kartensuche:
  ticket `25-einsatz-und-konten-eingaben`. The test that walks every server
  action: ticket `18-eingaben-pruefen`.
- `maxLength` on form inputs: not required; the server message is what
  AC-22 asks for.
- From `CRITERIA.md`'s Out of scope: "Ein abgeschlossener Einsatz bleibt
  bearbeitbar; Abschließen sperrt nichts außer den Links." - do not reject
  ETB or Stärke input because the Einsatz is closed.

## Left standing
