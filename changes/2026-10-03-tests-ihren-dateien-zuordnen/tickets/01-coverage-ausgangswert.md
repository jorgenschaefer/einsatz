---
criteria:  CRITERIA.md
closes:
advances:  AC-10, AC-11
after:
status:    done
attempts:  1
---

## Build
Coverage measurement for the whole test suite, and the baseline it is
compared against: per-file line and branch coverage of the tree as it is
before any test of this change moves, stored in this change's directory,
with a script that reports every source file whose coverage dropped; and
a script that lists the tests a change removes, so each later commit can
name them as AC-11 asks.

## Done when
Toward AC-10: `npm run test:coverage` measures line and branch coverage per
source file with `@vitest/coverage-v8`; the coverage of the tree before any
test was changed is stored as the baseline in this change's directory; and
one command compares a fresh measurement against the baseline, adding up
the parts of files listed as split, and names every source file whose share
of covered lines or branches dropped. Run right after this ticket, it names
none.

Toward AC-11: one command lists, for the working tree against `HEAD` or for
one commit against another, every test name that disappeared, in the
line format of the `Removed tests:` record, and every test name that
appeared. It catches a removed `it.each` or `describe.each` row and a
renamed test. Run on an unchanged tree, it lists nothing.

## Toward
> **AC-10** For every source file, the share of covered lines and the share of covered branches, measured with `@vitest/coverage-v8`, are no lower after the change than on the commit the change starts from. A source file that was split is compared by adding up the covered and total lines and branches of its parts.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

## Nudges
> Measure the coverage baseline on the commit the change starts from and keep it in this directory. Add `@vitest/coverage-v8` as a dev dependency and a `test:coverage` script; do not add it to `npm run check`.

> Write each commit's record of removed tests (AC-11) from a list of the test names that disappeared - `vitest list` before and after, which also catches `it.each` rows and renamed tests - made before committing, so a missing record is found when the commit is made, not at the end of the change. The script that makes the list sits beside the coverage comparison and also compares two commits.

## Context
- No coverage tooling exists: `package.json` has `vitest` 5.0.2 and no
  `@vitest/coverage-*`. `npm run check` is `tsc --noEmit && npm run lint &&
  npm test`; it stays unchanged.
- `vitest.config.mts` has two projects, `dom` (jsdom, `src/**/*.test.tsx`
  plus `browserTestsInTs`) and `node` (`src/**/*.test.ts`). Coverage is
  configured once at the top level of `test`, not per project.
- DB tests need the test Postgres: `docker compose -f
  docker-compose.test.yml up -d`. Without it `freshDb` throws and the run
  fails; a failed run must not become a baseline.
- Later tickets of this change split source files (for example
  `src/server/journal/journal.ts` into `journal.ts`, `correspondents.ts`
  and `journal-history.ts`). AC-10 compares a split file as the sum of its
  parts, so the comparison needs to know which files a baseline file became.
  Decided here: a file `coverage-splits.json` in this change's directory,
  mapping each baseline path to the list of paths it was split into
  (`{"src/server/journal/journal.ts": ["src/server/journal/journal.ts",
  "src/server/journal/correspondents.ts", ...]}`), empty to begin with. Every
  ticket that splits a source file adds its entry. A file renamed or moved
  is an entry with one path. A source file deleted on purpose (for example
  the `src/test/bad-calls/` tables ticket 05 deletes) is an entry with an
  empty list, `[]`, and the comparison skips it.
- Decided here: the `json-summary` reporter keys files by absolute path.
  The comparison works on paths relative to the repository root: the
  stored baseline is rewritten to relative keys, `coverage-splits.json`
  uses relative paths, and the script makes a fresh summary's keys relative
  before comparing - so the baseline works from any worktree.
- Decided here: the comparison is a plain Node script in this change's
  directory (`compare-coverage.mjs`), not part of `src/`, because it exists
  only for this change and is deleted with it.
