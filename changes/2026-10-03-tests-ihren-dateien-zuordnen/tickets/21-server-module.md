---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11, AC-12
after:     01-coverage-ausgangswert
status:    ready
attempts:  0
---

## Build
The server modules with several or misnamed test files each end up with
one: `journal.ts` is split along the seams its test files already name,
`map-symbols.ts` gives up its Gerätelink functions to a file of their own,
the `.ownership` and `.pdf` tests are merged, and `strength-reports.test.ts`
gets under 500 lines.

## Done when
Toward AC-1 and AC-2: in `src/server/`, `journal.validation.test.ts`,
`map-symbols.ownership.test.ts`, `image-overlays.ownership.test.ts` and
`image-storage.pdf.test.ts` are gone; `correspondents.test.ts` and
`journal-history.test.ts` sit next to `correspondents.ts` and
`journal-history.ts`; every source file touched has at most one test file.

Toward AC-3: each test of these modules drives the file that implements it;
the range and note checks of Stärkemeldungen are in the test of
`strength-input.ts`, which implements them.

Toward AC-9 and AC-12 together: `map-symbols.ts` is split only if its
merged, shortened test is still over 500 lines.

Toward AC-9: `strength-reports.test.ts` (579 lines) and the merged
`map-symbols` tests are under 500 lines.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

Toward AC-12: the ETB, Kartenzeichen and Gerätelinks behave as before; the
splits only move functions between files.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-2** No source file has more than one test file. A source file may have none.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- `src/server/journal/journal.ts` (375): `requireEntryContent` (~106),
  `appendEntry` (~132), `listEntries` (~174), `listCorrespondents`
  (~209-263), `correctEntry` (~264), `reviseEntry` (~295), `annulEntry`
  (~337), `markEntryAnnulled` (~362). Tests: `journal.test.ts` 198
  (append, number, list, route stored), `journal.validation.test.ts` 40
  (`requireEntryContent`), `correspondents.test.ts` 142
  (`listCorrespondents`, also uses `stations.ts`), `journal-history.test.ts`
  275 (correct, annul, rules per entry type). The seams are the existing
  test names: `listCorrespondents` into `correspondents.ts`, and
  correct/revise/annul/markAnnulled into `journal-history.ts`; `journal.ts`
  keeps validation, append and list. Callers import from the new files.
- `src/server/mapsymbols/map-symbols.ts` (273): `map-symbols.test.ts` 437 +
  `.ownership` 87 (describe.each over move / updateComposition / delete /
  generateDeviceLink / removeDeviceLink) ≈ 520. Seam: the Gerätelink and
  position functions (`generateDeviceLink` from ~176 through
  `reportPosition` ~247-273, with `resolveDeviceAccess` ~224) into a file
  such as `device-links.ts` in the same directory, taking the test lines
  ~172-347 (live position, concurrent reports, refused tokens, closed
  Einsatz, `resolveDeviceAccess`, removing and generating links) and the two
  Gerätelink ownership cases. Shorten the merged file first; split only if
  it stays over 500 lines.
- `src/server/image-overlays/image-overlays.ts` (214): test 274 +
  `.ownership` 95 ≈ 360. Merge.
- `src/server/image-overlays/image-storage.ts` (210): test 227 mocks
  `pdf-to-png-converter` file-wide; `.pdf.test.ts` 51 uses the real renderer
  on purpose. Merging needs one mock that the PDF cases can bypass - for
  example `vi.mock` with `importOriginal` and a per-test implementation, or
  `vi.importActual` in the PDF cases.
- `src/server/strength/strength-reports.ts` (209): test 579. The range and
  note it.each (lines ~153-172 and ~384-402, "accepts all zeros / 9999",
  trimming notes, twice) check `requireStrengthValues` in
  `strength-input.ts` (test `strength-input.test.ts` 60, only partly
  covering them): move them there once, leaving one "writes nothing on bad
  values" case per function. That brings it to about 470-480.
- Every split is a commit of its own before tests move, and adds an entry
  to `changes/2026-10-03-tests-ihren-dateien-zuordnen/coverage-splits.json`.
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
1. Split `journal.ts` into `journal.ts`, `correspondents.ts` and
   `journal-history.ts` (new), updating imports, no test change; then merge
   `journal.validation.test.ts` into `journal.test.ts`. Proof: green;
   coverage-splits entry; the coverage comparison names no file.
2. Merge `map-symbols.ownership.test.ts` into `map-symbols.test.ts` and
   shorten (shared setup, `it.each`). Only if it is still over 500 lines,
   split the Gerätelink functions off `map-symbols.ts` into
   `device-links.ts` (new) in a commit with no test change, then move their
   tests into `device-links.test.ts` (new). Proof: green; every test file
   under 500.
3. Merge `image-overlays.ownership.test.ts`. Proof: green.
4. Merge `image-storage.pdf.test.ts` with the mock reconciled. Proof: green;
   the PDF cases still run the real renderer (break the renderer call by
   hand and see them fail; restore).
5. Move the Stärkemeldung range and note checks to `strength-input.test.ts`.
   Proof: `npm run check` green; `strength-reports.test.ts` under 500;
   the coverage comparison names no file.

## Not here
- `login`, `password`, `account-admin` and `strength.ts` (ticket 22).
- `journal-actions.ts` and `strength-actions.ts` tests (ticket 05).
- No change of behaviour.

## Left standing
