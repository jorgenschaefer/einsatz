---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11, AC-12
after:     17-etb-panel-anzeige
status:    done
attempts:  1
---

## Build
The ETB's entry form tests move to `EntryForm` and `EntryRouteFields`, what
is left of `JournalPanel`'s own behaviour is gathered into
`JournalPanel.test.tsx`, and the six `JournalPanel.<topic>.test.tsx` files
are deleted.

## Done when
Toward AC-1 and AC-2: no `src/journal/JournalPanel.<topic>.test.tsx` exists;
`JournalPanel.tsx`, `EntryForm.tsx` and `EntryRouteFields.tsx` (or the files
it is split into) each have exactly one test file.

Toward AC-3: `EntryForm.test.tsx` (new) drives `EntryForm` directly, the
Von/An and Weg tests drive the route fields directly, and
`JournalPanel.test.tsx` holds only `JournalPanel`'s own behaviour.

Toward AC-9: `JournalPanel.test.tsx`, `EntryForm.test.tsx` and the route
field tests are each under 500 lines.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

Toward AC-12: if `EntryRouteFields.tsx` is split, the ETB form behaves as
before; only file boundaries move.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-2** No source file has more than one test file. A source file may have none.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Every jsdom test file costs about 3 s of setup; watch the runtime of `npm test` as test files multiply.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Ticket 17 split `useScrollToEnd.ts` and `JournalEntry.tsx` off
  `JournalPanel.tsx` and moved the display, scrolling, header and
  remembered-route tests. The tests still in `JournalPanel.<topic>` files are
  `JournalPanel`'s own or the form's.
- `src/journal/EntryForm.tsx` (163, no test): submit, Strg+Enter in every
  field, clearing Von/An but keeping the Weg after success, keeping all on
  failure, the chip rows scrolling back (`chipRowsKey`), `pinned`/`initial`
  prefill, `presetChannel`/`channelChosen`, `otherOpen`, where the error
  shows. `src/journal/EntryRouteFields.tsx` (245) exports
  `EntryChannelSelect`, `EntryRouteChips`, `isSubmitShortcut`,
  `DEFAULT_CHANNEL`; `EntryRouteFields.test.tsx` (267) already tests the
  two components directly.
- What moves here:
  - To `EntryForm.test.tsx`: from `JournalPanel.test.tsx` add on
    Strg+Enter and "no empty entry"; from `correct` the prefill of
    Von/An/Weg with chosen chips first, pinned chip first, another spelling,
    Strg+Enter in Weg / free text / other Von / the edit field; from `other`
    adding a typed An, closing the fields after adding, keeping them on
    failure, Strg+Enter in Von/An/a suggestion, keeping a typed Weg after
    adding; from `remembered` "keeps a Weg chosen before the remembered one
    arrives"; from `route` adding with Weg/Von/An (it.each), nothing without
    text, clearing Von/An but keeping the Weg, keeping all on failure, the
    chip rows scrolling back, Strg+Enter, chips above the field with no
    preselection; from `save-error` where the error shows in the new-entry
    and the correction form.
  - To the route field tests: from `correct` the free-text Weg prefill,
    focus and × back to Funk (`EntryChannelSelect`), the chip order
    (`EntryRouteChips`); from `other` the field replacing the chips, no
    suggestions before typing, the suggestions it.each, the marked suggestion
    on Enter, × bringing the chips back (`EntryRouteChips`), focus on
    Andere… and × restoring the previous Weg (`EntryChannelSelect`); from
    `remembered` the free-text field staying when emptied and × going to
    Funk. If `EntryRouteFields.test.tsx` goes over 500 lines, split
    `EntryRouteFields.tsx` into `EntryChannelSelect.tsx` and
    `EntryRouteChips.tsx` (each with its test), in a commit of its own, with
    the coverage-splits entry in this change's directory.
  - To `JournalPanel.test.tsx`: what is `JournalPanel`'s - the filter, the
    `NEW_ENTRY` preset, live entries and correspondents, confirm-then-annul
    and cancel, a correction not counting as a use, a failed add changing
    nothing, the returned and thrown errors and dropping them on the next
    success / × / Abbrechen, the per-entry correction error, a late result
    not leaking into another correction, scrolling the error into view.
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
1. `src/journal/EntryForm.test.tsx` (new) with the form cases, rendering
   `EntryForm` directly. Proof: green; break the Strg+Enter handling by hand
   and see its tests fail; restore.
2. The route field cases into `EntryRouteFields.test.tsx`; split the file
   only if it goes over 500. Proof: green; `wc -l`.
3. Gather `JournalPanel`'s own cases into `JournalPanel.test.tsx`, shorten.
   Proof: green; `wc -l` under 500.
4. Delete the six `JournalPanel.<topic>.test.tsx` files once empty. Proof:
   `npm run check` green; the coverage comparison names no file.

