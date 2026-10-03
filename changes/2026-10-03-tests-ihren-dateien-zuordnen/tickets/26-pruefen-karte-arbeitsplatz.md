---
criteria:  CRITERIA.md
closes:    
advances:  AC-3, AC-11, AC-12
after:     16-arbeitsplatz-main-view, 23-pruefungen
status:    ready
attempts:  0
---

## Build
The review that every test tests its own file, for the test files in
`src/map/` - the components (`.tsx`) and hooks (`use*.ts`), except `SituationMap.tsx` and `ReadOnlySituationMap.tsx`:
each test file whose source or test imports another project module is
read test by test against what its own file implements, and a test of
another file's behaviour is moved to that file's test file or dropped as
a duplicate.

## Done when
Toward AC-3: in `src/map/` - the components (`.tsx`) and hooks (`use*.ts`), except `SituationMap.tsx` and `ReadOnlySituationMap.tsx`, every test tests behaviour implemented in its own
file; the verdict per test file is in Left standing.

Toward AC-11: each commit that moves or drops tests carries the record
described under Context.

Toward AC-12: a coupling restructured so a file can be tested on its own
leaves the app behaving as before.

## Toward
> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Pairing by name (ticket 23's check) does not show the failure AC-3 is
  about: a test file named after its source whose tests exercise another
  file - as `SituationWorkspace.areas.test.tsx` tested `useAreaFlows`
  before this change while importing only its own fixtures. Reading the
  tests shows it.
- Which test files to read (one rule for tickets 26-31): a test file
  `X.test.*` in the area that is not listed in `ac3-reviewed.txt` in this
  change's directory - the files listed there were written or read test by
  test by an earlier ticket of this change and count as judged - and
  that reaches another project file: `X` or the test file imports (not
  type-only) a project module other than `X`, or reads another project
  file at run time (`readFile`, `?raw`; for example
  `src/map/lageansicht-sizes.test.ts` reads `situation-workspace.css`).
  Importing a fixture (`*.fixtures.*`) or a `src/test/` file is not by
  itself a reason; what that file imports in turn is. A test file that
  reaches no other project file can only exercise its own. Each area
  belongs to one ticket, so no test file is read twice.
- Decided here, reused by tickets 27-31: the selection is a script,
  `select-tests.mjs` in this change's directory (beside
  `compare-coverage.mjs`, deleted with the change). It takes include and
  exclude glob patterns over the tracked test files (`git ls-files`),
  leaves out the paths in `ac3-reviewed.txt`, and prints the test files the
  rule selects. It follows `import`/`export ... from` and dynamic
  `import()` over several lines, resolves `@/` and relative paths, ignores
  `import type`, looks one level into imported fixtures and `src/test/`
  files, and treats `readFile`/`readFileSync` of a project path and `?raw`
  imports as reaching that file.
- In `src/map/` - the components (`.tsx`) and hooks (`use*.ts`), except `SituationMap.tsx` and `ReadOnlySituationMap.tsx`, for orientation:
  `SituationWorkspace`, `SituationMapView`, `LageansichtShell`, the map
  panels and modals, `DeviceView`, `ViewLinkView`, the `use*` hooks
  (`useMapSearch.test.ts` → `search`), and leaf components such as
  `ModeBand`, `MapPanelSwitch`, `PanelRow`, `QuickSelectToolbar` whose tests
  might still render through a workspace fixture.
- A test belongs to its own file when the behaviour is that file's: what
  it decides, shows, calls or passes down, and how it combines other files
  (wiring). Other files running in the test is fine - the file's real
  children and hooks, a harness, fixtures, fakes; the assertions decide.
  An import used to set up state or read it back is a fixture. A test
  whose assertions check only another file's behaviour belongs to that
  file (AC-3).
- A test that moves follows the same record as before (AC-11): the commit
  body has a section `Removed tests:` with one line per removed test,
  `- <old file> › <describe> › <it>` followed by either `→ <new file> ›
  <it>` or `→ gone: <why>; broke <behaviour> by hand, <test that failed>
  failed`. Before committing, run `npm run test:coverage` and
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/compare-coverage.mjs`;
  it must name no file at all - a test moved away can drop the coverage
  of a file this ticket never opened. Fixtures and `src/test/` helpers
  count too: code in them that no test uses any more is deleted, and
  helper code moved to another file gets an entry in
  `coverage-splits.json`.
- More than a handful of tests to move out of one test file means a slice
  was missed: halt the ticket naming the file and the tests, rather than
  leaving them in place.

## Plan
1. Write the selection script as under Context and run it for `src/map/` - the components (`.tsx`) and hooks (`use*.ts`), except `SituationMap.tsx` and `ReadOnlySituationMap.tsx`.
   Proof: on hand-made files it selects a test whose fixture imports
   another module and a test that reads another file at run time, skips a
   test whose only import is a fixture that imports nothing else, and
   skips a test listed in `ac3-reviewed.txt`; then the list in Left
   standing.
2. For each, hold every test against its own file. Proof: the verdict per
   file in Left standing ("all its own", or the tests that moved).
3. Move each misplaced test to the file whose behaviour it checks (or drop
   it where that file's test pins it, with the by-hand check), with the
   record. Proof: `npm run check` green; the coverage comparison names no
   file.

## Not here
- The other areas: `src/map/` - `SituationMap.tsx`, `ReadOnlySituationMap.tsx` and the `.ts` modules other than `use*.ts` (ticket 27); `src/journal/`, `src/strength/`, `src/kml/`, `src/test/` and the test files directly under `src/` or at the repository root (ticket 28); `src/server/` (ticket 29); `src/app/operations/` (ticket 30); `src/app/` outside `src/app/operations/` (ticket 31).
- From `CRITERIA.md`'s Out of scope: any change of behaviour - a test that
  cannot reach another file's behaviour without this one is a coupling to
  restructure in a commit of its own, not a reason to change what the
  code does.

## Left standing
