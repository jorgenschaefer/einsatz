---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-3, AC-9, AC-11, AC-12
after:     14-kartenzeichen-bild-overlays
status:    done
attempts:  1
---

## Build
`SituationMapView` gets its own test file, rendered directly with its props
instead of through the workspace, holding what it wires together: the map
mode and its band, ending a mode when the map is hidden, search, jumping
from a panel, the Karte notification closing on a transition, and its panel
attributes. `useMapFocus` gets its own test file. The topic test files whose
remaining tests are all `SituationMapView`'s are deleted.

## Done when
Toward AC-1: `SituationWorkspace.map-notification.test.tsx` and
`SituationWorkspace.search.test.tsx` in `src/map/` are gone.

Toward AC-3: `src/map/SituationMapView.test.tsx` and
`src/map/useMapFocus.test.ts` (new) test their files directly; no test in a
`SituationWorkspace.*` test file checks behaviour `SituationMapView` or
`useMapFocus` implements.

Toward AC-9: `SituationMapView.test.tsx` and every file split off from
`SituationMapView.tsx` are under 500 lines.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

Toward AC-12: if part of `SituationMapView.tsx` is split off, the
Lageansicht behaves as before; only the file boundaries move.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Keep `browserTestsInTs` in `vitest.config.mts` in step with renamed test files.

> Every jsdom test file costs about 3 s of setup; watch the runtime of `npm test` as test files multiply.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- `SituationMapView.tsx` (387, no test) receives from the workspace, as
  plain props: `mapRef`, `isDesktop`, `mapShown`, `shownPanel`,
  `panelSwitchShown`, `onSelectPanel`, `onCloseSheet`, `closeSheetOnPhone`,
  `now`, the map adapter `factory`, plus the actions. It calls
  `useNotifyingActionRunner(SITUATION_MAP)`, `useMapMode({ onTransition:
  closeMapError })`, the private `useEndModeWhenHidden(mapShown,
  mode.endForHiddenMap)` (L381), `useImageOverlayEditing`, `useMapFocus`,
  `useMapSearch`, `useAreaFlows`, `useSymbolPlacement`; owns
  `selectedId`, `jumpFromPanel`, `startEditImage`, `addImage`
  (`MAP_LOADING` without a map), `.map-crosshair`, `data-panel-open`,
  `data-panel-switch`, and passes `onClose` to `MapPanelSheet` only on the
  phone. A test renders it directly with a fixture: props with every action
  a `vi.fn`, the fake factory from `adapter.fixtures.ts`, `createRef()` for
  `mapRef`, spies for the panel callbacks. Panels open by passing
  `shownPanel`; "hidden" is a rerender with `mapShown={false}`.
- Decided here: `src/map/SituationMapView.fixtures.tsx` (new) builds those
  props and renders; it uses `map-objects.fixtures.ts` from ticket 13.
  `useMapFocus.ts` (30, no test) is pure state - `renderHook` directly.
- What moves here (from the `SituationWorkspace.*` tests, after tickets 13
  and 14 took theirs):
  - `map-notification` (254): the Karte notification shown by
    `runMapAction`, closed on every mode transition (one case per kind of
    transition, not per hook), kept when the map moves, the panel changes,
    the map is hidden on a phone; "a circle deleted elsewhere" belongs in
    `useAreaFlows.test.ts` (or is a duplicate of `useMapMode.test` L172).
    Then delete the file.
  - `modes` (248): the band display (L17, L29, L37, L188), ending a mode
    when the map is hidden (L51, L67, the desktop describe, L194 - as
    rerenders with `mapShown={false}`). Which main view hides the map
    (L78, L86 and the "which view" part of the others) is `useMainView`'s,
    ticket 16. L206 and L219 are duplicates (`SituationMap.test`,
    `useMapMode.test` L32).
  - `search` (265): all, split between `SituationMapView.test.tsx` (search
    state survives panels, placing, the ETB on a phone; choosing an object
    jumps) and `useMapFocus.test.ts` (`zoomInOnly`); drop the duplicates of
    `useMapSearch.test`, `SearchBar.test` and `SituationMap.test`. Then
    delete the file.
  - `map-view`: jumping from a panel (describe.each), `data-panel-open`
    (L173), zooming out to the default and again on a repeat click (L220,
    L250 → `useMapFocus.test.ts`); L159 and L240 are `MapControls.test`
    duplicates. The workspace parts stay for ticket 16.
  - `panels`: `data-panel-switch`, no Schließen on the desktop,
    `data-panel-open` (L357).
  - `phone-sheet`: `jumpFromPanel` (both cases) and `startEditImage` call
    `closeSheetOnPhone`.
  - `areas`: opening the editor from the row and deleting (L107), centring
    from the row (L134), Abbrechen in the band (L406), the "moving ends when
    the map is hidden" side of L441/L449.
  - `symbols`: centring from the row (L243), the detail from the row
    (L267), no earlier save error after the Kartenzeichen vanished (L394).
  - `layers`: the band and Fertig (L177), editing continues across panel
    switches (L190).
