---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-3, AC-9, AC-11, AC-12
after:     14-kartenzeichen-bild-overlays
status:    ready
attempts:  0
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
