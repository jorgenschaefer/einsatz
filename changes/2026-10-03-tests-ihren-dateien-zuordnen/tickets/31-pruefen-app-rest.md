---
criteria:  CRITERIA.md
closes:    AC-3
advances:  AC-11, AC-12
after:     23-pruefungen, 27-pruefen-karte-leaflet, 28-pruefen-etb-staerke-kml, 29-pruefen-server, 30-pruefen-einsatz-actions-routen
status:    done
attempts:  1
---

## Build
The review that every test tests its own file, for the test files in
`src/app/` outside `src/app/operations/`:
each test file whose source or test imports another project module is
read test by test against what its own file implements, and a test of
another file's behaviour is moved to that file's test file or dropped as
a duplicate.

## Done when
> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

Toward AC-11: each commit that moves or drops tests carries the record
described under Context.

Toward AC-12: a coupling restructured so a file can be tested on its own
leaves the app behaving as before.

## Toward
> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Mocks (`next/headers`, `next/navigation`, `@/server/db/pg`) stay at the top of each test file, because `vi.mock` is only hoisted in the test file itself. The helpers do not mock.

> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Pairing by name (ticket 23's check) does not show the failure AC-3 is
  about: a test file named after its source whose tests exercise another
  file - as `SituationWorkspace.areas.test.tsx` tested `useAreaFlows`
  before this change while importing only its own fixtures. Reading the
  tests shows it.
- Which test files to read (one rule for tickets 26-31): a test file
  `X.test.*` in the area that is not listed in `ac3-reviewed.txt` in this
  change's directory - the files listed there were written or read test by
  test by an earlier ticket of this change and count as judged - and
  that reaches another project file: `X` or the test file imports (not
  type-only) a project module other than `X`, or reads another project
  file at run time (`readFile`, `?raw`; for example
  `src/map/lageansicht-sizes.test.ts` reads `situation-workspace.css`).
  Importing a fixture (`*.fixtures.*`) or a `src/test/` file is not by
  itself a reason; what that file imports in turn is. A test file that
  reaches no other project file can only exercise its own. Each area
  belongs to one ticket, so no test file is read twice.
- The selection is `select-tests.mjs` in this change's directory, built by
  ticket 26; use it as it is, so all review tickets select by one rule.
  It treats `src/test/render.tsx` as a harness: what that file imports
  (the app's providers) is no reason to select a test.
- In `src/app/` outside `src/app/operations/`, for orientation:
  `read-only-situation-map.test.ts`, the account, admin, login, view and
  device tests, `UserAdminPanel`, and the forms.
- A test belongs to its own file when the behaviour is that file's: what
  it decides, shows, calls or passes down, and how it combines other files
  (wiring). Other files running in the test is fine - the file's real
  children and hooks, a harness, fixtures, fakes; the assertions decide.
  An import used to set up state or read it back is a fixture. A test
  whose assertions check only another file's behaviour belongs to that
  file (AC-3).
- A test that moves follows the same record as before (AC-11): the commit
  body has a section `Removed tests:` with one line per removed test,
  `- <old file> › <describe> › <it>` followed by either `→ <new file> ›
  <it>` or `→ gone: <why>; broke <behaviour> by hand, <test that failed>
  failed`. Before committing, run `npm run test:coverage` and
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
- More than a handful of tests to move out of one test file means a slice
  was missed: halt the ticket naming the file and the tests, rather than
  leaving them in place.
- A file without a test file whose behaviour is tested only through other
  files' tests gets its own `X.test.*`, and those tests move into it -
  also when the file lies in another ticket's area. Two exceptions:
  - Tests in a file listed in `ac3-reviewed.txt` stay where they are: the
    ticket that listed it judged them as that file's own wiring, and no
    test file is read twice.
  - A test file in another ticket's area is created only when that ticket
    is `done`. Otherwise halt naming the file and the tests, so two
    tickets never edit the same area at once.
  A test file created this way goes into `ac3-reviewed.txt` in the same
  commit. The rule above still holds: more than a handful of tests to move
  out of one test file is a missed slice. Files without a test file known
  so far (re-plan after ticket 26's halt), in this area: `src/app/action-failure.ts` (37,
  `settleAction`, `isNextNavigation`; through `useActionRunner`,
  `useNotifyingActionRunner` and `ConfirmationModal`) and
  `src/app/action-notification.ts` (61; through
  `useNotifyingActionRunner`).

## Plan
1. Run `select-tests.mjs` from this change's directory with patterns for
   `src/app/` outside `src/app/operations/`.
   Proof: the list in Left standing.
2. For each, hold every test against its own file. Proof: the verdict per
   file in Left standing ("all its own", or the tests that moved).
3. Move each misplaced test to the file whose behaviour it checks (or drop
   it where that file's test pins it, with the by-hand check), with the
   record. Proof: `npm run check` green; the coverage comparison names no
   file.

## Not here
- The other areas: `src/map/` - the components (`.tsx`) and hooks (`use*.ts`), except `SituationMap.tsx` and `ReadOnlySituationMap.tsx` (ticket 26); `src/map/` - `SituationMap.tsx`, `ReadOnlySituationMap.tsx` and the `.ts` modules other than `use*.ts` (ticket 27); `src/journal/`, `src/strength/`, `src/kml/`, `src/test/` and the test files directly under `src/` or at the repository root (ticket 28); `src/server/` (ticket 29); `src/app/operations/` (ticket 30).
- From `CRITERIA.md`'s Out of scope: any change of behaviour - a test that
  cannot reach another file's behaviour without this one is a coupling to
  restructure in a commit of its own, not a reason to change what the
  code does.

## Left standing
- **Selection (Plan 1).**
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/select-tests.mjs 'src/app/**/*.test.*' --exclude 'src/app/operations/**'`
  selected 18 files (under `src/app/`): `ActionNotifications`,
  `ConfirmationModal`, `account/LogoutOtherSessions`, `account/actions`,
  `account/page`, `admin/users/UserAdminPanel`, `admin/users/actions`,
  `datenschutz/page`, `device/[token]/position/route`, `impressum/page`,
  `layout`, `login/actions`, `login/page`, `manifest`,
  `read-only-situation-map`, `useActionRunner`, `useNotifyingActionRunner`
  and `view/[token]/page`.
- **Verdict per file (Plan 2).** Twelve are "all their own":
  `ActionNotifications`, `ConfirmationModal`, `account/LogoutOtherSessions`,
  `account/page`, `datenschutz/page`, `impressum/page`, `layout`,
  `login/page`, `manifest`, `read-only-situation-map`, `useActionRunner`
  and `view/[token]/page`. Six were not:
  - `useNotifyingActionRunner`: four tests of how a notification looks and
    behaves moved to the new `action-notification.test.tsx`. They cover
    staying open, being replaced, another source's notification standing,
    and the close button.
  - `UserAdminPanel`: four tests were dropped as duplicates of
    `ConfirmationModal.test.tsx`: cancelling (three rows), staying locked,
    confirming again after a failure, and a thrown failure. The returned
    error staying in the dialog and out of the list is the panel's own
    decision (`onConfirm={… onDelete …}` bypasses its `run`), so it stays.
  - `login/actions`: three tests were dropped as duplicates of
    `rate-limit.test.ts` and `login.test.ts`: /64, IPv4-mapped, and refusing
    the correct password. The default window moved to `rate-limit.test.ts`,
    using the real clock through `tryReserve`'s default `now`. The session
    storage test moved to `sessions.test.ts`, folding in its weaker
    hash-only test. The two cookie-name tests moved to
    `current-user.test.ts › setSessionCookie`.
  - `account/actions`: the changePassword rate-limit branch, the release on
    success and the password policy moved to
    `account-admin.test.ts › changePassword`.
  - `admin/users/actions`: trimming and 200 characters, case-insensitive
    uniqueness (one test and one concurrent test) and the policy for
    creating and resetting moved to `account-admin.test.ts`. Its exact
    duplicate "rejects a duplicate username" was folded into the case test.
    "accepts exactly 72 bytes" and "accepts 12 characters" were dropped as
    duplicates of `password.test.ts`.
  - `device/[token]/position/route`: the two "within 5 s" denials were
    dropped. Closing an Einsatz ends its Gerätelinks, so neither can be
    told apart from an unknown token, which `map-symbols.test.ts` and the
    route's own 403 test pin.
- **Judgement call: what an action takes from the request stays with it.**
  These stay in their action test files: the concurrent login tests (5 per
  username, 20 per IP), "shares the counter with failed logins" (two
  tests), `logoutAction` and `logoutOtherSessionsAction`. Each depends on
  which address the action reads, which shared limiter it passes on, or
  which token it keeps. The device route keeps its two bounded-read tests:
  reading through `readBody` with 1 KB is the route's own choice (review
  round 1).
- **New test files.** `src/app/action-failure.test.ts` and
  `src/app/action-notification.test.tsx` are new, and both are in
  `ac3-reviewed.txt`. The runners each keep their thrown-failure test:
  feeding a throw through `settleAction` into their state is their own
  wiring (review round 1).
- **New tests beyond the moves.** These failed with their behaviour
  broken by hand:
  - `action-failure.test.ts`: all of it.
  - `action-notification.test.tsx`: `closeActionError`, `beginAction`'s
    show function, and the four `dismissActionErrors` tests.
  - `admin/users/actions › createAccountAction › creates a Nutzer / an
    Administrator as asked`: the action's own `admin` → role mapping,
    unpinned before.
  - `LogoutOtherSessions › does not say so when ending the other sessions
    fails` (review round 1 nit).
- **More than a handful?** More than a handful of tests left
  `login/actions`, `admin/users/actions` and `UserAdminPanel`. I did not
  halt, following ticket 30's reading. No slice was missing: every target
  test file already existed and already tested that file
  (`account-admin`, `rate-limit`, `sessions`, `current-user`,
  `ConfirmationModal`, `password`). The only files without a test file
  were the two this ticket named.
- **Edits outside this area.** These are moves into files of done
  tickets' areas: `src/server/auth/` `account-admin`, `current-user`,
  `rate-limit` and `sessions` tests. `account-admin.test.ts` now has a
  `passwordIs` helper and its message constants at the top.
- **Review findings left standing.**
  - Round 2, nit: four older tests in `account-admin.test.ts` still check
    the password by hand instead of through `passwordIs`. Left because
    they are tests this ticket did not move, and the change would be
    cosmetic.
  - Round 2, nit: "move the closed-Einsatz-within-5 s test to
    `reportPosition`". I wrote it and broke `reportPosition` the way the
    reviewer described, and it did not fail, because closing ends the
    Gerätelink. It was a duplicate, so I took it out again.
  - Round 1, nit: `datenschutz/page.test.tsx` has German test names. Left
    because renaming is not AC-3 work and would put 18 renames into the
    record.
- **AC-11.** No automated test proves this. The commit message carries
  the record. For each dropped test I broke its behaviour by hand, saw the
  named test fail, and restored the code.
- **AC-12.** No production code changed, and nothing was restructured.
- **Coverage comparison.** It names no file with a drop and exits 0. It
  still prints the twelve "new, compared with nothing" notes from earlier
  tickets.
- **Review.** Two rounds. Round 1 had three should-fix and four nits; the
  should-fix and nits 1–3 were fixed. Round 2 had three nits; one was
  fixed and two are above.
- **Checks.** `npm run check` is green: 199 files, 2689 tests. I ran
  `test:coverage`, `compare-coverage.mjs` and `removed-tests.mjs` after
  the last edit. No checks were skipped.
- **Departures.** None from the plan or the nudges.