- If `SituationMapView.test.tsx` goes over 500 lines after shortening, the
  seam is `useEndModeWhenHidden` into its own file with its tests, in a
  commit of its own, with an entry in `coverage-splits.json` in this
  change's directory.
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
1. `src/map/SituationMapView.fixtures.tsx` and `src/map/SituationMapView.test.tsx`
   (new) with the band and the hidden-map cases from `modes`. Proof: green;
   remove the `useEndModeWhenHidden` call by hand and see them fail;
   restore.
2. The notification cases from `map-notification`; delete it. Proof: green.
3. `src/map/useMapFocus.test.ts` (new) and the search cases; delete
   `search`. Proof: green.
4. The remaining cases listed from `map-view`, `panels`, `phone-sheet`,
   `areas`, `symbols`, `layers`; drop the duplicates. Proof: green;
   `wc -l` under 500 (split off `useEndModeWhenHidden` if not).
5. Proof: `npm run check` green; the coverage comparison names no file.

## Not here
- `useMainView`, the workspace's own wiring, uploads and notifications, and
  deleting the remaining topic files (ticket 16).
- No change of behaviour.

## Left standing
- **Review findings not fixed.** There were two review rounds. Round 1
  found two should-fix and two nits; round 2 found seven nits. I fixed
  both should-fix and all nits but two:
  - Not fixed (round 2 nit): "offers no Schließen on the panel" stays in
    `SituationWorkspace.panels.test.tsx`, although `SituationMapView.test.tsx`
    pins the Schließen decision too. I disagree with removing it: it is the
    only test of the workspace handing `isDesktop` to `SituationMapView`.
    When the workspace passed `isDesktop={false}`, the whole suite passed
    without it. Ticket 16 can replace it with a test of that wiring.
  - Not fixed (round 2 nit): some `SituationMapView.test.tsx` tests still
    check two related things under one name, joined by "and". Examples:
    "closes with Schließen on a phone, and offers none on the desktop" and
    "shows the panel switch only while asked to, marks the map with it, and
    reports the chosen panel". The file has 498 lines. Splitting further
    would push it over 500, and then a second part of `SituationMapView.tsx`
    would have to move out. The plan names only `useEndModeWhenHidden`.
  - Round 1 nit (handled in the commit record): the phone sheet actually
    closing after a jump or when editing a Bild-Overlay starts is
    `useMainView`'s. Only the layers and uploads workspace tests hold it
    now, and only incidentally, because `openImageEditor` opens Ebenen a
    second time. Ticket 16's `useMainView` tests should pin it directly.
- **Checks not run.** None skipped. After the last edit, `npm run check` is
  green (212 files, 2703 tests). `npm run test:coverage` and then
  `compare-coverage.mjs` exit 0 with no drop. The only new file it names
  from this ticket is `SituationMapView.fixtures.tsx`, which is new harness
  code and not split from a baseline file. `useEndModeWhenHidden.ts` is
  listed in `coverage-splits.json` as a part of `SituationMapView.tsx`. No
  file needed a new test file for coverage. Neither I nor the reviewers
  drove the app: the only production change moves a hook unchanged, and
  nothing on screen changed.
- **Advanced without an automated test.**
  - AC-9: checked with `wc -l`. `SituationMapView.test.tsx` has 498 lines,
    `SituationMapView.fixtures.tsx` 221, `SituationMapView.tsx` 375 and
    `useEndModeWhenHidden.ts` 14.
  - AC-12: `useEndModeWhenHidden` moved word for word, apart from `export`.
    I compared the two versions with `diff`. The call stays at the same
    place in `SituationMapView`, so the order of hooks is unchanged. Both
    reviews confirmed this.
  - AC-11: the commit's `Removed tests:` section comes from
    `removed-tests.mjs` and names all 87 removed tests. For each test
    marked "gone" there, I broke its behaviour by hand and saw the named
    test fail, then restored the code. For the moved tests, I replaced each
    of the 58 props and handlers that `SituationMapView` passes on with a
    no-op, one at a time. Every one made a test in `SituationMapView.test.tsx`
    fail. The first sweep found one exception: passing `movingCircleId` to
    the map. The moving test now checks the circle preview.
  - AC-3: `SituationMapView.test.tsx`, `useMapFocus.test.ts` and
    `useEndModeWhenHidden.test.ts` are added to `ac3-reviewed.txt` because
    this ticket created them. The test files I only edited are not listed:
    the `SituationWorkspace.*` files, `SituationMap.test.tsx`,
    `useAreaFlows.test.ts`, `useSymbolPlacement.test.ts` and
    `useMapSearch.test.ts`.