## Not here
- The splits and moves of ticket 17.
- From `CRITERIA.md`'s Out of scope: tests for source files that have none
  today, except where the coverage comparison would otherwise name the
  file (see Context) - only existing tests move.
- No change of behaviour.

## Left standing
- **Review findings not fixed.** There were two review rounds.
  - Round 1 had one should-fix, which I fixed: no test noticed
    `JournalPanel` failing to empty Neuer Eintrag after a successful
    add. Round 2 had two should-fix items, which I fixed: a free-text
    Weg that arrives after mounting must stay a text field once emptied,
    and a correction's An chip must come first in its row. Each new
    assertion failed under the reviewer's break before passing.
  - **Nit from round 1, not taken (I disagree).** The reviewer wanted
    `EntryForm.test.tsx` › "submits the suggestion marked in the field
    for another Von" removed as a duplicate of `EntryRouteChips`. It is
    the only test that fails when `EntryForm` stops merging the value a
    field hands to `submit` (`...chosen`). I broke that merge by hand,
    and only this test failed. The typed-value cases cannot show it,
    because typing already sets the value.
  - **Older gaps that round 2 found and that I left.** These breaks
    pass both the old suite and the new one, so they were untested
    before this ticket. Pinning them is new test work, not a move:
    - **Passing `presetChannel` to the correction form as well.** This
      one has user impact: the remembered Weg would overwrite a
      corrected entry's Weg. It is worth a test in
      `JournalPanel.test.tsx`, which is at 499 lines, so the next test
      there needs a line saved first.
    - `compact` on the correction.
    - `preventDefault` on Strg+Enter in `EntryForm` and in
      `EntryRouteChips`.
- **Checks not run.** None skipped:
  - After the last edit, `npm run check` is green: 204 files, 2673
    tests.
  - `npm run test:coverage` and then `compare-coverage.mjs` exit 0. The
    only files it names as new come from earlier tickets. The first try
    named `EntryRouteFields.tsx`, where one branch was no longer
    covered (an emptied free-text Weg handed on as no Weg). I fixed the
    test so a user clears the field.
  - No new file needed a test file for coverage, and nothing went into
    `coverage-splits.json`.
  - The running app was not checked. No production code changed, and
    both reviewers judged it unnecessary.
- **Advanced without an automated test.**
  - AC-1/AC-2: checked with `ls src/journal`. The six topic files are
    deleted. `JournalPanel.tsx`, `EntryForm.tsx` and
    `EntryRouteFields.tsx` each have one test file.
  - AC-3: for each of `EntryForm.tsx`, `EntryRouteFields.tsx` and
    `JournalPanel.tsx`, I broke every decision by hand, one at a time.
    Each break made a test in that file's own test file fail.
    `EntryForm.test.tsx` was created here and `JournalPanel.test.tsx`
    was rebuilt here. Every test in both was held against its own file
    that way, so both are added to `ac3-reviewed.txt`.
    `EntryRouteFields.test.tsx` was only extended, so it is not listed.
  - AC-9: checked with `wc -l`. The files are `JournalPanel.test.tsx`
    499, `EntryForm.test.tsx` 443 and `EntryRouteFields.test.tsx` 404.
    `EntryRouteFields.tsx` was not split.
  - AC-11: the commit's `Removed tests:` section has every name
    `removed-tests.mjs` lists, 90 in all. Three are gone, each with its
    hand-break:
    - "adds without the Von that was tapped again"
    - "leaves the error behind when correcting another entry". It was
      green under each of the two breaks of what it covered, so it
      pinned nothing on its own.
    - "drops the error once the correction is saved"
  - AC-12: no production file changed (`git diff` touches only tests).
- **Departures from the plan and Context.**
  - **Strg+Enter with a marked suggestion is tested in both files.**
    Context put it only in `EntryForm.test.tsx`. Picking the marked
    suggestion is `EntryRouteChips`' own decision, so it is also tested
    there, while `EntryForm` keeps the merge test.
  - **Assertions dropped while moving.** Context said "from `remembered`
    'keeps a Weg chosen before the remembered one arrives'". It also
    checked the chip order after `operationId` changed in place.
    `useEntryRouteMemory.test.ts` › "keeps each Gesamteinsatz apart"
    holds that. The live-entry test no longer checks the Von/An/Weg
    line, which `JournalEntry.test.tsx` holds.
  - **New small tests of existing behaviour.** These were added while
    moving, inside the files this ticket owns:
    - trimming the text, and only spaces counting as no text
    - "offers no Abbrechen without onCancel"
    - the preset Weg arriving later
    - "shows nothing without one" for the error
- **Departures from a nudge.** None. There are five fewer jsdom test
  files. `npm test` took 41-58 s, against 41-43 s before, on a box also
  running coverage and reviews.
