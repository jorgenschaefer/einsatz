---
solution:  02-SOLUTION.md
satisfies: AC-3, AC-4, AC-5, AC-6
after:     01-stellen
status:    done
attempts:  1
---

## Build
A Stärkemeldung can be recorded for a Stelle (form with prefill, „Unverändert melden"), writes its ETB entry, and each Stelle card shows its latest valid report.

## Done when
> **AC-3** Für eine Stelle wird eine Meldung erfasst. Führer, Unterführer, Helfer und zusätzliches Personal sind ganze Zahlen ab 0 und werden mit der Zifferntastatur eingegeben; die Notiz ist Freitext und optional. Σ und Gesamtpersonen zeigt das Formular berechnet an. Bei der ersten Meldung einer Stelle stehen alle Zahlen auf 0, danach sind die Werte der letzten gültigen Meldung vorbelegt, Notiz eingeschlossen.

> **AC-4** „Unverändert melden" legt mit einem Tipp eine neue Meldung mit den Werten und der Notiz der letzten gültigen Meldung an. Hat die Stelle noch keine Meldung, ist der Knopf nicht vorhanden.

> **AC-5** Jede erfasste Meldung schreibt einen ETB-Eintrag im Format „Stärkemeldung UHSt 3: 0/1/6//7, +2 zusätzlich, 9 Personen – 2 einsatzbereite Streifen". Ohne Notiz entfällt „ – …". Der Zeitstempel des Eintrags ist die Uhrzeit der Meldung.

> **AC-6** Für jede Stelle zeigt die Ansicht die letzte gültige Meldung mit Führer/Unterführer/Helfer//Σ, zusätzlichem Personal, Gesamtpersonen, Notiz und Uhrzeit. Eine Stelle ohne gültige Meldung zeigt „noch keine Meldung".

> **Zwei Meldungen derselben Stelle zur selben Minute:** Beide werden gespeichert. Als „letzte" gilt die mit der höheren ETB-Nummer.

> **Gesamteinsatz löschen:** Stellen, Meldungen und ihre ETB-Einträge verschwinden mit ihm, wie heute alles andere (kaskadierend).

## Context
From the solution (settled, do not re-decide):

- A **Stelle** belongs to one Gesamteinsatz (`Operation`) and is only a name - no location, no map symbol.
- A **Stärkemeldung** stores Führer, Unterführer, Helfer, zusätzliches Personal and an optional Notiz, plus a reference to the ETB entry that records it. Σ (Führer + Unterführer + Helfer) and Gesamtpersonen (Σ + zusätzliches Personal) are never stored, always computed. The report has no time or state of its own: time is its ETB entry's `created_at`, valid/annulled is the entry's `state`, order is the entry's `number`. Report and entry are written in the same transaction. A correction updates the report row directly and corrects the ETB entry in the same transaction via the existing revision mechanism (`journal_entry_revisions`); there is no revision table for reports. Both foreign keys (Stelle → Einsatz, Meldung → Stelle) and the reference to the ETB entry cascade on delete, so `deleteOperation` keeps working.
- New `JournalEntryType` values (in `src/server/journal/journal.ts` and the copy in `JournalPanel.tsx`): `stelle-angelegt`, `stelle-umbenannt`, `stärkemeldung`, `gesamtstärke-gemeldet` - each added by the ticket that first writes it. „Automatisch" stays only `einsatz-eröffnet` and `einsatz-geschlossen`: the Stärke entries carry no „automatisch" badge and „Automatische ausblenden" does not hide them. In the ETB only `manuell` is correctable; `manuell` and `gesamtstärke-gemeldet` are annullable (so a `gesamtstärke-gemeldet` entry's „⋯" menu has only „Annullieren …"). `stärkemeldung` entries are changed only from the view „Stärke" (no „⋯" in the ETB); Stelle entries are untouchable.
- „Stärke" is the third item of the main view bar (`MainViewBar`, after Lagekarte and ETB): bottom bar on the phone, left bar on the desktop. Like the other two views it stays mounted while switching, so a half-filled report form survives.
- The view is used on a smartphone (360 px); build every screen mobile-first even where the 360 px check belongs to ticket 10.
- Every change goes through `operationAction` (`src/app/operations/[id]/operation-action.ts`), which revalidates the page and publishes the SSE event; the page reloads via `router.refresh()`.
- Mockup: `../specimens/B-stellen-mit-meldungen.html`.

Decisions taken when slicing (planner's call, approved with the slicing):

- **English identifiers (confirmed by the user, glossary gets them):**
  Stelle → `Station` (table `stations`); Stärkemeldung → `StrengthReport` (table
  `strength_reports`); Führer/Unterführer/Helfer → `leaders`/`subLeaders`/`helpers`;
  zusätzliches Personal → `additionalPersonnel`; Σ → `sum`; Gesamtpersonen →
  `totalPersons`; Summe über die Stellen → `Total` (`totalOf`); „Gesamtstärke melden" →
  `reportTotalStrength`; Verlauf → `history`; Summenverlauf → `totalHistory`;
  Gesamteinsatz → existing `Operation`; main view id `"strength"`.
- **Layout:** pure, shared logic (types, Σ/Gesamtpersonen, ETB text format, latest
  report, sum, staleness, histories) in new `src/strength/strength.ts` - imported by
  both server and client, like `src/server/areas/areas.ts` imports `@/map/area`.
  UI in new `src/strength/StrengthPanel.tsx`. Server in new `src/server/strength/`.
  Actions in new `src/app/operations/[id]/strength-actions.ts`, all through
  `operationAction` (which revalidates + publishes the SSE event), each added to
  `src/app/auth-enforcement.test.ts`.
- **Data flow:** `page.tsx` loads Stellen and their reports (with time/state/number
  joined from `journal_entries`) and passes them as props through
  `SituationWorkspace` to `StrengthPanel`; SSE → `router.refresh()` re-renders them
  (existing mechanism). The client computes latest/sum/staleness/histories with the
  pure functions (staleness needs the ticking `useStalenessClock`).
- **In-pane navigation, no modal** for the Stelle detail (form + Verlauf) and the
  Summenverlauf: the Stärke pane holds `selectedStationId` / `showTotalHistory` state and
  a back button, so switching main views keeps a half-filled form (Approach: "bleibt
  beim Wechsel eingehängt"). A Modal would portal over the MainViewBar.
- **Verlauf rows get a „⋯" menu** (Korrigieren / Annullieren …) mirroring the ETB,
  instead of the mockup's ✎ - two actions need two entry points.
- **Times** shown as `HH:mm` Europe/Berlin (`Intl.DateTimeFormat`, as `JournalPanel`);
  the server formats the AC-13 text the same way.
- No ADR: every choice here is enforced by a test or visible in the schema.

## Plan
1. Migration `012_strength_reports.sql` (new): `strength_reports (id uuid pk, station_id
   uuid not null references stations on delete cascade, journal_entry_id uuid not null
   unique references journal_entries on delete cascade, leaders/sub_leaders/helpers/
   additional_personnel integer not null check (>= 0), note text)`, index on station_id.
2. `src/strength/strength.ts` (new) + test: `StrengthValues {leaders, subLeaders,
   helpers, additionalPersonnel, note}`, `sumOf`, `totalPersonsOf`,
   `formatStrengthReportText(stationName, values)` → „Stärkemeldung UHSt 3: 0/1/6//7, +2
   zusätzlich, 9 Personen – 2 einsatzbereite Streifen" (without „ – …" when note
   empty/whitespace), `latestValidReport(reports)` = valid report with the highest
   ETB number. Tests: the AC-5 example, no note, empty-note trimmed, two reports same
   minute → higher number wins, annulled ignored.
3. `JournalEntryType` gains `stärkemeldung` (both copies).
4. `src/server/strength/strength-reports.ts` (new) + test: `recordStrengthReport(tx,
   {stationId, values, author})` - runs inside the caller's transaction like
   `appendEntry` (the action wraps `db.transaction`; 03's lock test needs this);
   validates via `assertStrengthValues` (non-negative integers, `ValidationError`)
   and trims note (empty → null); steps: load Station (name, operation_id),
   `appendEntry` (type `stärkemeldung`, formatted text), insert report row with the
   entry id. `listStrengthReports(db, operationId)` joins `journal_entries` for
   `reportedAt` (= created_at), `state`, `number`. Tests: row + entry written
   atomically; negative/fractional rejected, nothing written; `reportedAt` equals
   entry created_at; closed operation still accepted; deleting the operation (`deleteOperation`) removes Stellen,
   reports and entries.
5. `recordStrengthReportAction(stationId, values)` in `strength-actions.ts`; auth test.
6. `page.tsx` loads reports, passes them (ISO strings) on the Stelle views.
7. `StrengthPanel.tsx`: card shows latest valid report F/UF/H//Σ, +zusätzlich,
   Gesamtpersonen, Notiz, Uhrzeit, or „noch keine Meldung". Tapping the card opens the
   in-pane Stelle detail (back button) with the report form: four `NumberInput`s
   (`inputMode="numeric"`, no negatives, no decimals), Notiz, computed Σ and
   Gesamtpersonen, prefilled with the latest valid report incl. note or zeros;
   „Melden"; „Unverändert melden" only when a valid report exists, sends the latest
   values in one tap. The prefill is taken once when the Stelle detail opens; a
   live refresh does not overwrite typed values (confirmed by the user). Tests with fake actions for each of these; AC-3 prefill after
   an annulled latest report uses the previous valid one.
8. `JournalPanel`: `stärkemeldung` has no badge, is not filtered, has no „⋯" (test).
9. Glossary: **Stärkemeldung** (`StrengthReport`).
10. `npm run check`.

## Not here
sum, staleness highlight (03); Verlauf (04); correcting/annulling (06,
07). Non-goals: no separate report time („gemeldet 11:01, erfasst 11:04"); units stay
text in the note.

## Record

**Criteria → tests**

- **AC-3** (form, whole numbers ≥ 0 via the numeric keypad, optional note, computed Σ/Gesamtpersonen, prefill with zeros or the latest valid report incl. note)
  - `src/strength/StrengthPanel.test.tsx` › reporting: „opens the form of a Stelle from its card and goes back", „opens the form from anywhere on the card, but not from the pencil", „starts at zero for the first report and has no „Unverändert melden"" (also asserts `inputmode="numeric"` on all four fields), „prefills the latest valid report, note included" (the latest one is annulled, so the previous valid one is used), „shows Σ and Gesamtpersonen computed as you type", „replaces a prefilled number when typing into it", „takes at most four digits", „accepts neither negatives nor decimals", „reports the typed values and returns to the Stellen", „reports an emptied number as 0 and an empty note as none", „shows a returned error and keeps the typed values", „shows a failed save as an error", „keeps typed values when a new report arrives live", „prefills afresh when the form is opened again", „keeps another Stelle's form open when an earlier report finishes saving", „keeps a report form open when a rename finishes saving".
  - Server: `src/server/strength/strength-reports.test.ts` › recordStrengthReport: „accepts all zeros", „accepts 9999", „rejects a negative number / a fraction / not a number / a string / more than 9999 without writing anything", „rejects a note that is not text without writing anything", „trims the note and stores an empty one as none", „rejects an unknown Stelle".
  - Pure: `src/strength/strength.test.ts` › „sumOf / totalPersonsOf".
  - Workspace: `src/map/SituationWorkspace.test.tsx` „records a Stärkemeldung of a Stelle", „keeps a half-filled Stärkemeldung when switching to the Lagekarte and back".
  - Action: `src/app/operations/[id]/strength-actions.test.ts` „records a Stärkemeldung in the name of the logged-in user", „reports a negative number as a form error"; `recordStrengthReportAction` is in `src/app/auth-enforcement.test.ts`.
- **AC-4** („Unverändert melden")
  - `StrengthPanel.test.tsx` „„Unverändert melden" reports the latest valid report in one tap, whatever was typed" (latest is annulled → the previous valid one is sent, exactly once); its absence without a report is covered by „starts at zero for the first report and has no „Unverändert melden"".
- **AC-5** (ETB text, without „ – …" when there is no note, entry time = report time)
  - `strength.test.ts` › formatStrengthReportText: „formats the report with its note", „leaves out „ – …" for the note null / "" / whitespace", „trims the note".
  - `strength-reports.test.ts` „records „Stärkemeldung …" in the ETB with its author", „stores the report with the time, state and number of its ETB entry" (`reportedAt` equals the entry's `createdAt`), „names the Stelle as renamed by a rename it had to wait for".
  - ETB treatment of the `stärkemeldung` type: `JournalPanel.test.tsx` „shows a stärkemeldung entry as neither automatic nor changeable, and keeps it when automatic ones are hidden"; `journal-history.test.ts` › „a stärkemeldung entry" › „cannot be corrected", „cannot be annulled".
- **AC-6** (card shows the latest valid report F/UF/H//Σ, zusätzlich, Gesamtpersonen, note, time, or „noch keine Meldung")
  - `StrengthPanel.test.tsx` › the card of a Stelle: „shows its latest valid report with time and note" (11:01 Europe/Berlin), „skips an annulled latest report", „shows „noch keine Meldung" without a valid report".
  - `strength-reports.test.ts` › listStrengthReports: „shows an annulled entry's report as annulled", „lists only the reports of the given Gesamteinsatz".
- **Two reports in the same minute**: `strength-reports.test.ts` „keeps both reports of a Stelle made in the same minute, in ETB order"; `strength.test.ts` › latestValidReport: „is the valid report with the highest ETB number, whatever the order", „skips annulled reports", „is undefined without reports", „is undefined when every report is annulled".
- **Deleting the Gesamteinsatz**: `src/server/operations/delete-operation.test.ts` „cascades the operation's Stellen, their Stärkemeldungen and ETB entries". It also checks the raw `strength_reports` table and turns red when the migration's `ON DELETE CASCADE` is removed.
- A closed Gesamteinsatz still accepts reports (same as Stellen): `strength-reports.test.ts` „still accepts a report once the Gesamteinsatz is closed".

**Command**: `docker compose -f docker-compose.test.yml up -d && npm run check`. The final run was green: 111 files, 919 tests.

**Departures from the plan**

- **Number fields are `TextInput`, not `NumberInput`.** Mantine's `NumberInput` overwrites `inputMode` with `"decimal"`, which does not give the digits-only keypad that AC-3 asks for. Each field is a `TextInput` with `inputMode="numeric"`. It keeps only the digits, takes at most 4 of them, and selects its content on focus, so typing replaces a prefilled value instead of producing "06". An emptied field is reported as 0.
- **Counts are capped at 9999.** The planned rule was only "non-negative integers". The server also rejects values above 9999, with the message „Die Stärke muss aus ganzen Zahlen von 0 bis 9999 bestehen." Without a cap, a huge number broke the DB `integer` column with a misleading message. The cap is my call on the largest realistic input for one Stelle. This came from review.
- **Rename now locks with `FOR NO KEY UPDATE` instead of `FOR UPDATE`** (`stations.ts`). A report takes the operation lock and then, through its foreign key, a `FOR KEY SHARE` lock on the Stelle. A rename takes the Stelle lock and then the operation lock. With `FOR UPDATE` the two deadlocked; this was reproduced red by „records and renames the same Stelle concurrently without deadlocking".
- **`recordStrengthReport` locks the operation before it reads the Stelle's name.** Otherwise a rename that is numbered before the report would leave the report's ETB text with the old name. This came from review and is pinned by „names the Stelle as renamed by a rename it had to wait for".
- **A save that finishes late closes only its own form.** Before, any successful save (report, rename, create) closed every open form in the pane, including a half-filled report for another Stelle. This came from review; 01's rename and create paths are included.
- **Reports hang on `StationView.reports`** (`reportedAt` as an ISO string), grouped in `page.tsx`.
- **After „Melden" or „Unverändert melden" succeeds, the pane goes back to the list of Stellen.** The ticket did not specify this.
- **The planned cascade test moved.** The planned `strength-reports.test.ts` case „deleting the operation removes Stellen, reports and entries" became the extended test in `delete-operation.test.ts`, next to 01's Stellen cascade test.
- **Some tests passed on their first run, because the behaviour already followed from existing code or schema.** These are the cascade test, the `journal-history`/`JournalPanel` cases for `stärkemeldung` (01 made "only `manuell` is changeable" a general rule), and a few `strength-reports` edge tests written in one batch against the full implementation. The cascade test was then proven by removing the cascade (red). The „does not look clickable while … renamed" test was written after its code and proven by reverting the code (red).

**Left standing**

- Review nit, not fixed: `recordStrengthReport` takes the caller's transaction (`Queryable`) instead of opening its own like `createStation`/`renameStation`. The plan does this on purpose for ticket 03's lock test, and `appendEntry` already follows the same pattern.
- Review tradeoff, not changed: trimming the note happens in three places (the form, `requireStrengthValues`, `formatStrengthReportText`). Each keeps its function safe with raw input.
- Review note: „Unverändert melden" is in the Stelle's form, so it takes two taps from the list (open the card, then the button). This follows the plan and the mockup. Whether AC-4's „mit einem Tipp" means one tap from the list is a product question.
- Not checked in a real browser: whether `inputMode="numeric"` brings up the digit keypad, whether select-on-focus works on iOS Safari, and the 360 px layout of the four-column row (the label „Unterführer" may be tight). Mobile verification belongs to ticket 10. `page.tsx` wiring is covered only by `tsc`.
- Earlier full runs had 4–17 tests fail on the 5 s timeout, all in map tests (`SituationWorkspace`, `AdvancedSymbolForm`) and `password.test.ts`. The machine had a load average of 12–14 on 4 cores from other checkouts' test runs. The failing tests pass in isolation, and on an unchanged HEAD checkout they were as slow or slower (5.2–6.8 s vs 2.6–4.5 s). The final run was green.