- **Departures from the plan and Context.**
  - There are two commits. The first moves `useEndModeWhenHidden` into its
    own file, with its test, the `coverage-splits.json` entry and its
    `ac3-reviewed.txt` line. The second moves the tests and carries the
    ticket file. The nudge asks for restructuring in a commit of its own,
    and the run asks for the code and the ticket in one commit. The ticket
    file goes with the commit that finishes the ticket.
  - The split alone was not enough for AC-9. A first full version of the
    test file had 794 lines. It got under 500 by these changes:
    - shared helpers and constants moved into the fixtures;
    - a single table holds every handler `SituationMapView` passes on;
    - the four "hidden map ends the mode" cases became one row, because the
      hook test now holds the rest;
    - related checks were merged into one test.
  - Context listed some tests as duplicates that were not fully held
    elsewhere. Breaking the behaviour by hand showed it, and I added a test
    before dropping each one:
    - The rule that a jump only zooms in (`Math.max` in `SituationMap`) had
      no test of its own. The "at zoom 18" workspace rows were the only
      ones holding it. `SituationMap.test.tsx` now has
      "zooms in to a zoom-in-only focus target, but not out".
    - modes L206 (no placing while a Bild-Overlay is edited): the named
      tests passed when `useSymbolPlacement` armed a composition during
      image editing. `useSymbolPlacement.test.ts` now has "arms nothing
      while another map mode is on".
    - Nothing held the geocoding debounce. The old workspace test did not
      either. `useMapSearch.test.ts` now checks that nothing is geocoded at
      299 ms.
    - map-view L240 (Zurück disabled without a default view) is not only
      `MapControls`': `SituationMapView` decides `canReturnToDefault`. The
      return test in `SituationMapView.test.tsx` checks it.
  - "A circle deleted elsewhere" went into the existing
    `useAreaFlows.test.ts` test, now named "ends moving when the circle
    disappears, keeping the notification of a failed save". It failed when
    the hook ended moving with `mode.reset`.
  - "Keeps the Karte notification standing through an action in the KML
    panel" is gone with a reason, not a holder. Nothing in
    `SituationMapView` connects KML actions to the Karte notification, so
    the test pinned an absence. Closing per source is held by the mirror
    test in `SituationWorkspace.notifications.test.tsx`.
  - The keep cases of the desktop describe and areas L173 ("switching to
    the ETB keeps moving beside the sidebar") went the same way. They are
    held by `useEndModeWhenHidden.test.ts` together with the panels test
    "keeps the Lagekarte visible beside the ETB and Stärke". Breaking
    `useMainView` to hide the map on the desktop made 8 workspace tests
    fail. Context named only one side of L173.
  - The 15 workspace tests that tickets 13 and 14 left for this ticket all
    moved here:
    - the draw hand-off and the busy band;
    - copying;
    - delete, generate and remove device link from the detail;
    - the KML and Bild-Overlays on the map;
    - both visibility toggles;
    - removing a KML-Overlay;
    - a map gesture;
    - deleting a Bild-Overlay;
    - putting a Bild-Overlay back after a failed save;
    - Fertig closing the Bild-Overlays notification.
  - Three wiring tests are new: reloading a KML-URL, adding a Bild-Overlay
    with the map's extent, and `MAP_LOADING` before the map has loaded.
    `SituationWorkspace.uploads.test.tsx` "asks to try again and uploads
    nothing before the map has loaded" still checks `MAP_LOADING` through
    the workspace. That file is ticket 16's.
  - symbols "grays a device symbol that goes stale while the view stays
    open" stays in the workspace, as Context left it. It is now the only
    test that `SituationMapView` recomputes the markers when `now` changes.
- **Departures from a nudge.** None. `browserTestsInTs` already matches
  `src/map/use*.test.ts`. On balance there is one more jsdom file (two
  deleted, three added), and `npm test` took 43 s, the same as before.
