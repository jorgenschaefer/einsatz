---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11
after:     15-situation-map-view
status:    ready
attempts:  0
---

## Build
`useMainView` gets its own test file, `SituationWorkspace.test.tsx` keeps
only the workspace's own wiring, the last tests of the Lageansicht's topic
files move to the file they test, and every
`SituationWorkspace.<topic>.test.tsx` is deleted.

## Done when
Toward AC-1 and AC-2: no `src/map/SituationWorkspace.<topic>.test.tsx`
exists; `SituationWorkspace.tsx` has exactly one test file.

Toward AC-3: `src/map/useMainView.test.ts` (new) tests `useMainView`
directly; `SituationWorkspace.test.tsx` holds only tests of what
`SituationWorkspace.tsx` itself does or wires together.

Toward AC-9: `SituationWorkspace.test.tsx` (569 lines) and
`useMainView.test.ts` are under 500 lines.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-2** No source file has more than one test file. A source file may have none.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

## Nudges
> `src/map/SituationWorkspace.test.tsx` keeps the tests of the workspace's own wiring.

> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Keep `browserTestsInTs` in `vitest.config.mts` in step with renamed test files.

> Every jsdom test file costs about 3 s of setup; watch the runtime of `npm test` as test files multiply.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- `SituationWorkspace.tsx` (229) itself: the live-event hook whose callback
  refreshes the router; closing the Lageansicht notifications on unmount;
  `useMainView`; `useStalenessClock` → `now`; `mapRef`; `refreshingAfter`
  (router refresh after a successful upload, built with `uploads.ts`);
  `saveDefaultView` (`MAP_LOADING` without a map);
  `setDefaultViewDisabled={!mapShown}`; `MainViewBar` rendered twice (shell
  navigation and `.sidebar-bar`); `data-layout="unknown"` while
  `isDesktop === null`; the ETB and Stärke panes kept mounted and hidden
  with `display: none`.
- `useMainView.ts` (106, no test) takes `{ journalEntries, currentUsername }`
  and reads `matchMedia` (`useIsDesktop`) and `visualViewport`
  (`useKeyboardOpen`): `renderHook` with `stubMatchMedia` /
  `stubVisualViewport` from `src/test/`. To test the cursor in the ETB,
  attach `newEntryRef` to a real textarea. A test without `stubMatchMedia`
  runs as a phone (`src/test/setup.ts`).
- What goes where (tickets 13-15 have taken theirs):
  - `useMainView.test.ts`: from `SituationWorkspace.test.tsx` the counting
    of new ETB entries (describe.each, partly duplicating `MainViewBar.test`
    L41-62), starting on the ETB on phone and desktop, keeping the main view
    across 768 px, the cursor in the ETB (L453-498); from `panels` no sheet
    at start on a phone, the desktop sidebar describe (except "switches the
    sidebar with its own bar", which is workspace wiring), switching and
    closing sheets, the sheet open across ETB/Stärke, the crossing-768 px
    describe, the panel switch not under ETB/Stärke, the on-screen keyboard
    describe; from `modes` which main view hides the map (L78, L86 and the
    rest of that kind); from `phone-sheet` the desktop case (the sheet stays
    open); from `areas` L288 and the `mapShown` side of L441/L449; from
    `map-view` setting the default view disabled or usable per view (L112)
    and with a sheet open on a phone (L136), where the decision is
    `useMainView`'s.
  - `SituationWorkspace.test.tsx` keeps: the Stärke pane hidden/shown, a
    half-filled Stärkemeldung and an ETB entry surviving view switches (the
    panes stay mounted), not recreating the map, the server-rendered
    `data-layout="unknown"`, reloading on a live event, `MainViewBar` twice,
    "working beside the Lagekarte", and takes: `saveDefaultView` (map-view
    L35, L92), the uploads wiring (`uploads` L43, L58, L98, L118; layers
    L238), closing the Lageansicht notifications on unmount
    (`notifications` L46, L56), going stale while the view stays open
    (symbols L452).
  - `SituationMapView.test.tsx`: `addImage` before the map has loaded
    (`uploads` L75).
  - `LageansichtShell.test.tsx` (385): the phone bar hidden while the
    keyboard is open (`SituationWorkspace.test` L430; no Shell test has it).
  - `KmlPanel` and `ViewLinkPanel` tests (one file each since ticket 11):
    KML-Ebenen notifications surviving the panel unmounting
    (`notifications`, 4 tests) and the Ansichtslinks notification (L134), or
    dropped where their merged tests already pin them.
  - Duplicates to drop (break by hand to confirm): the Stärke tests at
    `SituationWorkspace.test` L177-311 (`StrengthPanel` tests), "shows the
    latest ETB entry" and "adds an entry" (`JournalPanel` tests), the
    operation name in the header (L26) and the connection-lost symbol
    (L544) (`LageansichtShell.test` L48, L370), map-view L59 and the
    confirm dialog (`LageansichtShell.test`), the panel switch offers
    (`MapPanelSwitch.test`), "no panel button among the Kartenknöpfe"
    (`MapControls.test`), layers L308 (`uploads.test` L126), the
    near-duplicate "does not recreate the map" in `panels` L453.
- Removing or merging tests (AC-11): the commit body has a section
  `Removed tests:` with one line per removed test, `- <old file> ›
  <describe> › <it>` followed by either `→ <new file> › <it>` or `→ gone:
  <why>; broke <behaviour> by hand, <test that failed> failed`. A test moved
  into another file counts as removed from its old file. Before committing,
  run `npm run test:coverage` and
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/compare-coverage.mjs`;
  it must name no file at all - a test moved away can drop the coverage
  of a file this ticket never opened. Fixtures and `src/test/` helpers
  count too: code in them that no test uses any more is deleted, and
  helper code moved to another file gets an entry in
  `coverage-splits.json`.
- AC-3 review list: add a test file to `ac3-reviewed.txt` in this change's
  directory (one path per line, in the same commit) only if this ticket
  created it, or held every test in it against its own file - say which in
  Left standing. A test file this ticket only edited (added helper calls,
  moved some tests in or out) is not listed: the review tickets 26-31 read
  it. A file listed here is skipped by them and judged only here.

## Plan
1. `src/map/useMainView.test.ts` (new) with the cases listed for it.
   Proof: green; make `selectMapPanel` toggle on the desktop too by hand and
   see the desktop sidebar tests fail; restore.
2. Move the workspace cases from the topic files into
   `SituationWorkspace.test.tsx`, drop its duplicates, shorten. Proof:
   green; `wc -l` under 500.
3. The Shell, KmlPanel, ViewLinkPanel and SituationMapView cases. Proof:
   green.
4. Delete every `SituationWorkspace.<topic>.test.tsx` (each should be empty;
   anything left is moved or recorded first). Proof: `npm run check` green;
   `ls src/map/SituationWorkspace.*.test.tsx` lists nothing (the pattern
   matches only topic files); the coverage comparison names no file.

## Not here
- The JournalPanel and StrengthPanel tests themselves (tickets 17-19).
- No change of behaviour.

## Left standing
