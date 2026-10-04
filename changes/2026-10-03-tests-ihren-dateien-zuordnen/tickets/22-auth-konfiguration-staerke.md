---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11, AC-12
after:     01-coverage-ausgangswert
status:    done
attempts:  1
---

## Build
The remaining misnamed and doubled test files: `attempt-login`,
`password-cost` and `account-admin.input` merge into the tests of `login.ts`,
`password.ts` and `account-admin.ts`; `security-headers.test.ts` becomes
`next.config.test.ts`; `harness.test.tsx` merges into `render.test.tsx`;
and `strength.ts` is split so its two test files each have their own file.

## Done when
Toward AC-1 and AC-2: `src/server/auth/attempt-login.test.ts`,
`password-cost.test.ts`, `account-admin.input.test.ts`,
`src/security-headers.test.ts`, `src/test/harness.test.tsx` and
`src/strength/strength.cyclassics.test.ts` are gone;
`next.config.test.ts` sits next to `next.config.ts` and runs in
`npm test`; `strength.ts` and the file split off it each have one test
file.

Toward AC-3: each Cyclassics case is in the test of the file whose
function it checks - `latestValidReport`, `stationHistory` and
`formatStrength` cases in `strength.test.ts`, `totalOf`, `totalHistory` and
the stale checks in `strength-total.test.ts` - with the recorded data set
shared as a fixture, not duplicated.

Toward AC-9: the `strength.ts` tests are under 500 lines per file.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

Toward AC-12: the Stärke figures are computed as before; the split only
moves functions between files.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-2** No source file has more than one test file. A source file may have none.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> `src/security-headers.test.ts` becomes `next.config.test.ts` at the repository root; the `include` of the node project in `vitest.config.mts` must then cover it, or it silently stops running.

> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- `src/server/auth/login.ts` (66: `authenticate`, `attemptLogin`,
  `createSession`): `login.test.ts` 128 + `attempt-login.test.ts` 102
  (`attemptLogin` with `LoginRateLimiter`). Merged ≈ 225.
- `src/server/auth/password.ts` (48): `password.test.ts` 62 +
  `password-cost.test.ts` 25. The global setup `src/test/fast-bcrypt.ts`
  mocks `bcryptjs` so `hash`/`hashSync` ignore the cost argument and use 4;
  `password-cost.test.ts` calls `vi.unmock("bcryptjs")` (hoisted, file-wide)
  to see the real factor 12. Merging must not make every password test pay
  real bcrypt: pin the factor by the cost argument `password.ts` passes to
  bcrypt instead (a spy on the mocked `hash`; for `DUMMY_PASSWORD_HASH`,
  which `password.ts` computes with `hashSync` at module load, a spy set up
  before a fresh import), and check the legacy cost-10 hash with
  `vi.importActual("bcryptjs")`. Update the comment in `fast-bcrypt.ts`,
  which names `password-cost.test.ts`.
- `src/server/auth/account-admin.ts` (139): test 262 + `.input` 90 (it.each
  over non-text inputs, role, password). Merged ≈ 350.
- `src/security-headers.test.ts` (36) tests `/next.config.ts` (headers on a
  page / a route / a static asset, `poweredByHeader`, `serverActions`
  `bodySizeLimit`, `proxyClientMaxBodySize`). The node project in
  `vitest.config.mts` includes only `src/**/*.test.ts`; add
  `next.config.test.ts` to its `include`.
- `src/test/harness.test.tsx` (12) has one test, "renders a Mantine component
  through the provider" - a test of `render` in `src/test/render.tsx`;
  `render.test.tsx` (21) is that file's test.
- `src/strength/strength.ts` (159): lines 1-54 sum / format / latest /
  `stationHistory`; lines 55-159 `totalOf`, `totalHistory`,
  `isReportStale`/`isTotalStale`, `formatTotalStrengthText`,
  `berlinTimeOfDay`. `strength.test.ts` 431 + `strength.cyclassics.test.ts`
  235 (a recorded data set of 4 Stellen × 13 reports through
  `latestValidReport`, `totalOf`, the stale checks, both histories,
  `formatStrength`) ≈ 666. Seam: lines 55-159 into
  `src/strength/strength-total.ts`, in a commit of its own, with the
  coverage-splits entry in
  `changes/2026-10-03-tests-ihren-dateien-zuordnen/coverage-splits.json`.
  The Cyclassics data set moves into a fixture file (for example
  `src/strength/cyclassics.fixtures.ts`), and each of its cases goes to the
  test of the file whose function it checks: "shows the 20:00 report as each
  Stelle's latest" and "lists each Stelle's 13 reports newest first" stay
  with `strength.ts`, the totals, total history and stale checks go with
  `strength-total.ts`.
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
1. Merge `attempt-login.test.ts` into `login.test.ts` and
   `account-admin.input.test.ts` into `account-admin.test.ts`. Proof: green.
