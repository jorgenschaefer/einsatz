---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11, AC-12
after:     04-actions-ebenen-bilder, 20-kml-icons-import
status:    done
attempts:  1
---

## Build
The last four `kml-actions.<topic>.test.ts` files - `.document`, `.timing`,
`.address` and `.name` - move to the modules that implement what they test
(`kml-fetch`, `kmz`, `pinned-fetch`, `public-address`, `kml-overlays`,
`kml-actions`), duplicates are dropped, and the four files are deleted.

## Done when
Toward AC-1 and AC-2: no `src/app/operations/[id]/kml-actions.<topic>.test.ts`
exists; `kml-actions.ts` has exactly one test file.

Toward AC-3: each moved test drives the module that implements it, not the
action.

Toward AC-9: `kml-fetch.test.ts`, `kmz.test.ts` and every file split off
are under 500 lines.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

Toward AC-12: if `kmz.ts` or `kml-fetch.ts` is split, KML loading behaves as
before; only file boundaries move.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-2** No source file has more than one test file. A source file may have none.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Mocks (`next/headers`, `next/navigation`, `@/server/db/pg`) stay at the top of each test file, because `vi.mock` is only hoisted in the test file itself. The helpers do not mock.

> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Ticket 20 moved `.icons`, `.icon-address` and `.budget` (the 20 MB icon
  growth case into `kmz.test.ts`). Ticket 04 reshaped `kml-actions.test.ts`
  (real database, a recording mock of `loadKmlFromUrl`).
- `.document` (174; action, mocked `pinned-fetch`): the "no KML" message on
  add and reload (`kml-fetch.assertKmlDocument` in `fetchKmlFromUrl`), a
  declaration or comment before the root (`hasKmlRoot`), KMZ
  (`kmz.extractKml`), skipping a non-KML NetworkLink and non-public URLs
  (`kml-fetch.resolveKmlNetworkLinks`, `assertFetchableKmlUrl`).
- `.timing` (178): pathological input for the `kmz.ts` scanners
  (`hrefTexts`, `networkLinkHrefs`, `iconStyleHrefs`, `mergeKmlDocuments`,
  `extractKml`) and `kml-fetch`'s `hasKmlRoot`.
- `.address` (84; real `pinned-fetch`, mocked DNS): CGNAT, loopback, mixed
  and mapped addresses refused, an unresolvable host's message →
  `pinned-fetch.checkedLookup` and `public-address`; largely already in
  `pinned-fetch.test.ts` (189) and `public-address.test.ts` (125).
- `.name` (61): 201 characters / not text → already in
  `kml-overlays.test.ts` "the name of a new KML-Ebene"; the name taken from
  the trimmed URL → `kml-actions.test.ts`.
- Sizes: `kml-fetch.test.ts` 268 (plus what ticket 20 added),
  `kmz.test.ts` 393 (`src/kml/kmz.ts`, 313 lines). Shorten first. If
  `kmz.test.ts` still goes over 500, the seam is the href scanners
  (`hrefTexts`, `networkLinkHrefs`, `iconStyleHrefs`,
  `replaceIconStyleHrefs`) into a file of their own (for example
  `src/kml/kml-hrefs.ts`); if `kml-fetch.test.ts` does, the seam is
  `resolveKmlNetworkLinks` and its helpers (unless ticket 20 already split
  them off). Each split in a commit of its own, with the coverage-splits
  entry in this change's directory.
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
1. `.document` into `kml-fetch.test.ts` and `kmz.test.ts`, driving
   `fetchKmlFromUrl`, `assertKmlDocument` and `extractKml` directly; delete
   it. Proof: green; make `hasKmlRoot` reject a leading comment by hand and
   see the moved test fail; restore.
2. `.timing` into `kmz.test.ts` and `kml-fetch.test.ts`; split as under Context only if a file goes
   over 500. Delete it. Proof: green; `wc -l`.
3. `.address` into `pinned-fetch.test.ts` / `public-address.test.ts` or
   dropped as duplicates; `.name` into `kml-actions.test.ts` /
   `kml-overlays.test.ts`. Delete both. Proof: `npm run check` green;
   the coverage comparison names no file.

## Not here
- `.icons`, `.icon-address`, `.budget` (ticket 20).
- No change to KML behaviour.

