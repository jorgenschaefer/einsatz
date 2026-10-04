---
criteria:  CRITERIA.md
closes:    
advances:  AC-3, AC-11, AC-12
after:     16-arbeitsplatz-main-view, 23-pruefungen, 32-read-only-situation-map
status:    ready
attempts:  1
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
  `compare-coverage.mjs`, deleted with the change), built by the first
  attempt of this ticket (`e18375d`). It takes include and
  exclude glob patterns over the tracked test files (`git ls-files`),
  leaves out the paths in `ac3-reviewed.txt`, and prints the test files the
  rule selects. It follows `import`/`export ... from` and dynamic
  `import()` over several lines, resolves `@/` and relative paths, ignores
  `import type`, looks one level into imported fixtures and `src/test/`
  files, and treats `readFile`/`readFileSync` of a project path and `?raw`
  imports as reaching that file. `src/test/render.tsx` is a harness: it
  only wraps a component in the app's providers, so what it imports is no
  reason.
- In `src/map/` - the components (`.tsx`) and hooks (`use*.ts`), except `SituationMap.tsx` and `ReadOnlySituationMap.tsx`, for orientation:
  `SituationWorkspace`, `SituationMapView`, `LageansichtShell`, the map
  panels and modals, `DeviceView`, `ViewLinkView`, the `use*` hooks
  (`useMapSearch.test.ts` → `search`), and leaf components such as
  `ModeBand`, `MapPanelSwitch`, `PanelRow`, `QuickSelectToolbar` whose tests
  might still render through a workspace fixture.
- Known from the first attempt (see "Halt, first attempt"):
  - `ReadOnlySituationMap`'s tests in `ViewLinkView.test.tsx` and
    `DeviceView.test.tsx` were moved or dropped by ticket 32; read what
    is left of both files as for any other.
  - `useClipboardCopy.ts` (43, no test) gets `useClipboardCopy.test.ts`
    here, from the two `DeviceLinkPanel.test.tsx` tests of its behaviour:
    "resets the copy button label back to 'kopieren' after a delay" and
    "does not confirm 'kopiert' and hints instead in the panel when the
    clipboard API is unavailable". Keep in `DeviceLinkPanel.test.tsx` only
    what the panel does with the hook's state.
  - `MapModeBands.tsx` and `MapPanelSheet.tsx` have no test file; their
    behaviour is tested in `SituationMapView.test.tsx` (the band tests,
    "closes with Schließen on a phone, and offers none on the desktop"),
    which ticket 15 judged. Nothing to do here.
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
- More than a handful of tests to move out of one test file means a slice
  was missed: halt the ticket naming the file and the tests, rather than
  leaving them in place.

## Plan
1. Run the selection script (built by the first attempt) for `src/map/` -
   the components (`.tsx`) and hooks (`use*.ts`), except
   `SituationMap.tsx` and `ReadOnlySituationMap.tsx`:
   `node changes/2026-10-03-tests-ihren-dateien-zuordnen/select-tests.mjs 'src/map/*.test.tsx' 'src/map/use*.test.ts' --exclude src/map/SituationMap.test.tsx src/map/ReadOnlySituationMap.test.tsx`.
   Proof: the list in Left standing.
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

## Halt, first attempt
Resolved by the re-plan: ticket 32 gives `ReadOnlySituationMap` its own
test file, ticket 33 does the same for `image-overlay-uploads.ts` (the
same gap, found while re-planning), and the selection script treats
`src/test/render.tsx` as a harness, which narrows this area to 16 files.
Kept for the record.

**Kind: blocked.** Under Context, more than a handful of tests to move out
of one test file means a slice was missed, and the ticket must halt. That
is the case for two files here. They have the same cause:
`ReadOnlySituationMap.tsx` has no test file. Everything it decides is
tested through `ViewLinkView.test.tsx` and `DeviceView.test.tsx`, twice
over. It decides the symbols on the map, the staleness clock, search, the
address marker, the live stream with its refresh and connection-lost
badge, and whether the Zurück-zum-Standard-Ausschnitt button is enabled.
`ViewLinkView.tsx` is 26 lines. Its own behaviour is the `/view` base
path, the tap handler and the `useMapFocus` wiring. The ticket assumed
every file in the area already had a test file to take its tests.
`ReadOnlySituationMap` does not, and its file belongs to ticket 27 (Not
here).