- Decided here: `ac3-reviewed.txt` in this change's directory, empty to
  begin with, one repository-relative path per line. A later ticket adds
  a test file only if it created it or held every test in it against its
  own file; the review tickets for AC-3 (26-31) skip the files listed.

- Decided here: the removed-test list is a second Node script beside
  `compare-coverage.mjs`, `removed-tests.mjs`. With no arguments it
  compares `HEAD` with the working tree (staged or not); with two commits
  it compares those - ticket 24 runs it once per commit. It collects test
  names with `npx vitest list --json` (names of every `it`, including each
  row of an `it.each` / `describe.each` table) in the working tree, and for
  a commit in a temporary `git worktree` at that commit with
  `node_modules` linked from the main tree, removed afterwards. It prints
  each disappeared name as `- <file> › <describe> › <it>` - ready to paste
  under `Removed tests:` and complete with its `→` line - then the added
  names, which show where a moved or renamed test went. Every later ticket
  runs it before each commit that touches a test, fixture or `src/test/`
  file, so a missing record is caught when the commit is made, not in
  ticket 24.

## Plan
1. Add `@vitest/coverage-v8` (the version matching `vitest` 5.0.2) as a dev
   dependency, a `coverage` block in `vitest.config.mts` (provider `v8`,
   `include: ["src/**/*.{ts,tsx}", "next.config.ts"]`, excluding only
   `**/*.test.*` - AC-10 covers every source file, test helpers in
   `src/test/` and fixtures included, since later tickets move tests of
   them too; reporters
   `json-summary` and `text-summary`, `reportsDirectory: "coverage"`), and
   a script `"test:coverage": "vitest run --coverage"` in `package.json`.
   (`/coverage` is already in `.gitignore`.) Proof: `npm run test:coverage` writes
   `coverage/coverage-summary.json` with an entry per source file.
2. Write `changes/2026-10-03-tests-ihren-dateien-zuordnen/compare-coverage.mjs`
   (new): reads `coverage-baseline.json` and `coverage-splits.json` next to
   it and `coverage/coverage-summary.json`; for each baseline file, adds up
   `lines.covered/total` and `branches.covered/total` over its parts (itself
   when not listed, nothing when listed as `[]`), all keys relative to the
   repository root; prints each file whose share of covered lines or
   branches is lower than in the baseline, and a baseline file whose parts
   are all missing unless it is listed as `[]`; exits non-zero when it
   printed any. Proof: run it with a hand-made summary keyed by absolute
   paths, in which one file dropped, one file is split and one is listed as
   `[]`, and see it name the first, add up the second and skip the third;
   then delete the hand-made files.
3. Write `changes/2026-10-03-tests-ihren-dateien-zuordnen/removed-tests.mjs`
   (new) as decided under Context. First confirm that `npx vitest list`
   collects every test without the test Postgres running; if collecting
   needs it, say so in the script's usage line. Proof: on an unchanged tree
   it lists nothing; rename one test, delete one row of an `it.each` table
   and move one test to another file by hand, and see it list the three
   old names as removed and the new names as added; revert. Then run it
   with two commits (`HEAD~1 HEAD`) and see the temporary worktree gone
   afterwards.
