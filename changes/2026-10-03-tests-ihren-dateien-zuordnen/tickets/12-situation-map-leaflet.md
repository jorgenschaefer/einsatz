---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11, AC-12
after:     01-coverage-ausgangswert
status:    ready
attempts:  0
---

## Build
`SituationMap` and the Leaflet modules each get exactly one test file:
the topic test files of `leaflet-adapter`, `leaflet-areas`,
`leaflet-image-overlays`, `leaflet-kml-overlays`, `leaflet-markers` and
`SituationMap` are merged, tests of behaviour another file implements move
there, and `SituationMap.test.tsx` gets under 500 lines.

## Done when
Toward AC-1 and AC-2: in `src/map/`, no `leaflet-*.<topic>.test.*` and no
`SituationMap.search-hit.test.tsx` is left; `leaflet-adapter`,
`leaflet-areas`, `leaflet-image-overlays`, `leaflet-kml-overlays`,
`leaflet-markers` and `SituationMap` each have exactly one test file.

Toward AC-3: the KML point tests in today's `leaflet-kml-overlays.test.ts`
are in `kml-layer.test.ts`, and the scale and rotate tests of
`leaflet-image-overlays.test.ts` are in
`leaflet-image-overlay-handles.test.ts`.

Toward AC-9: `SituationMap.test.tsx` (690 lines) and every test file this
ticket writes are under 500 lines.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

Toward AC-12: if part of `SituationMap.tsx` is split off, the map behaves as
before; only the file boundaries move.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-2** No source file has more than one test file. A source file may have none.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Keep `browserTestsInTs` in `vitest.config.mts` in step with renamed test files.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- `browserTestsInTs` in `vitest.config.mts` already matches
  `src/map/leaflet-*.test.ts` and `src/map/kml-layer.test.ts`, so merged
  `.ts` tests there keep running in the `dom` project.
  `leaflet-adapter.attribution.test.tsx` is a `.tsx` without JSX; the merged
  file can be `leaflet-adapter.test.ts`.
- `leaflet-adapter.ts` (121): `.attribution` 22, `.extent` 55, `.resize` 45,
  `.tiles` 26, `.zoom` 19 - all its own code (zoom position, attribution
  prefix, tile `referrerPolicy`, ResizeObserver, extent). Merged about 130
  with one shared `create` helper.
- `leaflet-areas.ts` (145): `.test` 66 (`extractGeometry`), `.signature` 29,
  `.label` 37 (label via the adapter), `.circle-preview` 83. Merged ≈ 200.
- `leaflet-image-overlays.ts` (128): `.test` 196 (drag preview, report on
  drop, restore, ignore unknown - its own; scaling from a corner and
  rotating - implemented in `leaflet-image-overlay-handles.ts`, 93 lines, no
  test), `.signature` 42.
- `leaflet-kml-overlays.ts` (38, set/remove and `kmlSignature`): `.test`
  100 tests a KML point drawn as a circle, 32 px tap area, popup and tip
  position - implemented in `kml-layer.ts` (`kmlPointCircle`,
  `kmlPopupContent`; `kml-layer.test.ts` 236); `.signature` 16.
- `leaflet-markers.ts` (97): `.test` 75 (tooltip placement, HTML as text),
  `.signature` 31.
- `SituationMap.tsx` (382): `SituationMap.test.tsx` 690 (init, last view,
  attribution, persisting, ref, same instance across refresh, markers,
  placing, moving by drag, focus, reconciling areas, drawing, KML, image
  overlay edit start/stop, reconciling images, "moving a circle" lines
  ~413-656 with 6 tests and ~245 lines, read-only, selection);
  `SituationMap.search-hit.test.tsx` 65 (the search-hit effect, lines
  ~336-341 of the component). Merged ≈ 750. Shorten first (shared setup,
  `it.each`). If still over 500, the seam is the circle-moving effects
  (lines ~252-305: centre once, preview, hide from reconcile) into a hook
  such as `useCircleMove.ts` with its ~245 test lines, in a commit of its
  own, with an entry in `coverage-splits.json` in this change's directory.
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
1. Merge the five `leaflet-adapter.*` tests into `leaflet-adapter.test.ts`.
   Proof: green.
2. Merge the four `leaflet-areas` tests and the two `leaflet-markers` tests.
   Proof: green.
3. `leaflet-image-overlays`: merge `.signature`; move the scale and rotate
   tests into `leaflet-image-overlay-handles.test.ts` (new). Proof: green;
   break the rotation maths in the handles by hand and see the moved test
   fail; restore.
4. `leaflet-kml-overlays`: the point/popup tests into `kml-layer.test.ts`
   (driving `kml-layer.ts` directly where possible), `.signature` becomes
   `leaflet-kml-overlays.test.ts`. Proof: green.
5. `SituationMap`: merge `.search-hit`, shorten; split off the circle-moving
   effects only if still over 500. Proof: `npm run check` green; every test
   file under 500; the coverage comparison names no file.

## Not here
- Tests of `SituationMap` behaviour that sit in `SituationWorkspace.*` tests
  today move (or are dropped as duplicates) in tickets 13-16.
- From `CRITERIA.md`'s Out of scope: tests for source files that have none
  today, except where the coverage comparison would otherwise name the
  file (see Context) - the handles file gets only the tests that already test it.
- No change of map behaviour.

## Left standing
