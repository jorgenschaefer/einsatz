---
criteria:  CRITERIA.md
closes:
advances:  AC-3, AC-10, AC-11, AC-12
after:     23-pruefungen
status:    ready
attempts:  0
---

## Build
`ReadOnlySituationMap` gets its own test file, rendered directly with its
props instead of through `ViewLinkView` or `DeviceView`, holding what it
decides: the symbols on the map and their staleness, search of objects and
addresses with the address marker, the live stream with its refresh and
connection-lost badge, a tap handed to `onSelect`, the button back to the
default view, and its `children`. The tests of that behaviour leave
`ViewLinkView.test.tsx`, and their duplicates in `DeviceView.test.tsx` are
dropped.

## Done when
Toward AC-3: `src/map/ReadOnlySituationMap.test.tsx` (new) tests its file
directly; no test in `ViewLinkView.test.tsx` or `DeviceView.test.tsx`
checks only behaviour `ReadOnlySituationMap` or `SituationMap` implements.

Toward AC-10: the coverage comparison names no file.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

Toward AC-12: `ReadOnlySituationMap.tsx`, `ViewLinkView.tsx` and
`DeviceView.tsx` are unchanged, or only restructured.

## Toward
> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-10** For every source file, the share of covered lines and the share of covered branches, measured with `@vitest/coverage-v8`, are no lower after the change than on the commit the change starts from. A source file that was split is compared by adding up the covered and total lines and branches of its parts.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Every jsdom test file costs about 3 s of setup; watch the runtime of `npm test` as test files multiply.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Found by ticket 26, which halted on it: `ReadOnlySituationMap.tsx` (173,
  no test) is tested only through its two parents, twice over.
  `ViewLinkView.tsx` (26) and `DeviceView.tsx` (96) only choose
  `basePath`, what a tap does, `homeButtonBottom` and, for the device, the
  `children` and the location hook.
- `ReadOnlySituationMap` needs no restructure to be tested alone. Its
  seams are props already: `onGeocode`, `factory` (the fake from
  `adapter.fixtures.ts`), `eventsHook`. It also takes `basePath`,
  `focus` (`ReturnType<typeof useMapFocus>`), `onSelect`,
  `homeButtonBottom` and `children`. A test renders it with the props
  `ViewLinkView.test.tsx`'s `renderView` builds today, `basePath="/view"`,
  `focus` from `useMapFocus` in a small harness component (or a fake with
  `vi.fn` for `jumpTo` and `returnToDefaultView`), and `onSelect` a
  `vi.fn`.
- What it holds (the moved tests, plus what no test pins yet):
  - the symbols drawn, and a device symbol going stale
    (`useStalenessClock`, `toPlacedSymbols`);
  - the events URL `${basePath}/${token}/events`, `router.refresh` on an
    event, the "Verbindung getrennt" badge;
  - search of placed objects (a hit calls `focus.jumpTo`) and addresses
    (the injected `onGeocode`; without it `tokenGeocode(basePath, …)`),
    and the address marker;
  - a tap on a symbol calls `onSelect` with the placed symbol;
  - the home button calls `focus.returnToDefaultView` and is disabled
    without a default view;
  - `children` are rendered.
- What moves, from `src/map/ViewLinkView.test.tsx` → `ReadOnlySituationMap.test.tsx`:
  - ViewLinkView › renders the operation symbols read-only
  - ViewLinkView › marks a chosen address on the map
  - ViewLinkView › searches placed objects and jumps to a chosen Kartenzeichen
  - ViewLinkView › grays a device symbol that goes stale while the view stays open
  - ViewLinkView › shows a connection-lost hint when the live stream is disconnected
  - ViewLinkView › reloads the full state when a live event arrives
  - ViewLinkView › disables the return-to-default button when no default view is set
- What goes as duplicates (break the behaviour by hand, see the test that
  fails, restore):
  - ViewLinkView › centers on a tapped symbol at zoom $expected from zoom
    $current (2 rows): the zoom rule is `SituationMap`'s, pinned by
    `SituationMap.test.tsx` "zooms in to a zoom-in-only focus target, but
    not out, from zoom $current" and `useMapFocus.test.ts` "jumps to a
    point at zoom 16 without zooming out".
  - From `src/map/DeviceView.test.tsx`, each a duplicate of a moved test:
    "renders the operation symbols read-only, without editing controls",
    "grays a device symbol that goes stale while the device view stays
    open", "searches placed objects and jumps to a chosen Kartenzeichen",
    "marks a chosen address on the map", "searches addresses through the
    injected geocoder and jumps to a hit", "shows a connection-lost hint
    when the live stream is disconnected", "reloads the full state when a
    live event arrives", "disables the return-to-default button when no
    default view is set", and "centers on the own position at zoom
    $expected from zoom $current" (2 rows, zoom rule as above; "centers the
    map on the device's own position when the locate button is tapped"
    stays and holds the jump). If the "without editing controls" part of
    the first one is pinned nowhere else, keep that part in `DeviceView`'s
    test file.
- What stays, because it is the parents' own: in `ViewLinkView.test.tsx`
  "omits location, wipe-lock and locate controls (no device)", "centers on
  a tapped symbol instead of opening a map app", "listens to the live
  stream of its token route", "searches addresses through its token route",
  "returns the map to the operation's default view" (`/view` base path, the
  tap handler, the `useMapFocus` wiring); in `DeviceView.test.tsx` the
  location badge, the navigation hand-off, the closure page and closing the
  live stream on lost access, its token routes, the locate button and the
  wipe lock.
- Removing or merging tests (AC-11): the commit body has a section
  `Removed tests:` with one line per removed test, `- <old file> ›
  <describe> › <it>` followed by either `→ <new file> › <it>` or `→ gone:
  <why>; broke <behaviour> by hand, <test that failed> failed`. A test moved
  into another file counts as removed from its old file. Before committing,
  run `npm run test:coverage` and
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/compare-coverage.mjs`;
  it must name no file at all. A file it names that has no test file gets
  one, `X.test.*` next to it, with tests of its own behaviour until the
  comparison is clean; say which in Left standing. Fixtures and `src/test/`
  helpers count too: code in them that no test uses any more is deleted,
  and helper code moved to another file gets an entry in
  `coverage-splits.json`.
- Before each commit that touches a test, fixture or `src/test/` file, run
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/removed-tests.mjs`
  (ticket 01). Every name it lists as removed is in the commit's `Removed
  tests:` section; the names it lists as added show where a moved or
  renamed test went.
- AC-3 review list: add `src/map/ReadOnlySituationMap.test.tsx` to
  `ac3-reviewed.txt` in this change's directory, in the same commit; this
  ticket created it. Ticket 27, whose area holds `ReadOnlySituationMap.tsx`,
  then skips it. `ViewLinkView.test.tsx` and `DeviceView.test.tsx` are not
  listed: ticket 26 reads them.

## Plan
1. `src/map/ReadOnlySituationMap.test.tsx` (new) with the moved tests and
   the cases no test pins yet; delete the moved tests from
   `ViewLinkView.test.tsx`. Proof: green; remove the `!connected` badge and
   the `router.refresh()` call by hand and see the new tests fail; restore.
2. Drop the zoom rows and the `DeviceView` duplicates, each with the
   by-hand check. Proof: green.
3. Proof: `npm run check` green; the coverage comparison names no file.

## Not here
- The rest of the review of `ViewLinkView.test.tsx` and
  `DeviceView.test.tsx` (ticket 26) and of `SituationMap.test.tsx` (ticket
  27).
- No change of behaviour.

## Left standing
