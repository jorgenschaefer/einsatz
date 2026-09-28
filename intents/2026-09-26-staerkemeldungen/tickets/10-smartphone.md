---
solution:  02-SOLUTION.md
satisfies: AC-15
after:     01-stellen, 02-meldung-erfassen, 03-summe-und-gesamtstaerke, 04-verlauf-der-stelle, 05-summenverlauf, 06-meldung-korrigieren, 07-meldung-annullieren
status:    done
attempts:  1
---

## Build
Prove, and fix where needed, that every Stärke action works at 360 px width without horizontal scrolling.

## Done when
> **AC-15** AC-1 bis AC-13 lassen sich bei 360 px Breite vollständig bedienen, ohne waagerecht zu scrollen.

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
run-einsatz at 360×740: walk AC-1 … AC-13 (create, rename, report,
unverändert, sum, Gesamtstärke, Verlauf, Summenverlauf, correct, annul) and assert
`document.documentElement.scrollWidth <= 360` on each screen; fix any overflow
(`wrap`, `minWidth: 0`) found, with a jsdom test where a fix is a structural change.
Screenshots in the ticket record. `npm run check`.

## Record

**Criterion → evidence (AC-15)**

Layout can't be measured in jsdom, so the 360 px check is a browser walk (run-einsatz, `TOUCH=1`, viewport 360×740). On every screen I measured `document.documentElement.scrollWidth`, the `scrollWidth`/`clientWidth` of `.strength-pane` and `.etb-pane`, and every visible element whose box ends past 360 px or starts before 0. Measuring the panes matters: they are `overflow: auto`, so an overflowing child scrolls the pane sideways while the document itself stays at 360. The plan's `documentElement.scrollWidth <= 360` alone would have missed every overflow below.

