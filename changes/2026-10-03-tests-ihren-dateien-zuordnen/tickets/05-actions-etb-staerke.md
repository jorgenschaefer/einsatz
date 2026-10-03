---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-5, AC-6, AC-8, AC-9, AC-11, AC-12
after:     04-actions-ebenen-bilder
status:    ready
attempts:  0
---

## Build
The test files of `journal-actions.ts` and `strength-actions.ts` run the
three action checks, each absorbs its `*.validation.test.ts`, and - with
every action module now checked in its own test file -
`server-actions.validation.test.ts` and the `bad-calls` table files are
deleted.

## Done when
Toward AC-1 and AC-2: `journal-actions.ts` and `strength-actions.ts` each
have exactly one test file; `journal-actions.validation.test.ts`,
`strength-actions.validation.test.ts`, `src/app/server-actions.validation.test.ts`
and the table files `src/test/bad-calls/operations-accounts.ts`, `map.ts`
and `journal-strength.ts` are gone.

Toward AC-3: no test file checks the actions of more than one module for
bad input.

Toward AC-5: the two modules each have a test file.

Toward AC-6: the test files of `journal-actions.ts` and `strength-actions.ts`
name every export and check login, bad input and the other-Einsatz rule
(the actions taking only an entry, Stelle or report id declared as taking
no Einsatz-ID; `addJournalEntryAction`, `createStationAction` and
`reportTotalStrengthAction` as taking only the Einsatz-ID), failing when the
module has an export the test file does not name.

Toward AC-8: every bad call of `server-actions.validation.test.ts`, for
every action, runs in the test file of the action's module.

Toward AC-9: neither test file is over 500 lines.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

Toward AC-12: if `strength-actions.ts` is split, every action behaves and
answers as before; only the module boundary moves.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-2** No source file has more than one test file. A source file may have none.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-5** Every server action module (a module whose first statement is `"use server"`), every route handler (`route.ts`) and every page (`page.tsx`) under `src/app/` has a test file, and `npm run check` fails when one has none.

> **AC-6** The test file of every server action module names every export of the module and checks for each:
> - that it requires login, unless the test file declares it public (today `loginAction` and `logoutAction`); for admin-only exports, that an anonymous caller is sent to the login and a logged-in non-admin is refused. Admin-only are the exports of `src/app/admin/users/actions.ts`, `deleteOperationAction`, and every later export the test file declares admin-only;
> - that it rejects bad input and stores nothing, unless the test file declares that it takes no input (today `logoutAction` and `logoutOtherSessionsAction`);
> - for modules under `src/app/operations/[id]/`, that given the Einsatz-ID of one Einsatz and an object of another, it rejects the call and changes nothing - unless the test file declares that the export takes only the Einsatz-ID, or takes no Einsatz-ID (today the journal and strength actions that take only an object id, and `geocodeAddressAction`).
>
> `npm run check` fails when such a test file leaves out one of these checks for an export, and when the module has an export the test file does not name.

> **AC-8** For every check in AC-6 and AC-7, every action and route that was checked for it before the change is still checked for it after the change.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> The helpers take the whole module - for example `expectEveryActionRequiresLogin(module)` - and check that their tables name exactly the module's exports, like the test "names every exported server action, and nothing else" in `src/app/server-actions.validation.test.ts` does today for all modules.

> Mocks (`next/headers`, `next/navigation`, `@/server/db/pg`) stay at the top of each test file, because `vi.mock` is only hoisted in the test file itself. The helpers do not mock.

> The tables in `src/test/bad-calls/` move to the test files of their modules.

> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Tickets 02-04 built the three helpers in `src/test/action-checks.ts` and
  copied every other module's table entries into its own test file.
- `journal-actions.ts` (49): `addJournalEntryAction` (Einsatz-ID),
  `correctEntryAction`, `annulEntryAction` (entry id only). Tests:
  `journal-actions.test.ts` 139, `journal-actions.validation.test.ts` 171.
- `strength-actions.ts` (72): `createStationAction`,
  `reportTotalStrengthAction` (Einsatz-ID); `renameStationAction`,
  `recordStrengthReportAction` (Stelle id); `correctStrengthReportAction`
  (report and Stelle id); `annulStrengthReportAction` (report id). Tests:
  `strength-actions.test.ts` 345, `strength-actions.validation.test.ts`
  205 - together over 500. Shorten first: validation cases that are table
  entries (`entryContentCalls`, `stationNameCalls`, `strengthValuesCalls` in
  `src/test/bad-calls/journal-strength.ts` already generate most of them)
  collapse into the table; repeated setup into helpers. Only if the file is
  still over 500 lines, split `strength-actions.ts` along its two halves
  (Stellen: create/rename; Meldungen: record/correct/annul/total) together
  with its test, in a commit of its own before the test moves, and add the
  split to `coverage-splits.json` in this change's directory. Each half is
  then its own `"use server"` module: it needs its own test file running
  all three action helpers with its own tables, and
  `src/app/operations/[id]/page.tsx` - the only file importing
  `strength-actions` - imports from the two new modules.
- Both validation tests use `src/test/journal-and-strength.ts`
  (`aJournalAndStrength`, `journalAndStrength` snapshot); keep using it.
- `server-actions.validation.test.ts` checks completeness over all modules.
  Before deleting it, confirm every entry of the three table files appears
  in some module's test file (a script or a careful diff; name the method
  in Left standing). `src/test/server-action-modules.ts` stays - ticket 23's
  check uses it. `bad-call.ts` and `fixture.ts` stay.
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
1. `journal-actions.test.ts`: the three helpers with the journal entries,
   then merge `journal-actions.validation.test.ts` into it and delete it.
   Proof: green; drop `requireEntryContent` from `addJournalEntryAction`'s
   path by hand and see a bad call fail; restore.
2. `strength-actions.test.ts`: the three helpers with the strength entries,
   merge `strength-actions.validation.test.ts`, shorten to under 500 lines
   (split source and test only if shortening is not enough, as under
   Context). Proof: green; `wc -l` under 500.
3. Remove the entries of these two modules from `auth-enforcement.test.ts`;
   its action lists are then empty - remove them and the action-only
   helpers, leaving the route part for tickets 06 and 07. Proof: green.
4. Confirm every bad call of the three table files runs in a module test,
   then delete `server-actions.validation.test.ts` and the three table
   files, and list each deleted table file as `[]` in `coverage-splits.json`
   in this change's directory (deleted on purpose). Proof: `npm run check` green; the coverage comparison names no file.

## Not here
- Route handlers and the rest of `auth-enforcement.test.ts` (tickets 06, 07).
- `JournalPanel` and `StrengthPanel` tests (tickets 17-19).
- The check in `npm run check` that action test files call the helpers
  (ticket 23).
- No change to the actions' behaviour.

## Left standing
