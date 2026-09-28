---
solution:  02-SOLUTION.md
satisfies: AC-16
after:     04-verlauf-der-stelle, 05-summenverlauf
status:    done
attempts:  1
---

## Build
A test pins AC-6 to AC-10 on the Cyclassics dataset: 4 Stellen, 13 hourly reports each.

## Done when
> **AC-16** Ein Gesamteinsatz mit 4 Stellen und 13 Meldungen je Stelle (einmal stündlich von 08:00 bis 20:00) liefert für AC-6 bis AC-10 die richtigen Werte. Ein Test pinnt das an genau diesem Datensatz.

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

**Red-first is impossible here, said out loud:** AC-16 pins code 02–05 already
built, so the test is expected green on its first run; to prove it can fail, break
`totalHistory` once locally and watch it go red, then revert.

## Plan
`src/strength/strength.cyclassics.test.ts` (new), fixed `now` = 20:30 so
AC-8's stale highlight is checked too (the 20:00 reports are fresh, none stale;
a second assertion at `now` = 21:01 all stale): 4 Stellen × 13 reports
08:00–20:00 hourly, assert AC-6 latest per Stelle, AC-7 sum, AC-8 oldest, AC-9
history per Stelle, AC-10 all 52 rows (selected rows spelled out). `npm run check`.

## Record

**Criterion → tests**

- **AC-16** — `src/strength/strength.cyclassics.test.ts` › „the Cyclassics dataset: 4 Stellen, 13 hourly reports each". The dataset has 4 Stellen × 13 reports, 08:00–20:00 CEST (2026-08-23). The 4 reports of an hour follow each other 15 s apart, because real ETB entries never share a timestamp. ETB numbers are 6–57, since entries 1–5 are „Einsatz eröffnet" and the four „Stelle angelegt". Stelle 1 has no notes; the others note „Runde n". Each criterion on this dataset:
  - AC-6: „shows the 20:00 report as each Stelle's latest (AC-6)" (F/UF/H//Σ, zusätzlich, Gesamtpersonen, Notiz, Uhrzeit).
  - AC-7: „adds up the 20:00 reports and names the oldest of them (AC-7, AC-8)" (4/10/60//74, +6, 80 Personen, 4 Stellen).
  - AC-8: the same test for the oldest report (20:00, Stelle 1's exact timestamp); „highlights nothing at 20:30 and everything at 21:01 (AC-8)" for the sum and every card.
  - AC-9: „lists each Stelle's 13 reports newest first (AC-9)". All 52 rows are spelled out with time, values, Gesamtpersonen and note.
  - AC-10: „the Summenverlauf (AC-10)": „has a row for each of the 52 reports, newest first" (ETB numbers and all 52 times spelled out), „sums only the first Stelle at the first report", „adds each Stelle as its first report comes in", „mixes this hour's reports with last hour's while the round is under way" (14:00 row: 4/10/35//49, oldest 13:00), „ends with the current sum at the last report".
- **Red-first was impossible, as the ticket says:** the test was green on its first run because it pins code already built. To prove it can fail, each of these was broken once locally, watched go red, then reverted:
  - `totalHistory` `<=` → `<`: 4 failures.
  - `stationHistory` sort reversed: 6 failures.
  - stale limit doubled: 1 failure.
  - `totalOf` oldest comparison flipped: 2 failures.
- The review's should-fix (Gesamtpersonen and Notiz not pinned) was done test-first: the expectations were updated and went red (2 failures), then the dataset and helper were changed to make them green.

**Command:** `docker compose -f docker-compose.test.yml up -d && npm run check`. Green: tsc, biome (264 files), vitest 113 files / 1023 tests. One earlier run had 7 failures in 1 file, while a parallel reviewer run was loading the machine. An immediate re-run of the full suite, and then the final `npm run check`, were both green, so I took it as load-related flakiness. I did not identify the failing file.

**Left standing**

- Review nit not fixed: when a Summenverlauf row is missing, `describeRow` fails with „expected undefined …" rather than naming the ETB number. It still fails, so the only cost is a less helpful message.
- Review tradeoff, kept as is: in this dataset, ETB number, time and helper count all rise together. So choosing the latest report by time, or filtering `totalHistory` by number instead of time, would still pass here. `strength.test.ts` already pins those cases with out-of-order data. Scrambling this dataset would make it no longer „genau diesem Datensatz".
- Departure from the plan: none in substance. The test covers the pure functions in `src/strength/strength.ts`, as planned, not the `StrengthPanel` UI. AC-6's „noch keine Meldung" cannot occur in this dataset, where every Stelle reports; it stays pinned by `StrengthPanel.test.tsx`.
