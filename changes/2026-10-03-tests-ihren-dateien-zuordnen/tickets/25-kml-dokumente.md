---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11, AC-12
after:     04-actions-ebenen-bilder, 20-kml-icons-import
status:    ready
attempts:  0
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
