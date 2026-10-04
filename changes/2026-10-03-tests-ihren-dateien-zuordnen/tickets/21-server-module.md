---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11, AC-12
after:     01-coverage-ausgangswert
status:    done
attempts:  1
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
- **Review findings not fixed.** Two rounds. The first round's
  should-fix (no test sent a bad `additionalPersonnel` once the moved
  cases folded into `strength-input.test.ts`) and its nit (`journal.ts`
  exported six row internals) are fixed. The second round found only
  nits, and I left both:
  - nit: `loadEntry(tx, entryId, true)` in `journal-history.ts` does not
    say at the call that `true` locks the row. Renaming or splitting
    `loadEntry` changes production code beyond the move this ticket is;
    the doc comments of `reviseEntry` and `markEntryAnnulled` say that
    they lock it.
  - nit: in `map-symbols.test.ts`, `aLinkedSymbolIn` returns
    `{ operationId, symbolId }` while `aSymbolIn` returns
    `{ op, symbol }`. The ownership cases kept the shape they had in
    their own file, so the moved tests read as before.
- **Checks.** `npm run check` green (199 files, 2677 tests).
  `npm run test:coverage` plus `compare-coverage.mjs` exit 0 and name no
  file except the nine "new, compared with nothing" files earlier tickets
  created (`src/map/*.fixtures.*`, `src/test/action-checks.ts` and the
  like), none of them touched here. No file needed a new test file. The
  split of `journal.ts` has its entry in `coverage-splits.json`. No
  `src/test/` helper or fixture changed.
- **Advanced without an automated test.**
  - AC-11: the commit body's `Removed tests:` section lists every name
    `removed-tests.mjs` reported. For the moved range and note checks I
    broke `requireStrengthValues` by hand (`<` instead of `<=` 9999, `>`
    instead of `>=` 0, no integer check, `additionalPersonnel` left out of
    the checked counts, blank note kept, a non-text note taken as none);
    each made a test in `strength-input.test.ts` fail. Storing
    `input.values` instead of the checked values in `recordStrengthReport`
    or `correctStrengthReport` made "stores the note as checked, trimmed"
    fail; skipping `requireStrengthValues` there made "rejects bad values
    without writing anything" fail.
  - The PDF cases run the real renderer: with `viewportScale` doubled by
    hand in `renderPdfFirstPageToPng`, all seven rendering cases in
    `image-storage.test.ts` failed; restored. The file also passes with
    `--sequence.shuffle`, so the failure case's mock does not leak.
  - AC-12: the only production changes are the moves out of `journal.ts`
    (code moved verbatim, `loadEntry` now exported from `journal.ts`) and
    the callers' imports. The reviewer compared the moved functions with
    the removed code.
- **AC-3 review list.** This ticket created no test file. I held every
  test in `strength-input.test.ts`, `strength-reports.test.ts`,
  `image-storage.test.ts` and `map-symbols.test.ts` against its own file
  and added those four to `ac3-reviewed.txt`. `journal.test.ts`,
  `image-overlays.test.ts`, `correspondents.test.ts` and
  `journal-history.test.ts` were only edited (merged in, imports) and are
  not listed.
- **Departures from the plan.**
  - Step 2: the merged and shortened `map-symbols.test.ts` is 422 lines,
    so `map-symbols.ts` is not split and there is no `device-links.ts`.
  - Step 1: `journal-history.ts` needed the row mapping, so `journal.ts`
    exports `loadEntry` (moved there from the history code) rather than
    its row types and column lists.
  - Step 5: `strength-reports.test.ts` keeps, per function, one "stores
    the note as checked, trimmed" test besides the one bad-values case.
    Without it nothing pins that the two functions store the checked
    values rather than the raw input (broken by hand, see above). To stay
    under 500 lines (488) the file also shares `aReport` and a helper for
    the two "rename it had to wait for" tests, and drops `valuesOf`.
  - Test moves were committed after the split, in one commit with the
    ticket, rather than one commit per step.
- **Departures from a nudge.** None.
