---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11, AC-12
after:     01-coverage-ausgangswert
status:    done
attempts:  1
---

## Build
The Stärke panel's six test files are dissolved: the tests of the report
and correction forms, the cards and the histories move to the files that
implement them, `ConfirmationModal` duplicates are dropped, and
`StrengthPanel.test.tsx` keeps the panel's own behaviour.

## Done when
Toward AC-1 and AC-2: no `src/strength/StrengthPanel.<topic>.test.tsx`
exists; `StrengthPanel.tsx`, `ReportForms.tsx`, `StrengthCards.tsx` and
`StrengthHistories.tsx` (and any file split off) have exactly one test file
each.

Toward AC-3: `ReportForms.test.tsx`, `StrengthCards.test.tsx` and
`StrengthHistories.test.tsx` (new) drive their components directly;
`StrengthPanel.test.tsx` holds only the panel's own behaviour.

Toward AC-9: every test file this ticket writes is under 500 lines.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

Toward AC-12: if `NameForm` is split off `StrengthPanel.tsx`, the panel
behaves as before; only file boundaries move.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-2** No source file has more than one test file. A source file may have none.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Every jsdom test file costs about 3 s of setup; watch the runtime of `npm test` as test files multiply.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Sources in `src/strength/`: `StrengthPanel.tsx` (350: view switching,
  `runAction`/`SAVE_ERROR`, `closeIfStillOpen`, `prefillKey`, the annul
  `ConfirmationModal`, a private `NameForm` of ~60 lines for creating and
  renaming a Stelle); `ReportForms.tsx` (242: `ReportForm`,
  `CorrectionForm`, `useStrengthFields`, `valuesOf`); `StrengthCards.tsx`
  (181: `TotalCard` with its own "Gesamtstärke melden" confirmation,
  `StationCard`); `StrengthHistories.tsx` (173: `StationHistory` with the ⋯
  menu Korrigieren/Annullieren, `TotalHistory`); `StrengthFigures.tsx` (11).
  Only `StrengthPanel` has tests; fixtures in `StrengthPanel.fixtures.tsx`
  (81).
- What goes where:
  - `StrengthCards.test.tsx`: "the card of a Stelle" (5 tests in
    `StrengthPanel.test.tsx`: latest report, skipping annulled ones, stale
    highlight, 0 Personen never stale, "noch keine Meldung") → `StationCard`;
    "the sum" from `StrengthPanel.sum.test.tsx` (lines ~18-293: sum, oldest,
    stale, disabled without a valid report, the confirmation and its text)
    → `TotalCard`.
  - `StrengthHistories.test.tsx`: all of `StrengthPanel.history.test.tsx`
    (123) → `StationHistory`; "the Summenverlauf" from `sum` (lines
    ~294-433) → `TotalHistory`; the menu offering Annullieren (`annul`).
  - `ReportForms.test.tsx`: from `report` the zero start, prefill, computed
    G and Gesamtpersonen, replacing prefilled values, 4 digits, no negatives
    or decimals, typed values, emptied → 0, "Unverändert melden"; from
    `correct` the prefill of report and Stelle select, saving values and
    Stelle, cancel.
  - `StrengthPanel.test.tsx`: cards in order, creating and renaming a Stelle
    (8 tests, `NameForm`), opening the form from the card / not from the
    pencil / not while renaming, errors, a late save keeping another form
    open, prefilling afresh on a live arrival or reopening, focus moves,
    keeping a started report, two reports in the same minute, an error
    keeping the correction open, confirm-then-annul, "not shown while a form
    is open".
  - Duplicates to drop: double click, closing dialog, stays open, errors in
    the open dialog, the next dialog without the old error in `annul` and
    `sum` - `ConfirmationModal`'s, pinned by `src/app/ConfirmationModal.test.tsx`.
  - If `StrengthPanel.test.tsx` is still over 500 lines, split `NameForm`
    into `src/strength/NameForm.tsx` with its ~100 test lines, in a commit
    of its own, with the coverage-splits entry in this change's directory.