4. Measure and store the baseline: run `npm run test:coverage` on the tree
   as it is, with the test DB up and every test passing, copy
   `coverage/coverage-summary.json`, with its keys made relative to the
   repository root, to `coverage-baseline.json` in this change's directory,
   create `coverage-splits.json` as `{}` and an empty `ac3-reviewed.txt`,
   and write the
   hash of the commit the measurement ran on (`git rev-parse HEAD`, before
   this ticket's own commit) to `start-commit.txt` beside them - ticket 24
   audits every commit after it. Then run `npm run test:coverage` a second
   time and compare it against the baseline: timing-dependent code
   (`sse.ts` heartbeats, rate gates, coalescing) can cover a line or branch
   only sometimes, and every later ticket must see "no file" on an
   unchanged tree. If any file differs, take the per-file minimum of
   covered lines and branches over three runs as the baseline, and note in
   Left standing which files varied. Proof:
   `node changes/2026-10-03-tests-ihren-dateien-zuordnen/compare-coverage.mjs`
   prints nothing and exits 0.
5. `npm run check` stays green.

## Not here
- No coverage threshold and no coverage run in `npm run check` - out of
  scope for this change.
- No test is moved or changed; every other ticket of this change comes after
  this one so the baseline sees the tree as it was.
- The final comparison against the finished tree is ticket 24's.

## Left standing
- **Review findings not fixed.** Round 2, nit: no test pins the worktree
  cleanup of `removed-tests.mjs` on failure or Ctrl-C. It is a thin wrapper
  over git and `npx vitest list`, and I checked it by hand: a bad commit
  name, and SIGINT during `vitest list`, both leave no worktree and no
  `/tmp/removed-tests*` directory behind.
- **Fixes made after the last review round, not reviewed again.** Round 2's
  should-fix said a new file under `src/test/` (a shared helper, say) would
  fail the comparison with no fix available. Now `compare-coverage.mjs`
  still names such a file ("new, compared with nothing - if it was split
  out of a baseline file, list it …") but exits 0 for it. A drop, a
  missing file or part, a `coverage-splits.json` key that is not in the
  baseline, or a value that is not a list still exits 1. Also fixed after
  round 2: two nits (an entry that is not a list is now named instead of
  crashing, and an interrupted child is reported as "stopped (SIGINT)").
- **Checks not run.** I did not rerun `npm run check` after those last
  edits. They touch only `changes/`, which biome excludes and vitest does
  not collect. The scripts' own tests are not part of `npm run check`. Run
  them with `node --test changes/2026-10-03-tests-ihren-dateien-zuordnen/*.test.mjs`
  (22 pass).
- **Advanced without an automated test (AC-10, AC-11).** `node:test` pins
  the comparison and listing logic. I checked these by hand:
  - `npm run test:coverage` writes a summary with an entry for every
    source file.
  - `compare-coverage.mjs` on a fresh run names nothing and exits 0.
  - On a hand-made summary, `compare-coverage.mjs` names the dropped
    file, sums the split one and skips the `[]` one.
  - `removed-tests.mjs` prints nothing on the unchanged tree.
  - `removed-tests.mjs` lists the old names as removed and the new ones
    as added, for a renamed test, a deleted `it.each` row, a test moved to
    another `describe`, and a test moved to another file.
  - `removed-tests.mjs HEAD~1 HEAD` runs and removes its worktree.
- **Departures from the plan.**
  - `test:coverage` is `vitest run --coverage --testTimeout=30000`, not
    plain `vitest run --coverage`. With coverage, under parallel load,
    two tests regularly took longer than the default 5 s and failed:
    - `kml-actions.icons.test.ts` › adds at most 20 MB …
    - `kml-actions.timing.test.ts` › … 20,000 spaces … as a KMZ
    In 3 runs out of 3, at least one of them failed. Each takes about
    2 s when run alone. `npm test` is unchanged.
  - Not in the baseline: vitest leaves the three `setupFiles` (`src/test/fail-on-console.ts`,
    `src/test/fast-bcrypt.ts`, `src/test/setup.ts`) out of coverage itself,
    so the baseline has every other source file (229 plus `total`).
  - Baseline: three runs gave identical coverage for every file, so it is
    the first run, not a per-file minimum. No file varied.
  - `removed-tests.mjs` collects with `vitest list --no-staticParse`. The
    default static parse does not expand `it.each` rows (1930 instead of
    2773 tests). Collecting needs no test Postgres, so the usage line says
    nothing about it.
  - The comparison also names a split whose parts are only partly in the
    measurement, not just one whose parts are all missing.
- **Departures from a nudge.** None.
