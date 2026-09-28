---
solution:  02-SOLUTION.md
satisfies: AC-9
after:     02-meldung-erfassen
status:    done
attempts:  1
---

## Build
The Stelle detail shows the Stelle's history of valid reports.

## Done when
> **AC-9** Der Verlauf einer Stelle listet alle ihre gültigen Meldungen, neueste zuerst, jeweils mit Uhrzeit, allen Werten und Notiz.

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
`strength.ts` `stationHistory(reports)` valid reports newest first (by
number) + test; Stelle detail shows the Verlauf table (Zeit, F/UF/H//Σ, +, Pers.,
Notiz) under the form; `StrengthPanel.test.tsx` covers ordering and that annulled
reports are absent. `npm run check`.

## Not here
row „⋯" menu (06/07); Summenverlauf (05). Non-goal: no charts.

## Record

**Criteria → tests**

- **AC-9** (all valid reports of a Stelle, newest first, each with time, all values and note)
  - `src/strength/strength.test.ts` › stationHistory: „is empty without reports", „lists the valid reports newest first by ETB number, whatever the order", „leaves out annulled reports", „does not reorder the reports it was given".
  - `src/strength/StrengthPanel.test.tsx` › the Verlauf of a Stelle: „lists every valid report newest first, with time, all values and note" (reports given out of order; checks all five columns per row, the Berlin summer-time conversion and an empty cell for a missing note), „leaves out annulled reports", „is not shown without a valid report".

**Command**: `docker compose -f docker-compose.test.yml up -d && npm run check`. The final run was green: 112 files, 967 tests. Two earlier full runs, one at load average 17 on 4 cores, timed out 4 and then 1 map test in `src/map/SituationWorkspace.test.tsx` at 5 s. That is the same load-dependent timeout tickets 01–03 record. The file passes alone (131/131), and `vitest run --maxWorkers=2` was green in between.

**Departures from the plan**

- **The Verlauf is hidden when the Stelle has no valid report.** The plan didn't say what an empty Verlauf shows, so there is no heading and no empty table.
- **The Verlauf sits under the form, outside it**, with the heading „Verlauf <Stelle>" (as in the mockup). The heading labels the table. The mockup's ✎ column is left out, because the row „⋯" menu belongs to 06/07.
- **`formatStrength(counts)`** („0/1/6//7") was extracted into `strength.ts` and is now used by the ETB texts of Stärkemeldung and Gesamtstärke, the Stelle card, the Summe and the Verlauf. It had been written out four times. This came from review.
- **`latestValidReport` is now `stationHistory(reports)[0]`**, so the Stelle card and the Verlauf's top row can't disagree about which report is newest. Its existing tests pin it. This came from a review nit.
- **Glossary**: added the entry **Verlauf** (`history`, `stationHistory`). This came from review.
- Test-first exceptions: „does not reorder the reports it was given" and „is not shown without a valid report" passed on the stub or before the code existed. I proved each one by mutation instead: sorting in place, and removing the early return, both turned them red.

**Left standing**

- Not checked in a real browser: whether the five-column table fits at 360 px with large counts and a long note. There is no horizontal scroll wrapper. That belongs to ticket 10. `page.tsx` needed no change, because the reports already reach the panel.
- Times are HH:mm only, so an operation that runs past midnight shows times without a date. This follows the settled time format.
- The new doc comments are German, like every existing comment in `strength.ts`. The coding standard asks for English comments, but I followed the file's convention.
