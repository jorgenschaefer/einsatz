---
criteria:  CRITERIA.md
closes:
advances:  AC-3, AC-9, AC-11
after:     12-situation-map-leaflet
status:    ready
attempts:  0
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
> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`. Another file of the project appears in it only as a harness around `X` (rendering `X` or providing context for it) or as a fixture or fake.

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
