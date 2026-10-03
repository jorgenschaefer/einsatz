---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-5, AC-6, AC-8, AC-11
after:     01-coverage-ausgangswert
status:    ready
attempts:  0
---

## Build
The shared checks for server actions - login required and bad input
rejected, each over every export of a module - and their use in the test
files of the five action modules outside `src/app/operations/[id]/`:
`account/actions.ts`, `admin/users/actions.ts`, `login/actions.ts`,
`operations/actions.ts` and `operations/lifecycle-actions.ts`. Their
`*.validation.test.ts` files are merged into the one test file of each.

## Done when
Toward AC-1 and AC-2: each of the five modules has exactly one test file,
`actions.test.ts` or `lifecycle-actions.test.ts` next to it;
`src/app/account/actions.validation.test.ts`,
`src/app/admin/users/actions.validation.test.ts`,
`src/app/login/actions.validation.test.ts` and
`src/app/operations/actions.validation.test.ts` are gone.

Toward AC-3: the test files of these five modules no longer drive another
entry point: the logout case in `login/actions.test.ts` is in
`account/actions.test.ts`, the password-change case of
`account/actions.test.ts` checks the new password without calling
`loginAction`, and `lifecycle-actions.test.ts` checks that links end without
rendering `DevicePage` or `ViewPage`.

Toward AC-5: the five modules each have a test file.

Toward AC-6: the test file of each of the five modules names every export
of its module and checks, through the shared helpers, that it requires
login (admin rights for the exports of `admin/users/actions.ts` and
`deleteOperationAction`) unless declared public (`loginAction`,
`logoutAction`), and that it rejects bad input and stores nothing unless
declared as taking no input (`logoutAction`, `logoutOtherSessionsAction`);
the test fails when the module has an export the test file does not name.

Toward AC-8: every export of these five modules that
`src/app/auth-enforcement.test.ts` or `src/app/server-actions.validation.test.ts`
checks today for login or bad input is checked for it in its own test file.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

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

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

## Nudges
> The helpers take the whole module - for example `expectEveryActionRequiresLogin(module)` - and check that their tables name exactly the module's exports, like the test "names every exported server action, and nothing else" in `src/app/server-actions.validation.test.ts` does today for all modules.

> The check finds which checks a test file runs by searching it for the helpers' names, including the helper that declares a page public (for example `expectPublicPage(page)`).

> Mocks (`next/headers`, `next/navigation`, `@/server/db/pg`) stay at the top of each test file, because `vi.mock` is only hoisted in the test file itself. The helpers do not mock.

> The tables in `src/test/bad-calls/` move to the test files of their modules.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Today two tests check all 42 exported actions at once:
  - `src/app/auth-enforcement.test.ts` (418 lines) keeps hand-written lists
    (`userGuardedActions` from line 161, `adminGuardedActions` from line 328)
    and checks an anonymous call redirects to `/login`, and for admin
    actions that a user-role call redirects to `/operations`. `loginAction`
    and `logoutAction` are left out on purpose (comment around line 342).
    It also has one success case, `createAccountAction` as admin returns `{}`.
    Its local `login(role)` duplicates `signIn` from `src/test/sign-in.ts`.
  - `src/app/server-actions.validation.test.ts` (152 lines) finds every
    `"use server"` module with `serverActionModules` (`src/test/server-action-modules.ts`),
    checks that the tables in `src/test/bad-calls/` name every exported
    action and nothing else, and runs each bad call against `oneOfEach`
    (`src/test/bad-calls/fixture.ts`), expecting the answer and an unchanged
    `snapshotDb` plus uploads directory. Table format in
    `src/test/bad-calls/bad-call.ts`: `BadCalls = Record<exportName,
    BadCall[] | "takes no input">`, `BadCall {what, answer, call(fixture)}`,
    builders `rejects`, `noHits`, `idCalls`, `tooLong`, `text`. The entries
    for this ticket's modules are in `src/test/bad-calls/operations-accounts.ts`.
- Every action calls its guard before it looks at its input
  (`requireUser`/`operationAction`, and a local `guarded()` around
  `requireAdmin` in `admin/users/actions.ts`; `deleteOperationAction` calls
  `requireAdmin` itself), so the login check can call each export with no
  arguments - which is what lets it cover every export without a table.
- Decided here, used by tickets 03-05 and searched for by ticket 23: the
  helpers live in `src/test/action-checks.ts` (new) and are named
  `expectEveryActionRequiresLogin(module, options)` and
  `expectBadCallsRejected(module, table, options)`. Each registers its own
  `describe`/`it` blocks when called at the top level of a test file.
  - `expectEveryActionRequiresLogin`: options name the exports declared
    `public` and `adminOnly`, and how to be anonymous / signed in as a
    given role (the test file owns the mocked cookie state). For every other
    export: an anonymous call redirects to `/login`. For `adminOnly`
    exports, also: a user-role call redirects to `/operations`. It fails if
    a declared name is not an export of the module, and - because AC-6
    fixes the admin-only list - it keeps that list itself (every export of
    `src/app/admin/users/actions.ts`, and `deleteOperationAction`) and fails
    when one of them is not declared `adminOnly`, so dropping a declaration
    cannot silently drop the non-admin check.
  - `expectBadCallsRejected`: the table is keyed by export name; it fails
    unless the keys are exactly the module's exports, and when an entry is
    `"takes no input"` for a function that has parameters, and when an
    entry that is not `"takes no input"` has no bad call at all (the three
    checks of
    "the table of bad calls" in `server-actions.validation.test.ts`, per
    module). Each call runs signed in as admin against `oneOfEach`, and
    expects its answer and an unchanged `snapshotDb` and uploads directory.
  Keep `BadCall`, the builders and `oneOfEach` where they are
  (`src/test/bad-calls/bad-call.ts`, `fixture.ts`); only the tables move.
