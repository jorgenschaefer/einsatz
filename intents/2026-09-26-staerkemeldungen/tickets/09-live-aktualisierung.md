---
solution:  02-SOLUTION.md
satisfies: AC-14
after:     01-stellen, 02-meldung-erfassen, 03-summe-und-gesamtstaerke, 04-verlauf-der-stelle, 05-summenverlauf, 06-meldung-korrigieren, 07-meldung-annullieren
status:    done
attempts:  2
---

## Build
Prove every Stärke change reaches all open Führungsansichten live via the SSE bus.

## Done when
> **AC-14** Jede Änderung aus AC-1 bis AC-13 und AC-19 erscheint in allen offenen Führungsansichten dieses Gesamteinsatzes, ohne dass jemand neu lädt. Dafür wird der bestehende SSE-Bus genutzt.

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

**Red-first is impossible here, said out loud:** `operationAction` already publishes;
the tests are expected green first time. Prove each can fail by making one action
return the wrong id (e.g. `stationId`) locally, watch it go red, revert.

## Plan
`strength-actions.test.ts` (new): each strength action publishes an
operation event (subscribe via `subscribeOperation`, run the action with mocked
auth like `auth-enforcement.test.ts`, assert the listener fired);
`SituationWorkspace.test.tsx`: the injected events hook's `onChanged` triggers
`router.refresh` and new `stations` props show in the Stärke pane. Browser check with
run-einsatz: two tabs, a report in one appears in the other. `npm run check`.

## Record

**Criterion → tests (AC-14)**, link by link, from the change to the open views:

- **Every Stärke change publishes on the SSE bus of its own operation, exactly once.** `src/app/operations/[id]/strength-actions.test.ts` › „strength actions › reach every open Führungsansicht of the operation live". This runs the real action, `operationAction` and the real bus against a fresh DB, and counts the events a `subscribeOperation` listener receives. There is one case per change:
  - „creating a Stelle" (AC-1)
  - „renaming a Stelle"
  - „recording a Stärkemeldung" (AC-2–5)
  - „correcting a Stärkemeldung" (AC-11)
  - „annulling a Stärkemeldung" (AC-12)
  - „reporting the Gesamtstärke" (AC-13)

  „… but not those of another operation" checks that an action's event does not reach another Gesamteinsatz.
- **An event reloads the page:** the existing `src/map/SituationWorkspace.test.tsx` › „reloads the full state when a live event arrives" (`onChanged` → `router.refresh()`). The existing tests `operation-events.test.ts` and `sse.test.ts` cover the fan-out to every subscriber and the SSE stream.
- **Reloaded `stations` reach the Stärke pane:**
  - `SituationWorkspace.test.tsx` › „Stärke › shows a Stelle and a Stärkemeldung arriving live while Stärke is shown": a new Stelle, plus the report on the card and in the Summe (AC-6, AC-7).
- **An open Verlauf and an open Summenverlauf follow live:**
  - `src/strength/StrengthPanel.test.tsx` › „the Verlauf of a Stelle › shows a report arriving live while it is open" (AC-9).
  - `StrengthPanel.test.tsx` › „the Summenverlauf › shows a report arriving live while it is open" (AC-10).
  - The existing tests „keeps typed values when a new report arrives live", „closes the correction of a report once it is annulled" and „shows no table once its last valid report is annulled" cover a half-filled form and annulments that arrive live.
  - The existing test „counts a new entry from another author while Stärke is shown" covers the ETB entries (AC-5, AC-13).
- **Red-first was impossible, as the ticket says.** Every new test was green on its first run. To prove each can fail, I broke the code once locally, watched the test go red, and reverted:
  - `renameStationAction` returning `stationId`: 1 failure (`expected +0 to be 1`).
  - `publishOperationChanged` removed from `operationAction`: 6 failures.
  - `SituationWorkspace` passing a `useState` snapshot of `stations`: 1 failure.
  - `StrengthPanel` resolving the open Stelle from a frozen snapshot: the Verlauf test fails.
  - `totalHistory` frozen in `useState`: the Summenverlauf test fails.
- **Browser check (run-einsatz, done by a subagent):** two independent logged-in sessions on the same Einsatz, both on „Stärke". Every change made in tab A appeared in tab B without a reload, with no console errors:
  - Stelle angelegt
  - a Stärkemeldung (card and Summe)
  - Gesamtstärke gemeldet
  - Stelle umbenannt
  - a report annulled from the Verlauf
  - each step's ETB entry

  A correction was not tried in the browser; it is pinned by the tests above.

**Command:** `docker compose -f docker-compose.test.yml up -d && npm run check`. Green: tsc, biome, vitest 113 files / 1033 tests.

**Left standing**

- No production code changed: the live path already worked, and this ticket pins it.
- Review round 1: I fixed the should-fix (Verlauf/Summenverlauf not pinned while open) and both nits (a `getAllByText` that could not tell card from Summe, a test name narrower than its assertions).
- Review round 2: clean apart from one nit I did not take. The reviewer called „but not those of another operation" redundant with the bus test „notifies subscribers of their own operation only". I kept it because it covers something the `it.each` cannot: an action that publishes to its own operation *and* to a wrong one would pass the count of 1, but fail here.
- Departure from the plan:
  - The plan's mocked auth was not needed. The publish tests extend the existing `strength-actions.test.ts`, which already logs in through a real session against `freshDb()`.
  - The plan's `onChanged` → `router.refresh` test already existed, so I did not write it again.
  - The two Verlauf/Summenverlauf tests in `StrengthPanel.test.tsx` go beyond the plan (review should-fix).