## Left standing
- **Review findings not fixed.** None. There were two review rounds:
  - **Round 1:** no blocker, two should-fix, three nits. All five are
    fixed:
    - I dropped a `checkedLookup` table that repeated what
      `public-address.test.ts` already pins.
    - I dropped an action test for the name falling back to the URL. That
      fallback belongs to `kml-overlays`, and its test already covers it.
    - I cut the five-literal "requests nothing" table down to one URL.
    - I wrote the comments in `src/test/kml-timing.ts` in one language.
    - I moved the merge timing test into the `mergeKmlDocuments` block.
  - **Round 2:** one should-fix and one nit, both fixed:
    - The `pinnedFetch` refusals now assert a `ValidationError`, not just a
      message. This holds what the old `.address` tests proved through the
      action: the message reaches the user.
    - An unresolvable name is now tested through `pinnedFetch`.
    - `kmlFileForm` moved into its only user, `kml/route.test.ts`.
- **Checks not run.** None skipped. After the last edit:
  - `npm run check` is green: 191 files, 2661 tests.
  - `npm run test:coverage` and then `compare-coverage.mjs` exit 0, with
    no coverage drop. The script names helper and fixture files as "new,
    compared with nothing", as after earlier tickets, and now also
    `src/test/kml-timing.ts`. That file is new code taken from a test
    file; it was not split out of a baseline source file.
  - Moving the tests first dropped two files, and I fixed both:
    - `pinned-fetch.ts` lost its `https:` branch, so `pinned-fetch.test.ts`
      gained "refuses an https name that resolves to a loopback address".
    - `src/test/kml-upload.ts` was left with an unused `postKmlFile`. That
      file is now deleted and has a `[]` entry in `coverage-splits.json`.
- **Advanced without an automated test.**
  - AC-1, AC-2, AC-9: I checked by listing the files. Only
    `kml-actions.test.ts` is left next to `kml-actions.ts`. The two largest
    files are `kml-fetch.test.ts` (488 lines) and `kmz.test.ts` (427). No
    file was split.
  - AC-3, AC-11: I broke the code by hand to prove each moved test, and
    restored each break:
    - Leading comments rejected in `hasKmlRoot`.
    - The KML check in `fetchKmlFromUrl` removed.
    - `extractKml` skipped.
    - The URL checks in `fetchKmlFromUrl` and `fetchFollowingRedirects`
      removed.
    - `elementRanges` searching with a backtracking regex: the scanner
      timing tests in `kmz.test.ts` and the NetworkLink case in
      `kml-fetch.test.ts` failed.
    - `outermostElementBody` searching with a greedy regex: both merge
      timing tests failed.
    - `checkedLookup` accepting every address.
    - `pinnedFetch` without `checkedLookup` for https.
    - `pinnedFetch` rejecting with a plain `Error`.
    - The multicast, 192.0.2.0/24 and 2001:db8::/32 ranges removed from
      `public-address.ts`.
    - NAT64 treated as global.
    - The name check, and the fallback to the address, removed from
      `createKmlOverlay`.
    - `reloadKmlAction` not using `loadKmlFromUrl`.

    Each break made the test named in the commit's `Removed tests:` record
    fail.
  - AC-12: no production file changed.
- **AC-3 review list.** Nothing is added to `ac3-reviewed.txt`. This
  ticket created no test file and only edited `kmz.test.ts`,
  `kml-fetch.test.ts`, `pinned-fetch.test.ts` and `kml/route.test.ts`.
- **Departures from the plan.**
  - The timing harness is now a shared helper, `src/test/kml-timing.ts`,
    because `kmz.test.ts` and `kml-fetch.test.ts` both use it.
  - The action-level timing cases became two kinds of test:
    - each scanner timed directly in `kmz.test.ts`;
    - the plain-KML URL path timed through `fetchKmlFromUrl`.

    I dropped a `fetchKmlFromUrl` timing test for KMZ. It only added
    `extractKml`, which `kmz.test.ts` already times directly. The upload
    and reload paths have no timing test of their own, because they only
    combine the timed functions.
  - `hasKmlRoot` gained no timing test. The pieces in the old file come
    after the root, so `hasKmlRoot` never scanned them. Input that is slow
    for it is still covered by the existing `assertKmlDocument` "rejects
    … without stalling" tests.
  - All of `.name` was already covered elsewhere: the action's bad calls,
    `kml-overlays.test.ts`, and the trimmed `sourceUrl` in
    `kml-actions.test.ts`. So `kml-actions.test.ts` ends this ticket
    unchanged.
  - Four of the five IP literals in `.document` are dropped. Their ranges
    are in `public-address.test.ts`'s tables.
- **Departures from a nudge.** None.