Tests in `src/map/ViewLinkView.test.tsx` whose assertions check only
`ReadOnlySituationMap` (or the zoom rule `SituationMap` owns):
- ViewLinkView › renders the operation symbols read-only
- ViewLinkView › centers on a tapped symbol at zoom $expected from zoom $current (2 rows; the zoom rule is `SituationMap`'s)
- ViewLinkView › marks a chosen address on the map
- ViewLinkView › searches placed objects and jumps to a chosen Kartenzeichen
- ViewLinkView › grays a device symbol that goes stale while the view stays open
- ViewLinkView › shows a connection-lost hint when the live stream is disconnected
- ViewLinkView › reloads the full state when a live event arrives
- ViewLinkView › disables the return-to-default button when no default view is set

Its own tests: "omits location, wipe-lock and locate controls", "centers on
a tapped symbol instead of opening a map app", "listens to the live stream
of its token route", "searches addresses through its token route" and
"returns the map to the operation's default view".

Tests in `src/map/DeviceView.test.tsx` of the same behaviour. Each one
duplicates one of the tests above:
- DeviceView › renders the operation symbols read-only, without editing controls
- DeviceView › grays a device symbol that goes stale while the device view stays open
- DeviceView › searches placed objects and jumps to a chosen Kartenzeichen
- DeviceView › marks a chosen address on the map
- DeviceView › searches addresses through the injected geocoder and jumps to a hit
- DeviceView › shows a connection-lost hint when the live stream is disconnected
- DeviceView › reloads the full state when a live event arrives
- DeviceView › disables the return-to-default button when no default view is set
- DeviceView › centers on the own position at zoom $expected from zoom $current (2 rows; the zoom rule is `SituationMap`'s, and "centers the map on the device's own position" holds the jump)

What a re-plan needs to decide: a slice that gives `ReadOnlySituationMap`
its own `ReadOnlySituationMap.test.tsx`, built from the tests above and
added to `ac3-reviewed.txt`. It should come before this ticket and before
ticket 27, and it settles which ticket owns that file.

Found on the way, for the retry. Neither needs a halt by itself:
- `useClipboardCopy.ts` has no test file. Its 2-second reset and its
  "failed" state are tested only through `DeviceLinkPanel.test.tsx`
  ("resets the copy button label back to 'kopieren' after a delay", "does
  not confirm 'kopiert' and hints instead in the panel when the clipboard
  API is unavailable"). That is two tests, so they can move to a new
  `useClipboardCopy.test.ts` inside this ticket.
- `MapModeBands.tsx` and `MapPanelSheet.tsx` have no test file either.
  Nothing selects them, so the retry has to check where their tests live.
- I read only these selected files: `ViewLinkView.test.tsx`,
  `DeviceView.test.tsx`, plus the test names of `LageansichtShell`,
  `SymbolDetailModal`, `AreaEditorModal` and `DeviceLinkPanel`. I gave no
  verdict for the others.

Plan step 1 is built but not committed. It is in the working tree as
`changes/2026-10-03-tests-ihren-dateien-zuordnen/select-tests.mjs`, with
`select-tests.test.mjs` (`node --test`, 22 hand-made cases, all green). The
cases cover each case the plan names: a fixture that imports another
module, a run-time `readFileSync`, `new URL(...)` and `?raw`, a fixture
that imports nothing else, and a file listed in `ac3-reviewed.txt`. For
this area,
`node changes/2026-10-03-tests-ihren-dateien-zuordnen/select-tests.mjs 'src/map/*.test.tsx' 'src/map/use*.test.ts' --exclude src/map/SituationMap.test.tsx src/map/ReadOnlySituationMap.test.tsx`
selects 26 files: AdvancedSymbolForm, AreaEditor, AreaEditorModal,
AreasPanel, DeviceClosed, DeviceLinkPanel, DeviceView, ImageOverlayEditor,
LageansichtShell, MainViewBar, MapControls, MapPanelSwitch, ModeBand,
PanelRow, QuickSelectToolbar, SearchBar, SymbolDetailModal, SymbolsPanel,
ViewLinkView, WipeLock, useDeviceLocation, useIsDesktop, useKeyboardOpen,
useMapSearch, useOperationEvents and useStalenessClock. Almost every
component test is selected because `src/test/render.tsx` imports
`@/app/theme` and `@/app/ActionNotifications`, and the rule counts that.
`npm run check` was not run, because no file it checks has changed.

