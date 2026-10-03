---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11, AC-12
after:     01-coverage-ausgangswert
status:    done
attempts:  1
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
- **Review findings not fixed.** Two review rounds. Round 1 found one
  should-fix and three nits. Round 2 found one nit. I fixed all but two
  nits from round 1:
  - Fixed (round 1 should-fix): once the KML point tests drove
    `kml-layer.ts` directly, no test called `setKmlOverlay` or
    `removeKmlOverlay` on the real adapter. `leaflet-adapter.test.ts` now
    has "draws a KML-Ebene and takes it off again". When either was wired
    to `() => {}`, that test failed.
  - Fixed (nits): the copies of the bare `L.map` setup are now
    `mountPlainLeafletMap` in `leaflet-map.fixtures.ts`. Its unused `size`
    parameter (round 2) is gone.
  - Not fixed (nit): `search-hit-pin.test.ts` still builds its adapter by
    hand instead of using `mountLeafletMap`. That file is outside this
    ticket, and the review tickets 26-31 read it.
  - Not fixed (nit): the German comments that moved with the tests stay
    German. The project's comments are German throughout, and ticket 11
    left the same nit for the same reason.
- **Checks not run.** None skipped. After the last edit, `npm run check` is
  green (209 files, 2742 tests). `npm run test:coverage` and then
  `compare-coverage.mjs` exit 0. The script names the `src/test/` helpers
  from tickets 02-10 and the new `src/map/leaflet-map.fixtures.ts` as "new,
  compared with nothing". The fixture's code came out of test files, which
  are not in the baseline, so `coverage-splits.json` has no entry for it.
  The last edit only removed the fixture's `size` parameter, and I did not
  rerun coverage after it.
- **Coverage drop fixed by new tests.** After the KML point tests moved to
  `kml-layer.test.ts`, `leaflet-kml-overlays.ts` dropped from 14/17 lines
  and 3/6 branches to 4/17 and 0/6. Its test file now has five tests of
  `createKmlOverlayLayers`: visible, hidden and hidden again, set again
  unchanged, content that is not KML, and set again after a remove. I
  broke each branch by hand, and each break failed its test: no signature
  check, `visible` ignored, the old layer not removed, the signature kept
  on remove, nothing added, and an unparsed layer added.
- **Advanced without an automated test.**
  - AC-1, AC-2: I checked by listing the files. None of the topic files is
    left. Each of the six modules has exactly one test file, and so does
    `leaflet-image-overlay-handles.ts` (new).
  - AC-9: checked with `wc -l`. `SituationMap.test.tsx` has 450 lines and
    `kml-layer.test.ts` 313. The other written files are under 200.
  - AC-11: the commit's `Removed tests:` section is written from
    `removed-tests.mjs`. It names all 33 removed tests, and each has its
    `→` line. I broke code by hand to see the moved or rewritten tests
    fail, and restored it each time:
    - Rotation +1° and scale ×2 in `leaflet-image-overlay-handles.ts`:
      the moved rotate and scale tests failed.
    - `popupAnchor` at 0 and `iconAnchor` at 0 in `kml-layer.ts`: the
      moved popup-tip and tap-area tests failed.
    - `imageUrl` left out of `imageSignature`: the signature test failed.
      I added that assertion, as the test's name promised it.
    - In `SituationMap.tsx`: `areas` in the centring effect's deps failed
      "does not re-centre…". `operationDefaultView` in the map effect's
      deps failed "keeps the same map instance…". `previewOpacity` or
      `previewRadius` dropped from the preview's deps failed the opacity
      or radius row. A search hit never set failed four Suchtreffer tests.
  - AC-12: no production file changed.
- **AC-3 review list.** I added seven files to `ac3-reviewed.txt`.
  - This ticket created `leaflet-adapter.test.ts` and
    `leaflet-image-overlay-handles.test.ts`.
  - I rewrote `leaflet-kml-overlays.test.ts`, `leaflet-areas.test.ts`,
    `leaflet-markers.test.ts`, `leaflet-image-overlays.test.ts` and
    `SituationMap.test.tsx` as a whole, and held every test in them
    against their own file. In the areas, markers and image files, the
    real adapter runs only as a harness.
  - One judgement call: "reports the new placement when the handle is
    dropped" stays in `leaflet-image-overlays.test.ts`. The centre comes
    from the handles file, but what the test pins is that the overlays
    module reports on drop and not while dragging.
  - `kml-layer.test.ts` was only edited (tests moved in), so it is not
    listed.
- **Departures from the plan.**
  - All five steps are in one commit. No production code moved, so there
    was no restructuring commit to keep apart. `SituationMap.tsx` is not
    split, because the merged test file was 450 lines after shortening.
    So `coverage-splits.json` is unchanged.
  - The moved KML point tests and the scale/rotate tests drive their own
    module on a bare Leaflet map (`parseKml(...).addTo(map)`,
    `createImageOverlayHandles(map).show(...)`), not the adapter.
  - New shared fixture `src/map/leaflet-map.fixtures.ts`, with
    `mountLeafletMap` (the adapter) and `mountPlainLeafletMap`. It replaces
    the per-file setup copies, as the shortening nudge suggests.
  - Renamed tests: "verlinkt Impressum und Datenschutz…" is now "links
    Impressum and Datenschutz in the attribution bar", in English. The
    describe "dropping the other handles of an image overlay" is now
    "dropping a corner or the rotate handle". The colour/opacity preview
    test is split into `it.each` rows with the radius test.
- **Departures from a nudge.** None.
