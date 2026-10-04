---
criteria:  CRITERIA.md
closes:    AC-1, AC-2, AC-8, AC-9, AC-10, AC-11, AC-12
advances:
after:     23-pruefungen, 31-pruefen-app-rest
status:    done
attempts:  1
---

## Build
The audit of the finished change: every test file paired, every check of the old tests over many files still made, no file
over 500 lines, no coverage lost, every removed test accounted for, and no
behaviour changed. Each gap found is fixed here.

## Done when
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-2** No source file has more than one test file. A source file may have none.

> **AC-8** For every check in AC-6 and AC-7, every action and route that was checked for it before the change is still checked for it after the change.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-10** For every source file, the share of covered lines and the share of covered branches, measured with `@vitest/coverage-v8`, are no lower after the change than on the commit the change starts from. A source file that was split is compared by adding up the covered and total lines and branches of its parts.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Measure the coverage baseline on the commit the change starts from and keep it in this directory. Add `@vitest/coverage-v8` as a dev dependency and a `test:coverage` script; do not add it to `npm run check`.

> Write each commit's record of removed tests (AC-11) from a list of the test names that disappeared - `vitest list` before and after, which also catches `it.each` rows and renamed tests - made before committing, so a missing record is found when the commit is made, not at the end of the change. The script that makes the list sits beside the coverage comparison and also compares two commits.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Tickets 02-22 and 25-31 moved the tests; ticket 23 added `checkTestFiles` in
  `src/test/test-files.ts`, run by `src/test/test-files.test.ts` against
  `git ls-files` - with it green, AC-1 and AC-2 hold mechanically.
- The change started on the commit in
  `changes/2026-10-03-tests-ihren-dateien-zuordnen/start-commit.txt`; the
  coverage baseline (`coverage-baseline.json`), `coverage-splits.json` and
  `compare-coverage.mjs` and `removed-tests.mjs` are beside it (ticket 01).
- What tickets 02-22 and 25-31 were told for AC-11: each commit that removes or
  merges tests has a `Removed tests:` section in its body, one line per
  removed test, `- <old file> › <describe> › <it>` and `→ <new file> ›
  <it>` or `→ gone: <why>; broke <behaviour> by hand, <test that failed>
  failed`; and before each such commit they ran `removed-tests.mjs` and
  put every name it listed as removed into that section.
- Before this change, checks of the kinds AC-6 and AC-7 name lived in
  many test files, not only the ones over many files. Find them across
  every test file at the start commit (`git grep` at `<start>` for login
  redirects and 401/403 answers, bad-input and "Ungültige ID." cases,
  "nicht gefunden" other-Einsatz cases, non-UUID 404s and upload limits).
  Known places: `src/app/auth-enforcement.test.ts`,
  `src/app/server-actions.validation.test.ts` (with
  `src/test/bad-calls/*.ts`), `src/app/operations/[id]/map-actions.validation.test.ts`,
  `src/app/operations/[id]/foreign-operation.test.ts`,
  `src/app/operations/[id]/uploads.test.ts`,
  `src/app/overlay-routes.not-a-uuid.test.ts`, the `actions.validation.test.ts`
  files of `account/`, `admin/users/`, `login/` and `operations/`,
  `journal-actions.validation.test.ts`, `strength-actions.validation.test.ts`,
  `device/[token]/overlays/[overlayId]/route.test.ts` and
  `view/[token]/geocode/route.test.ts` (403 without access), and
  `operations/[id]/overlays/[overlayId]/route.put.test.ts` (the
  other-Einsatz `PUT` case). The shared checks now live in
  `src/test/action-checks.ts`, `route-checks.ts` and `page-checks.ts`,
  called from each entry point's test file.
- Each step below fixes the gaps it finds in this ticket. A gap too large to
  fix in this session (more than a few tests or files) halts the ticket
  naming the gap - it does not close the AC with the gap reported.

## Plan
1. AC-1, AC-2: `npm run check` green, including `test-files.test.ts`.
   Proof: the run.
