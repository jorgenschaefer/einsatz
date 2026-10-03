---
criteria:  CRITERIA.md
closes:
advances:  AC-5, AC-13
after:     01-coverage-ausgangswert
status:    ready
attempts:  0
---

## Build
The shared checks for pages - login required, admin rights required, no
Einsatz data without a valid token, or declared public - and a test file for
each of the ten pages under `src/app/` that runs the check its location
requires.

## Done when
Toward AC-5: every `page.tsx` under `src/app/` has a test file next to it
(`src/app/page.test.ts`, `src/app/admin/users/page.test.ts`,
`src/app/operations/page.test.ts` and `src/app/device/[token]/page.test.ts`
are new).

Toward AC-13: the test file of each page runs the check its location
requires - token for `view/[token]` and `device/[token]`, admin for
`admin/users`, login for `account`, `operations` and `operations/[id]`, and
a public declaration for `/`, `login`, `impressum` and `datenschutz`.

## Toward
> **AC-5** Every server action module (a module whose first statement is `"use server"`), every route handler (`route.ts`) and every page (`page.tsx`) under `src/app/` has a test file, and `npm run check` fails when one has none.

> **AC-13** The test file of every page checks what its location requires: under `src/app/view/` and `src/app/device/`, that no Einsatz data is shown without a valid token; under `src/app/admin/`, that admin rights are required; anywhere else, that login is required, or the test file declares the page public. A page under `view/`, `device/` or `admin/` cannot be declared public. `npm run check` fails when a page's test file does not check what its location requires.

## Nudges
> The helpers take the whole module - for example `expectEveryActionRequiresLogin(module)` - and check that their tables name exactly the module's exports, like the test "names every exported server action, and nothing else" in `src/app/server-actions.validation.test.ts` does today for all modules.

> The check finds which checks a test file runs by searching it for the helpers' names, including the helper that declares a page public (for example `expectPublicPage(page)`).

> Mocks (`next/headers`, `next/navigation`, `@/server/db/pg`) stay at the top of each test file, because `vi.mock` is only hoisted in the test file itself. The helpers do not mock.

> Every jsdom test file costs about 3 s of setup; watch the runtime of `npm test` as test files multiply.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Pages and how they guard today (no test checks any page's anonymous
  redirect with the real `requireUser`):
  - `src/app/page.tsx` (5): `redirect("/operations")`. No test.
  - `account/page.tsx` (32): `requireUser`. Test 22 mocks `requireUser`.
  - `admin/users/page.tsx` (37): `requireAdmin`. No test.
  - `datenschutz/page.tsx` (344), `impressum/page.tsx` (75): public. Tests
    194, 28.
  - `login/page.tsx` (16): `getCurrentUser`, redirects a signed-in user to
    `/operations`. Test 19.
  - `operations/page.tsx` (40): `requireUser`. No test.
  - `operations/[id]/page.tsx` (231): `requireUser`, then `notFound()`. Test
    29 mocks `requireUser`.
  - `device/[token]/page.tsx` (24): `resolveDeviceAccess` → renders
    `<DeviceClosed/>`. No test.
  - `view/[token]/page.tsx` (24): `resolveViewAccess` → `<DeviceClosed/>`.
    Test 19 (mocked access).
- Pages are async server components: a test awaits `Page({ params })` and
  inspects the returned element, with `next/navigation`'s `redirect`
  mocked to throw `{ redirectTo }`. For how a page's returned element is
  read, see `viewProps`/`deviceProps` in
  `git show $(cat changes/2026-10-03-tests-ihren-dateien-zuordnen/start-commit.txt):src/app/token-views.hidden-layers.test.ts`
  (ticket 10 deletes that file, possibly before this ticket runs).
- A page test that only awaits `Page(...)` and inspects the element needs no
  DOM: a new page test can be `page.test.ts` (node project, `X.test.ts` next
  to `X.tsx` pairs) instead of `.tsx`, which saves the jsdom setup. Existing
  `.test.tsx` page tests that render stay as they are.
- Decided here, searched for by ticket 23: `src/test/page-checks.ts` (new)
  with `expectPageRequiresLogin(page, ...)` (anonymous → redirect to
  `/login`), `expectPageRequiresAdmin(page, ...)` (anonymous → `/login`,
  user role → refused as `requireAdmin` refuses today),
  `expectPageRequiresToken(page, ...)` (a token that is no valid link →
  the closure page, no Einsatz data in what is returned) and
  `expectPublicPage(page, ...)` (an anonymous call does not redirect to
  `/login` - it may render, or redirect elsewhere, as `/` does with
  `redirect("/operations")`; asserting the target of such a redirect is the
  page test's own business). Each registers its own `describe`/`it` blocks;
  the test file owns its mocks and session state and passes in how to be
  anonymous or signed in.
- Existing page tests that mock `requireUser` or the access lookup
  file-wide conflict with the real guard: rewrite those cases against the
  database (with a signed-in session) or keep the mock for them only if the
  check still runs with the real guard - a file-wide `vi.mock` cannot do
  both.
- Removing or merging tests (AC-11 applies if a case is dropped): the commit
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
- AC-3 review list: add a test file to `ac3-reviewed.txt` in this change's
  directory (one path per line, in the same commit) only if this ticket
  created it, or held every test in it against its own file - say which in
  Left standing. A test file this ticket only edited (added helper calls,
  moved some tests in or out) is not listed: the review tickets 26-31 read
  it. A file listed here is skipped by them and judged only here.

## Plan
1. Write `src/test/page-checks.ts` (new) with the four helpers, and use
   `expectPageRequiresLogin` in `src/app/operations/page.test.ts` (new).
   Proof: green; remove `requireUser()` from the page by hand and see it
   fail; restore.
2. `account/page.test.tsx` and `operations/[id]/page.test.tsx`: the login
   check, with their existing cases rewritten so the real guard runs.
   Proof: green.
3. `admin/users/page.test.ts` (new): the admin check. Proof: green; swap
   `requireAdmin` for `requireUser` by hand and see the user-role case
   fail; restore.
4. `view/[token]/page.test.tsx` and `device/[token]/page.test.ts` (new):
   the token check with a real database and an invalid token. Proof: green.
5. `src/app/page.test.ts` (new), `login`, `impressum`, `datenschutz`:
   `expectPublicPage`. Proof: `npm run check` green; the coverage comparison names no file.

## Not here
- The hidden-layers scenario of the view and device pages (ticket 10).
- From `CRITERIA.md`'s Out of scope: layouts (`layout.tsx`): they only wrap
  pages and load no Einsatz data.
- The check in `npm run check` that page tests call these helpers
  (ticket 23).
- No change to any page.

## Left standing
