---
solution:  02-SOLUTION.md
satisfies: AC-10
after:     03-summe-und-gesamtstaerke
status:    done
attempts:  1
---

## Build
The sum card opens the Summenverlauf: one row per valid report with the sum that applied at that time.

## Done when
> **AC-10** Der Summenverlauf hat eine Zeile je gültiger Meldung, neueste zuerst. Jede Zeile trägt die Uhrzeit dieser Meldung und die Summe, die zu diesem Zeitpunkt galt: die jüngste gültige Meldung jeder Stelle mit Uhrzeit ≤ der Zeile.

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
`strength.ts` `totalHistory(stations)` - one row per valid report,
newest first; row time = that report's time; per Stelle the valid report with the
highest number among those with time ≤ row time, summed with `totalOf` +
tests (interleaved Stellen, same-minute reports). Sum card gets „Verlauf" opening
the in-pane Summenverlauf table with back button; panel test. `npm run check`.

## Not here
AC-16 dataset (08). Non-goal: no charts.

## Record

**Criteria → tests**

- **AC-10** (a row for each valid report, newest first, with that report's time and the sum that applied then: each Stelle's latest valid report with time ≤ the row)
  - `src/strength/strength.test.ts` › totalHistory:
    - „is empty without a valid report"
    - „has a row per valid report, newest first, with the sum of each Stelle's latest report by then" (two Stellen whose reports interleave)
    - „leaves annulled reports out of the rows and out of the sums"
    - „counts a report in the same minute only from its own second on"
    - „counts reports of the very same time in each other's rows" (pins the ≤)
    - „carries the whole Total of the row's time"
  - `src/strength/StrengthPanel.test.tsx` › the Summenverlauf:
    - „lists a row per valid report, newest first, with the sum that applied then" (Berlin HH:mm, an annulled report left out, the Summe card hidden while the view is open)
    - „goes back to the Stellen"
    - „shows no table once its last valid report is annulled"
    - „cannot be opened without a valid report"

**Command**: `docker compose -f docker-compose.test.yml up -d && npm run check`. The final run was green: 112 files, 977 tests.

**Departures from the plan**

- **Test-first exceptions.** Four `totalHistory` edge tests passed as soon as they were written, because the general implementation already covered them: annulled, same minute, very same time, and whole Total. I proved them by mutation instead. Changing `<=` to `<` turned 5 of the 6 `totalHistory` tests red. Rounding the cut-off to the minute turned the same-minute test red. Only the empty case survives the `<` change, because it has no valid report to cut off.
- **Row shape.** `totalHistory` returns `TotalHistoryRow` `{ number, reportedAt, total: Total }`, with rows ordered by ETB number (through `stationHistory`).
- **Layout.** The Summe card shows „Verlauf" next to „Gesamtstärke melden", in one `Group`. Its columns are Zeit, F/UF/H//Σ, + and Pers.; there is no mockup of the Summenverlauf. „Verlauf" is disabled without a valid report, like „Gesamtstärke melden". The open view shows no table once no valid report is left. That behaviour came from a review nit.
- **Shared columns.** `StrengthHeads` and `StrengthCells` now hold the four shared columns of both Verlauf tables. Both review rounds flagged the duplicate. This was a refactor, and the existing table tests cover it.
- **Glossary.** Added the entry **Summenverlauf** (`totalHistory`).

**Left standing**

- **Review should-fix, not changed.** Rows are ordered by ETB number, but each row's cut-off is the report time (`created_at`, the start of its transaction), as AC-10 says („Uhrzeit ≤").
  - Two reports can race for the operation lock: the later number gets the earlier `created_at`. In that case the top row can differ from the Summe card, which takes the latest report by number.
  - This needs such a race and is rare. The criterion settles the cut-off, so I didn't switch it to number order. If the two should always agree, that is a product decision.
- **Performance.** `totalHistory` is O(n²) in the operation's reports and is recomputed on every clock tick while the pane is mounted. It is not measured; a few hundred reports should be negligible.
- **Not checked in a real browser.** Whether the two buttons and the four-column table fit at 360 px. That belongs to ticket 10. `page.tsx` needed no change.
- The new doc comments are German, like the rest of `strength.ts` and `StrengthPanel.tsx` (see ticket 04).