2. Merge `password-cost.test.ts` into `password.test.ts` as under Context;
   update the `fast-bcrypt.ts` comment. Proof: green; change `BCRYPT_COST`
   to 10 by hand and see the cost tests fail; restore.
3. Move `src/security-headers.test.ts` to `next.config.test.ts` and add it to
   the node project's `include`. Proof: `npx vitest run next.config.test.ts`
   runs its tests; `npm test` lists it.
4. Merge `harness.test.tsx` into `render.test.tsx`. Proof: green.
5. Split `strength.ts` (lines 55-159 into `strength-total.ts`), its own
   commit; then move the total tests into `strength-total.test.ts`, the
   Cyclassics data set into a fixture, and each Cyclassics case to the test
   of the file it checks; delete `strength.cyclassics.test.ts`. Proof: `npm run check` green; both test files
   under 500; the coverage comparison names no file.

## Not here
- Other server modules (ticket 21); the Stärke panel (ticket 19).
- No change of behaviour, of the bcrypt cost, or of the security headers.

## Left standing
- **Review findings not fixed.** One round. It found no blockers and nothing
  to fix, and one nit, which I left:
  - nit: `berlinTimeOfDay` now lives in `strength-total.ts`, so code about
    a single Stelle (`ReportForms.tsx`, `StrengthPanel.tsx`,
    `StrengthHistories.tsx`, `strength.test.ts`) imports the totals module
    to format a clock time. The plan put lines 55-159 (which include it)
    into `strength-total.ts`. Moving it somewhere else is a separate
    restructuring.
- **Checks.** `npm run check` green (195 files, 2677 tests, the same count
  as before). `npm run test:coverage` plus `compare-coverage.mjs` exit 0.
  The comparison does not name *no* file, as the ticket asks: it names
  ten files as "new, compared with nothing". One of them,
  `src/strength/cyclassics.fixtures.ts`, is from this ticket. It is the
  Cyclassics data set taken out of a test file, not split from a baseline
  source file, so it has no `coverage-splits.json` entry. The other nine
  are the fixtures and `src/test/` helpers from earlier tickets that
  ticket 21 also left. No file needed a new test file. The split of
  `strength.ts` has its entry in `coverage-splits.json`.
- **Advanced without an automated test.**
  - AC-11: the commit body's `Removed tests:` section lists all 52 names
    `removed-tests.mjs` reported. Each one points to a test that now holds
    it, and each removed test maps to exactly one added test. No test is
    gone. For the password cost tests, which changed how they check, I
    broke `password.ts` by hand: with `BCRYPT_COST` set to 10, both cost
    tests failed. With only the `hashSync` call for `DUMMY_PASSWORD_HASH`
    set to 10, "uses the same cost factor for the dummy timing-equalizer
    hash" failed. Restored both times.
  - AC-12: the only production changes are the move of lines 55-159 of
    `strength.ts` into `strength-total.ts` (verbatim, in their own commit;
    the reviewer diffed the two) and the import lines of its callers.
  - `next.config.test.ts` runs in `npm test`: `removed-tests.mjs` (which
    collects with `vitest list`) lists its five tests as added, and the
    total test count is unchanged.
- **AC-3 review list.** This ticket created `strength-total.test.ts` and
  `next.config.test.ts` (the latter moved from `src/security-headers.test.ts`;
  every test checks `next.config.ts`). I held every test in
  `login.test.ts`, `password.test.ts`, `account-admin.test.ts`,
  `render.test.tsx` and `strength.test.ts` against its own file. All seven
  are added to `ac3-reviewed.txt`.
- **Departures from the plan.**
  - Step 5: the stale-check Cyclassics case in `strength-total.test.ts`
    still picks each Stelle's latest report with `latestValidReport` from
    `strength.ts`, as it did before. Its assertions are only on
    `isReportStale`/`isTotalStale`.
  - The test merges for steps 1-4 and step 5's test moves are in one
    commit with the ticket, rather than one commit per step. The split of
    `strength.ts` has its own commit, as the plan says.
  - In `account-admin.test.ts`, the moved input checks are spread over the
    `describe` of the function they call. The three "Nutzer-ID that is not
    a UUID" cases sit in their own `describe` and are renamed to fit it
    (for example "refuses setting a role"). They now seed with the file's
    `seedAdmin` instead of their own `withAnna`.
- **Departures from a nudge.** None. The nudge to shorten tests first did
  not apply: no file came near 500 lines (`strength-total.test.ts` 407,
  `account-admin.test.ts` 342).
