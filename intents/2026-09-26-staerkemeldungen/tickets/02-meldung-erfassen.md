---
solution:  02-SOLUTION.md
satisfies: AC-3, AC-4, AC-5, AC-6
after:     01-stellen
status:    ready
attempts:  0
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