- Removing or merging tests (AC-11): the commit body has a section
  `Removed tests:` with one line per removed test, `- <old file> ›
  <describe> › <it>` followed by either `→ <new file> › <it>` or `→ gone:
  <why>; broke <behaviour> by hand, <test that failed> failed`. A test moved
  into another file counts as removed from its old file. Before committing,
  run `npm run test:coverage` and
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/compare-coverage.mjs`;
  it must name no file at all - a test moved away can drop the coverage
  of a file this ticket never opened. A file it names that has no test
  file gets one, `X.test.*` next to it, with tests of its own behaviour
  until the comparison is clean; say which in Left standing. Fixtures and
  `src/test/` helpers count too: code in them that no test uses any more
  is deleted, and
  helper code moved to another file gets an entry in
  `coverage-splits.json`.
- Before each commit that touches a test, fixture or `src/test/` file, run
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/removed-tests.mjs`
  (ticket 01). Every name it lists as removed is in the commit's `Removed
  tests:` section; the names it lists as added show where a moved or
  renamed test went.
- AC-3 review list: add a test file to `ac3-reviewed.txt` in this change's
  directory (one path per line, in the same commit) only if this ticket
  created it, or held every test in it against its own file - say which in
  Left standing. A test file this ticket only edited (added helper calls,
  moved some tests in or out) is not listed: the review tickets 26-31 read
  it. A file listed here is skipped by them and judged only here.

## Plan
1. `src/strength/StrengthHistories.test.tsx` (new) with the history cases;
   delete `StrengthPanel.history.test.tsx`. Proof: green; show annulled
   reports in `StationHistory` by hand and see a test fail; restore.
2. `src/strength/StrengthCards.test.tsx` (new) with the card and sum cases;
   drop the `ConfirmationModal` duplicates. Proof: green.
3. `src/strength/ReportForms.test.tsx` (new) with the form cases. Proof:
   green.
4. Gather the panel's own cases into `StrengthPanel.test.tsx`, shorten
   (split `NameForm` only if needed), delete the remaining topic files.
   Proof: `npm run check` green; every file under 500; the coverage comparison names no file.

## Not here
- `src/strength/strength.ts` and `strength.cyclassics.test.ts` (ticket 22).
- The Stärke tests in `SituationWorkspace.test.tsx` (ticket 16).
- From `CRITERIA.md`'s Out of scope: tests for source files that have none
  today, except where the coverage comparison would otherwise name the
  file (see Context) - `StrengthFigures.tsx` gets no test of its own.
- No change of behaviour.

## Left standing
- **Review findings not fixed.** There were two review rounds.
  - Round 1 ended on an interim report, and I could not resume that
    reviewer for a rated final one. I treated its three findings as
    should-fix and fixed them all: `run-action.ts` had no test file; four
    hand-offs of an action's result (create, rename, annul, Gesamtstärke)
    could be swallowed without a test failing; and the focus test
    checked `CorrectionForm`'s `autoFocus` from the panel.
  - Round 1's app run (unrated) found behaviour that predates this
    change, and I left it, because this ticket must not change behaviour:
    - Escape does not close the name form.
    - After a rejected save, the focus is not put back in the name
      field.
    - While a save is pending, the previous error stays visible.
    - At 360 px with five or more Stellen, "+ Stelle" sits half behind
      the bottom tab bar until you scroll.
  - Round 2 had two blockers, which I fixed: a successful annulment
    closing the confirmation, and choosing Korrigieren not handing the
    focus back to ⋯ (`returnFocus={false}`). The old focus test caught
    the second only by timing, because Mantine returns the focus after
    10 ms. In my runs it passed with the break. The new test in
    `StrengthHistories.test.tsx` waits past that and fails reliably.
  - Round 2 also noted an older gap, outside its review, and I left it:
    removing `key={correctingReport.id}` (`StrengthPanel.tsx`) fails no
    test, old or new. Its test would push `StrengthPanel.test.tsx` back
    over 500 lines; it belongs to a later shortening of that file.
- **Older gaps found by breaking code, left.** Showing a stale time in
  bold and red (`ReportTime`'s `fw` and `c`) is pinned only through
  `data-stale`. The old suite did not pin it either.
- **Checks.** `npm run check` passes (204 files, 2674 tests), as do
  `npm run test:coverage` and `compare-coverage.mjs` (exit 0). The
  comparison still names nine files as new, and all of them come from
  earlier tickets (`src/test/*-checks.ts`, `live-*.ts`, `uploads-dir.ts`,
  the map fixtures). No file's coverage dropped. `removed-tests.mjs` ran
  before each commit.
- **Advanced without an automated test.**
  - AC-12 (the `NameForm` split changes no behaviour): I ran the
    pre-change Stärke and `SituationWorkspace` tests (154) against the
    split sources in a separate worktree, and the whole `npm run check`
    there; both were green. Round 1 drove creating and renaming a Stelle,
    including the duplicate-name error, at 360 px and 1920 px.
  - AC-1, AC-2 and AC-9: I counted the files in `src/strength/`, each
    with at most one test file. I measured every test file this ticket
    wrote under 500 lines (the longest is `StrengthPanel.test.tsx` at
    495).
  - AC-11: the commit's `Removed tests:` section. Each "gone" entry
    names the break I made by hand in `ConfirmationModal.tsx` and the
    `ConfirmationModal.test.tsx` test that then failed.
  - AC-3: I broke each decision in `StrengthPanel.tsx`, `NameForm.tsx`,
    `run-action.ts`, `ReportForms.tsx`, `StrengthCards.tsx` and
    `StrengthHistories.tsx` by hand, one at a time, and ran only that
    file's own test file; a test failed each time. That is why all six
    test files went into `ac3-reviewed.txt`: five are new, and I rewrote
    `StrengthPanel.test.tsx` whole and checked every test in it this
    way.
- **Departures from the plan.**
  - Step 4's condition held: still 539 lines after shortening, so
    `NameForm` was split off in a commit of its own. `runAction`, which
    both the form and the panel use, went to `run-action.ts`, so neither
    file imports the other. It got its own `run-action.test.ts` (Node,
    not jsdom). `coverage-splits.json` lists both files as parts of
    `StrengthPanel.tsx`.
  - Some tests went somewhere other than Context's list, where their
    assertions check another file:
    - "two reports of the same minute" went to `StrengthHistories`,
      because the label is built in `StationHistory`.
    - The correction's focus went to `ReportForms` (`autoFocus`) and
      `StrengthHistories` (`returnFocus`).
    - "cannot be opened without a valid report" (Summenverlauf) went to
      `TotalCard`, which disables the button.
    - The Summe's "not shown while a form is open" joined the panel's
      open-the-form test.
  - Besides the listed duplicates, I also dropped both "cancelled
    confirmation" tests, because `ConfirmationModal` › "closes on cancel
    without running the action" pins them. The returned-error tests of
    the Summe and the annulment were not dropped. They became checks
    that `TotalCard` and the panel pass the action's result on.
  - New tests for gaps the breaks turned up, all of them unpinned in the
    old suite:
    - the busy lock of `ReportForm`, `CorrectionForm` and `NameForm`
    - the error cleared on Zurück, on opening a correction and on its
      Abbrechen
    - a late rename leaving another rename open
    - the panel handing on `now` and `onReportTotalStrength`
    - prefilled Führer
- **Nudges.** I shortened the panel test (helpers, merged cases) before
  splitting. `npm test` takes 40.9 s, against 41.3 s before this
  change. The Stärke tests went from six jsdom files to five jsdom
  files and one Node file.
