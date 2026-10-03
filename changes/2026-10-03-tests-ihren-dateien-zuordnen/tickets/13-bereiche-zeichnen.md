---
criteria:  CRITERIA.md
closes:
advances:  AC-3, AC-9, AC-11
after:     12-situation-map-leaflet
status:    done
attempts:  1
---

## Build
`useAreaFlows` gets its own test file, tested with `renderHook` next to the
real `useMapMode`, and every test in the `SituationWorkspace.*` tests whose
behaviour `useAreaFlows` implements moves there (or is dropped where another
file's test already pins it). The shared hook harness and object fixtures
for the Lageansicht hook tests are built here.

## Done when
Toward AC-3: `src/map/useAreaFlows.test.ts` tests drawing, redrawing,
moving a circle and opening the editor after drawing by driving
`useAreaFlows` directly; no test in a `SituationWorkspace.*` test file
checks behaviour `useAreaFlows` implements.

Toward AC-9: `useAreaFlows.test.ts` is under 500 lines, and
`SituationWorkspace.areas.test.tsx` (738 lines) is left holding only the
tests later tickets move (the `SituationMapView` and `useMainView` wiring
named under Context).

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

## Toward
> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

## Nudges
> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Keep `browserTestsInTs` in `vitest.config.mts` in step with renamed test files.

> Every jsdom test file costs about 3 s of setup; watch the runtime of `npm test` as test files multiply.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- The Lageansicht is `SituationWorkspace.tsx` (229) → `SituationMapView.tsx`
  (387) → hooks. `SituationMapView` calls `useMapMode({ onTransition:
  closeMapError })` and passes `mode`, `runMapAction` (from
  `useNotifyingActionRunner(SITUATION_MAP)`) and `closeSheetOnPhone` into
  `useAreaFlows({ areas, mapRef, mode, runMapAction, closeSheetOnPhone,
  onCreateArea, onUpdateAreaGeometry })` (`src/map/useAreaFlows.ts`, 123
  lines, no test). Today all of its behaviour is tested by rendering the
  whole workspace (`renderWorkspace` from `SituationWorkspace.fixtures.tsx`)
  and driving the fake map adapter (`fakeMapAdapterFactory` in
  `adapter.fixtures.ts`: `captured.options.onMapClick`, the callbacks
  recorded by `adapter.startDrawing`).
- `useAreaFlows`' behaviour (`endMoveCircle`, `reset`, the effect that ends
  moving when the circle disappears) needs the real mode state: compose the
  real `useMapMode` with `useAreaFlows` in one `renderHook` callback rather
  than faking `mode`. `runMapAction` is the real
  `useNotifyingActionRunner(SITUATION_MAP)` with `Providers` from
  `src/test/render.tsx` as the `renderHook` wrapper, so notifications can be
  asserted. `mapRef` is a plain `{ current: { getView, getViewExtent,
  restoreImagePlacement } }`. Tickets 14 and 15 reuse this.
- Decided here: the harness goes in `src/map/map-hooks.fixtures.tsx` (new)
  - a function that renders a given hook next to `useMapMode` and the real
  runner under `Providers`, with `closeSheetOnPhone` as a spy - and the
  object fixtures `AREA`, `SYMBOL` and `anImageOverlay` move from
  `SituationWorkspace.fixtures.tsx` into `src/map/map-objects.fixtures.ts`
  (new), imported back by `SituationWorkspace.fixtures.tsx`. Hook tests are
  `.ts` and match `src/map/use*.test.ts` in `browserTestsInTs`; the harness
  file is `.tsx` because it renders `Providers`.
