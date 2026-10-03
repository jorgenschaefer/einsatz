---
criteria:  CRITERIA.md
closes:
advances:  AC-3, AC-9, AC-11, AC-12
after:     01-coverage-ausgangswert
status:    ready
attempts:  0
---

## Build
`JournalPanel.tsx` (375 lines, tests 2150 lines over seven files) is split
along two seams - scrolling to the latest entry, and one entry of the list -
into files with their own tests, and the tests of the entry header, the
remembered Von/An/Weg and the annul flow move to the files that implement
them. The form tests are ticket 18's.

## Done when
Toward AC-3: `useScrollToEnd`, the entry card, `EntryRouteHeader` and
`useEntryRouteMemory` each have a test file that drives that file directly
(`useScrollToEnd.test.ts`, `JournalEntry.test.tsx`,
`EntryRouteHeader.test.tsx`, `useEntryRouteMemory.test.ts`, names as built);
the tests of their behaviour are no longer in `JournalPanel.*` test files.

Toward AC-9: every test file this ticket writes, and every source file it
splits off, is under 500 lines.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

Toward AC-12: the ETB behaves as before; only file boundaries move.

## Toward
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
- `src/journal/JournalPanel.tsx` (375) holds: the entry list (number,
  time, "automatisch" badge, author, the ⋯ menu gated by
  `canCorrectEntry`/`canAnnulEntry` from `entry-type.ts`, revisions, struck
  annulled text, "korrigiert" time - lines ~165-265), the filter for
  automatic entries, `addEntry` and `correctEditedEntry` with per-form error
  state, `memory.remember` only after a successful add, the annul
  `ConfirmationModal`, the `NEW_ENTRY` preset Funk, and the private
  `useScrollToEnd` hook with an IntersectionObserver (lines ~305-375).
  Fixtures: `JournalPanel.fixtures.tsx` (65: `entry`, `panelProps`,
  `setup`, `newEntryField`, `newEntry`, `addButton`, `correctionField`,
  `correctionForm`, `chooseAction`).
- Decided here (names spread into ticket 18): `useScrollToEnd` moves to
  `src/journal/useScrollToEnd.ts`, the per-entry card to
  `src/journal/JournalEntry.tsx`; each split in a commit of its own before
  tests move, and both added as parts of `src/journal/JournalPanel.tsx` in
  `changes/2026-10-03-tests-ihren-dateien-zuordnen/coverage-splits.json`.
- `browserTestsInTs` in `vitest.config.mts` does not match
  `src/journal/use*.test.ts`; add that pattern for the two new hook tests
  (as `src/map/use*.test.ts` and `src/app/use*.test.ts` are), or they run
  without a DOM and fail.
- What moves here:
  - `JournalPanel.test.tsx` (358): "scrolling to the latest entry" (8 tests,
    lines ~238-358) → `useScrollToEnd.test.ts`; the list display and which
    actions each entry type offers → `JournalEntry.test.tsx`.
  - `JournalPanel.annul.test.tsx` (196): the struck header →
    `EntryRouteHeader.test.tsx`; confirm-then-annul, the right target and
    cancel stay `JournalPanel`'s; double click, in-flight stays open,
    second click while fading out, an error in the open dialog, the next
    dialog without the old error are `ConfirmationModal`'s - drop where
    `src/app/ConfirmationModal.test.tsx` (382) pins them.
  - `JournalPanel.correct.test.tsx`: the menu offering Korrigieren, hidden
    while editing, earlier Fassungen struck with their author, revision
    keys, the correction time → `JournalEntry.test.tsx`.
  - `JournalPanel.remembered.test.tsx` (327): last-used order, kept across a
    reload, per Gesamteinsatz, the remembered free-text Weg, the server
    render in alphabetical order with Funk, "without browser storage" →
    `useEntryRouteMemory.test.ts` (with `entry-route-storage.test.ts` and
    `entry-route.test.ts` where they already pin a case); a correction does
    not count as a use and a failed add changes nothing stay
    `JournalPanel`'s. Its form cases ("keeps a Weg chosen before the
    remembered one arrives", the free-text field) are ticket 18's.
  - `JournalPanel.route.test.tsx`: the header it.each and "no header" →
    `EntryRouteHeader.test.tsx` (or dropped where `entry-route.test.ts`
    pins `formatEntryRoute`). Its form cases are ticket 18's.
  - Tests that stay `JournalPanel`'s remain in the topic file they are in;
    ticket 18 gathers them into `JournalPanel.test.tsx` and deletes the
    topic files.
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
1. Split `useScrollToEnd` into `src/journal/useScrollToEnd.ts` (new), its
   commit with no test change. Proof: every test green; coverage-splits
   entry added.
2. `useScrollToEnd.test.ts` (new) with the scrolling tests; add the
   `src/journal/use*.test.ts` pattern to `browserTestsInTs`. Proof: green;
   make the hook skip `scrollIntoView` by hand and see them fail; restore.
3. Split the entry card into `src/journal/JournalEntry.tsx` (new), its
   commit with no test change. Proof: green.
4. `JournalEntry.test.tsx` (new) with the display, menu and revision tests.
   Proof: green.
5. `EntryRouteHeader.test.tsx` and `useEntryRouteMemory.test.ts` (new) with
   their cases; drop the `ConfirmationModal` duplicates. Proof:
   `npm run check` green; the coverage comparison names no file.

## Not here
- `EntryForm`, `EntryRouteFields`, the rest of `JournalPanel`'s tests and
  deleting the topic files (ticket 18).
- From `CRITERIA.md`'s Out of scope: tests for source files that have none
  today, except where the coverage comparison would otherwise name the
  file (see Context) - only existing tests move into the new test files.
- No change of behaviour.

## Left standing