2. AC-8: for each check, list the actions and routes any test file checked
   for it at the start commit (found as under Context, not only in the
   known places), and confirm each is checked for it now (the
   helpers' tables and calls in the route and action tests). Proof: the
   comparison method and its result in Left standing; any gap fixed.
3. AC-9: `git ls-files '*.ts' '*.tsx' | xargs wc -l` lists nothing over
   500. AC-10: `npm run test:coverage`, then `compare-coverage.mjs` names no
   file. Proof: both outputs clean; any drop fixed by restoring the lost
   test.
4. AC-11: for every commit since the start commit that touches a test,
   fixture or `src/test/` file, run `removed-tests.mjs <commit>^ <commit>`
   (ticket 01) - it also catches rows removed from `it.each` /
   `describe.each` tables and bad-call tables, which a search for `it(`
   lines misses - and check its body names each test name that disappeared
   as agreed (a renamed test counts as moved). Every ticket ran the same
   script before each commit, so this is a safety net, not the first look.
   Proof: the list of commits checked, in Left standing. A commit missing
   its record halts this ticket naming the commit and the tests it removed
   without a record: AC-11 asks for the record in the commit, and only the
   user can decide whether branch commits are reworded.
5. AC-12: read `git diff <start>..HEAD -- src next.config.ts
   ':(exclude)*.test.*' ':(exclude)src/test'` and confirm it only moves
   code between files and updates imports. Proof: the verdict in Left
   standing; any behaviour change reverted.

## Not here
- Building or changing the check (ticket 23); reviewing what each test
  tests (AC-3, tickets 26-31).
- From `CRITERIA.md`'s Out of scope: mutation testing, and any change of
  behaviour.

## Left standing
- **AC-11 accepted with one incomplete record (user's decision).** Step 4
  ran `removed-tests.mjs <c>^ <c>` for all 54 commits since the start
  commit. In 53, every removed name has a `- <name>` line with a `→` line.
  5523958 "Time the KML scanners with one run against a limit" does not:
  its record covers the five `kml-fetch.test.ts` timing tests only as two
  `%s` templates, and it has no lines for the 17 `kmz.test.ts` tests it
  renamed in place ("at most twice as slowly as ordinary KML" → "in linear
  time", with larger inputs). Each renamed test pairs one-to-one with an
  added test in the same file, and the commit's prose describes the change.
  The user chose to keep the record as written rather than reword 5523958
  and rebase the eight commits after it.
- **Checks run.** `npm run check` is green after the halt (199 files, 2689
  tests).
- **Results of the other steps** (from the first attempt, unchanged):
  - AC-1, AC-2: `npm run check` is green: 199 files, 2689 tests, including
    `test-files.test.ts`.
  - AC-8: every action and route keeps every kind of check it had at the
    start commit. The comparison was made per entry point, and per action
    for each distinct expected bad-input answer. There were 42 action
    exports and 12 route methods, the same at both ends. Some checks were
    narrowed, but each entry point still has a check of the same kind:
    - expired session: only `createOperationAction`, now in `sessions.test.ts`
    - position route: the 5 s denials, now in `map-symbols.test.ts`
    - the `../escape` Einsatz-ID: now in `image-overlay-uploads.test.ts`
    - the 201-character name, view-geometry and JSON/HTML-as-KML rows: moved
      to the server module tests
    - KML URL bad calls: no longer assert that nothing was fetched
    - the at-limit KML and own-origin acceptance: now in `upload-route.test.ts`
  - AC-9: no tracked `.ts`, `.tsx` or `.mjs` file is over 500 lines. The
    largest is 499.
  - AC-10: after `npm run test:coverage`, `compare-coverage.mjs` exits 0
    and reports no drop. It names only twelve new test helpers and
    fixtures.
  - AC-12: the production diff since the start commit (`src`, excluding
    tests, `src/test` and fixtures) only moves code and updates imports.
    `SESSION_TTL_MS` lost its `export`. One condition in `JournalEntry` was
    rewritten as `!correction`; `JournalPanel` passes `editingId ===
    entry.id && <EntryForm/>`, so the condition is equivalent.