- What moves here, from `SituationWorkspace.areas.test.tsx` (738):
  drawing (L23), a draw error surfaced and the mode still ended (L51), error
  on redraw (L74), redraw replaces the geometry (L680); the "moving a
  circle" describe's Verschieben start (L265), Hier setzen (L295), second
  tap (L324), failed and thrown save (L362, L392), circle disappears (L422);
  the whole "opening the area editor after drawing" describe (L460-) except
  L610 (that is `AreaEditorModal`'s, a duplicate of its test L122). From
  `SituationWorkspace.phone-sheet.test.tsx`: `toggleAreaDraw` and
  `startRedraw` call `closeSheetOnPhone`, toggling the shape off does not.
  From `SituationWorkspace.map-actions.test.tsx`: the drawing, redrawing and
  moving-a-circle rows of its it.each (the Karte notification).
- Duplicates to drop (confirm by breaking the behaviour by hand): L159 no
  click handler (`SituationMap.test`), L714 arming Linie/Kreis
  (`AreasPanel.test` L56, `SituationMap.test`), L729 toggling the shape off
  cancels (`useMapMode.test` L49), L242 Verschieben only for circles
  (`AreaEditorModal.test` L159-175), L348 and L432 (`useMapMode.test`
  L117, L102), the restore of L362 and the busy band of L324
  (`SituationMap.test`, `ModeBand.test`).
- Leave for later tickets: L107 (opening the editor from the row and
  deleting), L134 (centring from the row), L406 (Abbrechen in the band) -
  `SituationMapView` wiring, ticket 15; L288 (panel stays open on desktop)
  and L441/L449 (switching to the ETB ends moving) - `useMainView` and
  `SituationMapView`, tickets 15 and 16. Ticket 16 deletes every
  `SituationWorkspace.<topic>.test.tsx` once empty.
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
1. Write `src/map/map-hooks.fixtures.tsx` and `src/map/map-objects.fixtures.ts`
   (new) as decided under Context; `SituationWorkspace.fixtures.tsx` imports
   the objects from the new file; add
   `"src/map/SituationWorkspace.fixtures.tsx": ["src/map/SituationWorkspace.fixtures.tsx", "src/map/map-objects.fixtures.ts"]`
   to `coverage-splits.json`. Proof: every existing test green.
2. `src/map/useAreaFlows.test.ts` (new): drawing and redrawing, including
   the error cases and the Karte notification rows from
   `map-actions.test`; remove them from the workspace tests. Proof: green;
   make `handleDrawComplete` skip `onCreateArea` by hand and see the drawing
   test fail; restore.
3. Moving a circle and the editor after drawing into the same file; the
   phone-sheet calls. Proof: green.
4. Drop the duplicates listed under Context, each with the record. Proof:
   `npm run check` green; `useAreaFlows.test.ts` under 500 lines; the coverage comparison names no file.

## Not here
- `useSymbolPlacement`, `useImageOverlayEditing` (ticket 14);
  `SituationMapView` and `useMapFocus` (ticket 15); `useMainView` and the
  workspace's own wiring (ticket 16).
- Deleting the `SituationWorkspace.<topic>.test.tsx` files (ticket 16).
- No change to `useAreaFlows` unless a test cannot reach a behaviour without
  the workspace - then restructure it, behaviour unchanged, in a commit of
  its own.

## Left standing
- **Review findings not fixed.** There were two review rounds. Round 1
  found two should-fix and three nits. Round 2 found one should-fix and
  one nit. I fixed both should-fix from round 1 and the one from round 2
  (see the departures below), plus the round 2 nit and one round 1 nit
  (the restore test's name). Two round 1 nits are not fixed:
  - Not fixed (nit): moving a circle has a "throws" case in two places in
    `useAreaFlows.test.ts`: the "saves" table and the moving `it.each`.
    The table row stays because it also carries the login-redirect case
    for moving a circle, which no other test has. The table reads as one
    list of the three saves.
  - Not fixed (nit): the reviewer wanted the `succeed` stub in
    `buildProps` (`SituationWorkspace.fixtures.tsx`) in a commit of its
    own. It is part of this commit. The run's instructions ask for one
    commit, and the change is what keeps the coverage comparison clean
    after the moves. Once the redraw workspace tests left, no test
    called the default `onUpdateAreaGeometry` stub. One shared `succeed`
    replaces the 29 copies of `async () => ({})`, so no stub body is
    left uncalled.
- **Checks not run.** None skipped. After the last edit, `npm run check`
  is green (2738 tests). `npm run test:coverage` and then
  `compare-coverage.mjs` exit 0. The script names only new files as
  "new, compared with nothing": the `src/test/` helpers from earlier
  tickets, `leaflet-map.fixtures.ts`, and this ticket's
  `map-hooks.fixtures.tsx`, which is new harness code and not split from
  a baseline file. No file needed a new test file for coverage.
  - Unexplained: the first `npm run check` of this build reported
    `Errors 1 error` with every test passing. Ticket 11 saw the same
    thing. Its output was lost because I only kept the tail. After that,
    four `npm test` runs, five `npm run check` runs and three coverage
    runs were clean, and ten runs of the six changed test files were
    clean too.
- **Advanced without an automated test.**
  - AC-9: checked with `wc -l`. `useAreaFlows.test.ts` has 432 lines,
    `SituationWorkspace.areas.test.tsx` 191 and `SituationMap.test.tsx`
    468.
  - AC-11: the commit's `Removed tests:` section comes from
    `removed-tests.mjs` and names all 33 removed tests. For each test I
    dropped as a duplicate, I broke the behaviour by hand and saw the
    named test fail, then restored the code. For the moved tests, I broke
    each branch of `useAreaFlows.ts` by hand and saw the moved tests
    fail:
    - `onCreateArea` skipped
    - the redraw sent to create
    - no `reset`
    - no `endMoveCircle`, or `endMoveCircle` also after an error
    - `reset` instead of `endMoveCircle`
    - a fixed radius
    - no saving flag
    - no view guard
    - no effect for a disappearing circle
    - the editor opening for any shape, or never
    - the sheet closing on toggle-off, or not on Verschieben
    - the editor kept open on redraw or Verschieben
  - AC-3: I added `src/map/useAreaFlows.test.ts` to `ac3-reviewed.txt`
    because this ticket created it. I also edited `AreasPanel.test.tsx`
    and `SituationMap.test.tsx`, but they are not added:
    `SituationMap.test.tsx` was already listed by ticket 12, and
    `AreasPanel.test.tsx` was only edited.
- **Departures from the plan.**
  - All four steps are in one commit. `useAreaFlows.ts` did not change, so
    there was no restructuring commit to keep apart.
  - Two tests stay in `SituationWorkspace.areas.test.tsx` that Context
    meant to move or drop. Both are now wiring of `SituationMapView`, and
    ticket 15's list does not name them, so **ticket 15 must take them**:
    - "draws a Bereich: arming a shape then completing creates the area"
      (L23). It is the only test that `SituationMapView` hands
      `onDrawComplete` to `areaFlows.handleDrawComplete`. When that prop
      was `async () => {}`, every other test passed.
    - "a second tap while saving does not write again" (L324). Context
      called its busy band a duplicate of `ModeBand.test` and
      `SituationMap.test`. But only this test holds that `SituationMapView`
      passes `circleMoveSaving` and that `MapModeBands` passes it on as
      `busy`. `MapModeBands.tsx` has no test file. When either prop was
      `false`, every other test passed. `setCircleHere` has no guard of
      its own, so the disabled button is the only thing that stops a
      second write.
  - Three duplicates in Context were not fully held by the named tests.
    I strengthened those tests before dropping the workspace tests, and
    each one now fails when its behaviour is broken by hand:
    - `AreasPanel.test.tsx` now clicks all three shapes.
    - `SituationMap.test.tsx` arms a line instead of a polygon.
    - `SituationMap.test.tsx` has a new test, "cancels drawing when the
      shape is disarmed".
    - The `SituationMap.test.tsx` restore test keeps the same `areas`
      array, so it pins `movingCircleId` in the reconcile deps. It is
      renamed "restores the circle when moving ends without a change to
      areas".
  - L348 was listed as a duplicate of `useMapMode.test` L117. That test
    pins only the reducer, so the test moved to `useAreaFlows.test.ts`
    instead. There it pins that `setCircleHere` ends the move with
    `endMoveCircle` and not `reset`. The round 2 review caught this.
  - L265's crosshair assertion moved into the kept "Abbrechen ends moving
    without saving" test, which is SituationMapView wiring for ticket 15.
  - `map-hooks.fixtures.tsx` also exports `aMapRef(view)` for the plain
    `mapRef`, so tickets 14 and 15 can build theirs the same way.
  - The test file has two tests the workspace never had: redraw closes the
    editor, and Hier setzen saves nothing while the map has no view.
- **Departures from a nudge.** None. `browserTestsInTs` already matches
  `src/map/use*.test.ts`. The suite gains one jsdom file of about 1 s.