- `server-actions.validation.test.ts` and the `bad-calls` table files stay
  until ticket 05 deletes them - its completeness test needs every module's
  entries until all modules have their own. Entries are copied into the
  module tests here; ticket 05 deletes the originals.
  `auth-enforcement.test.ts` has no completeness test: remove the entries
  for this ticket's modules from its lists now (and the `createAccountAction`
  success case, which moves to `admin/users/actions.test.ts`).
- Existing per-module tests: `account/actions.test.ts` 183 +
  `actions.validation.test.ts` 88 (no FormData, file fields, no session →
  `/login` before input); `admin/users/actions.test.ts` 125 +
  `actions.validation.test.ts` 136 (9 bad calls, longest name);
  `login/actions.test.ts` 246 + `actions.validation.test.ts` 55;
  `operations/lifecycle-actions.test.ts` 241; `operations/actions.ts` has no
  test of its own - `operations/actions.validation.test.ts` (156) covers
  `createOperationAction` and the three lifecycle actions.
- Tests in these files that drive another entry point (AC-3): 
  `src/app/login/actions.test.ts` "ends the session on logout in
  production" tests `logoutAction` (in `account/actions.ts`) - move it to
  `account/actions.test.ts`; `src/app/account/actions.test.ts` checks a
  changed password by calling `loginAction` - check it with `authenticate`
  from `src/server/auth/login.ts` instead; `src/app/operations/lifecycle-actions.test.ts`
  asserts that links end by rendering `DevicePage`/`ViewPage` - assert with
  `resolveDeviceAccess`/`resolveViewAccess` from the server layer instead.
- Every DB test repeats the same mock block at its top (a `vi.hoisted`
  state with `db` and `token`, `vi.mock` of `@/server/db/pg`, `next/cache`,
  `next/headers` cookies from the state, `next/navigation` redirect
  throwing `{ redirectTo }`); `server-actions.validation.test.ts` lines 7-36
  is the model.
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
1. Write `src/test/action-checks.ts` (new) with the two helpers as decided
   under Context, and use them first in `src/app/account/actions.test.ts`:
   the std mock block if missing, `expectEveryActionRequiresLogin(actions,
   { public: ["logoutAction"], ... })`, and `expectBadCallsRejected(actions,
   { changePasswordAction: [...], logoutAction: "takes no input",
   logoutOtherSessionsAction: "takes no input" }, ...)` with the entries
   copied from `operations-accounts.ts`. Proof: green; then leave
   `logoutOtherSessionsAction` out of the table and see the completeness
   test fail, and remove `requireUser()` from `changePasswordAction` by hand
   and see the login test fail; restore both. Also leave `adminOnly` off
   `setRoleAction` in the admin test (step 3) once and see the helper fail.
2. Merge `src/app/account/actions.validation.test.ts` into
   `account/actions.test.ts`: cases the table already holds are dropped (the
   record names the table entry), the rest move as table entries or tests.
   Delete the validation file. Proof: green; the coverage comparison names no file.
3. Same for `src/app/admin/users/actions.ts`: helpers with `adminOnly` set to
   all four exports, the table entries, the `createAccountAction`
   admin-success case from `auth-enforcement.test.ts`, and the merged
   `actions.validation.test.ts`. Proof: green; a user-role call to
   `setRoleAction` with `guarded` bypassed by hand makes the admin test fail.
4. Same for `src/app/login/actions.ts` (`loginAction` public, with its bad
   calls). Proof: green.
5. Split `src/app/operations/actions.validation.test.ts`:
   `createOperationAction` into `src/app/operations/actions.test.ts` (new),
   the close/reopen/delete cases into `src/app/operations/lifecycle-actions.test.ts`,
   each with both helpers (`deleteOperationAction` `adminOnly`); keep the
   "non-admin refused" case of `lifecycle-actions.test.ts` only if the admin
   check does not already cover it. Delete the validation file. Proof:
   green.
6. The three AC-3 cases listed under Context. Proof: green; the three test
   files import no other entry point or component.
7. Remove the entries of these five modules from the lists in
   `src/app/auth-enforcement.test.ts`. Proof: `npm run check` green; the
   the coverage comparison names no file.

## Not here
- The actions under `src/app/operations/[id]/` (tickets 03, 04, 05) and the
  other-Einsatz helper (ticket 03).
- Deleting `server-actions.validation.test.ts` and the `bad-calls` table
  files (ticket 05).
- The check in `npm run check` that a module's test file calls these helpers
  (ticket 23).
- No change to the actions themselves.

## Left standing