Test data: realistic values (2/6/25//33, 12/40/250//302 +50) and worst cases: 4-digit counts in every field, a long multi-word Stelle name, a 50-character Stelle name with no break point, long notes.

Walked:
- AC-1 create (duplicate error included)
- AC-2 rename (duplicate error included)
- AC-3 report form
- AC-4 „Unverändert melden"
- AC-5 the ETB entries
- AC-6 cards
- AC-7/8 Summe
- AC-9 Verlauf with „⋯" menu
- AC-10 Summenverlauf
- AC-11 correction form, opened from the last of 12 Verlauf rows
- AC-12 annul confirmation and the struck-through ETB entry
- AC-13 „Gesamtstärke melden" and annulling its entry from the ETB „⋯" menu

After the fixes, every screen measured 360/360 with no element outside it and no console errors. The dev-only hydration warning on ETB inputs is from before this ticket and unrelated. The review subagent independently repeated the walk with its own worst-case data and found no overflow.

Screenshots: `10-smartphone/01-…10-….png` (after), `10-smartphone/vorher-01…03-….png` (defects found).

**Defects found and fixed**, with the test that pins each, where one exists:

1. **Report form header squashed „Zurück" to „Z" for a long Stelle name** (`vorher-01`). Fix: `flex="none"` on the button and `miw={0}` on the title. CSS only, browser-verified.
2. **Stelle card overflowed with a name that has no break point** (`vorher-02`): the ✎ button ended at 470 px. Fix: `miw={0}` plus `overflow-wrap: anywhere` on the card title, and `overflow-wrap: break-word` on the whole Stärke pane. CSS only, browser-verified.
3. **Verlauf table overflowed** (`vorher-03`, 425 px). The Notiz column squeezed the table. `overflow-wrap: anywhere` broke numbers mid-digit, and without it the table's minimum width exceeded 328 px even with realistic values. Fix (structural): the Notiz moved out of its own column into a full-width row under its report, with no border between them. Now even 4-digit values fit. Pinned by `src/strength/StrengthPanel.test.tsx` › „the Verlauf of a Stelle":
   - „lists every valid report newest first, with time, all values and its note below"
   - „leaves out annulled reports"
   - „shows a report arriving live while it is open"
4. **Annul modal title pushed the ✕ off-screen** (423 px) for a name with no break point. Fix: `minWidth: 0; overflow-wrap: anywhere` on the modal title. CSS only, browser-verified.
5. **An ETB entry with a long unbroken word overflowed the ETB pane** (395 px, the struck-through Stärkemeldung of that Stelle). Fix: `overflow-wrap: break-word` on the ETB list (`JournalPanel.tsx`). This applies to all ETB entries, not only Stärke ones. CSS only, browser-verified.
6. **Create/rename errors appeared out of sight.** They went to the Alert at the top of the pane, measured at y = −230 when renaming far down the list, so on the phone „Speichern" seemed to do nothing. Fix: the name form shows its own error at the field (`role="alert"`, linked by `aria-describedby`). Pinned by `StrengthPanel.test.tsx`:
   - „creating a Stelle › shows a returned error at the field and keeps the typed name"
   - „… › shows a failed save as an error at the field"
   - „renaming a Stelle › shows a returned error at the field and keeps it open"
7. **Korrigieren from a low Verlauf row could leave the form off-screen** (review round 1; the reviewer measured y = −258 with 10 rows). Fix: the correction form focuses its „Stelle" field, which scrolls it into view. The Verlauf menu gets `returnFocus={false}`, so Mantine doesn't pull the focus back to „⋯". Pinned by „correcting a report › moves the focus to the correction, which may start above the tapped row". In the browser, from the last of 12 rows, the select was focused at y = 113.
8. **Annul errors appeared out of sight, and the modal closed anyway** (review rounds 1 and 2). Stärke Verlauf and ETB alike: a failed annulment closed the modal and put the error at the top of the list, so the row just stayed valid. Fix: on failure the confirmation stays open and shows the error inside it. On success it closes as before. This changes the behaviour tickets 07 and ETB had pinned („closes the confirmation … when annulling is rejected"). Pinned by:
   - `StrengthPanel.test.tsx` › „annulling a report": „shows a returned error in the still open confirmation", „shows a failed annulment in the still open confirmation", „opens the next confirmation without the previous error"
   - `src/app/operations/[id]/JournalPanel.test.tsx`: „surfaces a save error in the still open confirmation when annulling fails", „shows the reason in the still open confirmation when annulling is rejected", „opens the next confirmation without the previous error"

**TDD:** each test above was red first, on the assertion, before its code. Both „opens the next confirmation without the previous error" tests were written after the reviewer spotted the untested reset. The StrengthPanel one was proven red by temporarily removing `setAnnulError(null)`; the JournalPanel one was red against the old closing behaviour. The CSS-only fixes (1, 2, 4, 5) have no automated guard: jsdom has no layout, and the project has no browser test runner. The failing browser measurement was their red, and the same measurement going green was their green.

**Command:** `docker compose -f docker-compose.test.yml up -d && npm run check`. Green: tsc, biome, vitest 113 files / 1036 tests.

**Left standing**

- **The CSS fixes are unguarded** (see TDD). Removing `miw={0}` or an `overflowWrap` would bring an overflow back with every test green. A guard would need a browser test runner, which the project doesn't have. Adding one is outside this ticket.
- **Two review nits I did not take:**
  - The note row's `colSpan={5}` is a literal tied to the four `StrengthHeads` columns plus the menu column. Deriving it would add indirection for a table that has one shape.
  - The new comments are German. They follow the convention of `StrengthPanel.tsx`/`JournalPanel.tsx` (as in tickets 04/05).
- **Review rounds:** two rounds ran. The fixes after round 2 (item 8 for the ETB, and the reset test) were not reviewed a third time.
- **Not addressed, outside AC-15's wording:** after „Gesamtstärke melden" the Stärke view gives no feedback beyond the button's loading state (ticket 03's note). On a phone a double tap can write two entries; the second can be annulled in the ETB. No criterion asks for feedback.
- **Extreme values:** the Summenverlauf and the Summe were checked with 4-digit per-field values (5-digit sums). Sums past 5 digits per field weren't tried; they would need several Stellen near the 9999 input limit.
- **Real devices not tried:** the walk used headless Chromium with touch emulation. Not checked on a real phone: whether `inputMode="numeric"` brings up the digit keypad, iOS Safari behaviour, and whether autofocusing the correction's `<select>` opens anything on iOS.
- **Departures from the plan:**
  - Pane measurement in addition to `documentElement.scrollWidth` (see above).
  - The Verlauf restructure (Notiz as its own row) instead of a pure `wrap`/`minWidth: 0` fix.
  - The error-placement fixes (6–8) and the ETB `overflow-wrap` (5), which the plan didn't name. I counted them as „vollständig bedienen" at 360 px.
