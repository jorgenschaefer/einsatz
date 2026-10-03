---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-3, AC-5, AC-7, AC-8, AC-11
after:     05-actions-etb-staerke, 06-routes-einsatz
status:    ready
attempts:  0
---

## Build
The shared token check for route handlers, and the test files of the seven
routes under `src/app/view/[token]/` and `src/app/device/[token]/` running
it (and the object-id check where the path has `[overlayId]`).
`auth-enforcement.test.ts` and `overlay-routes.not-a-uuid.test.ts` are
then empty and deleted.

## Done when
Toward AC-1: `src/app/auth-enforcement.test.ts` and
`src/app/overlay-routes.not-a-uuid.test.ts` are gone.

Toward AC-3: the token and object-id checks of these seven routes sit in
each route's own test file.

Toward AC-5: the seven routes each have a test file
(`device/[token]/events/route.test.ts` and
`device/[token]/geocode/route.test.ts` are new).

Toward AC-7: the test file of each of the seven routes checks, for every
method it exports, 403 without a valid token; the two
`overlays/[overlayId]` routes also that a non-UUID object id is refused
with 404 (their only method is `GET`) and nothing changes;
each fails when the route exports a method the test file does not name.

Toward AC-8: every check `auth-enforcement.test.ts` and
`overlay-routes.not-a-uuid.test.ts` make on these routes today is made in
the route's own test file.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-5** Every server action module (a module whose first statement is `"use server"`), every route handler (`route.ts`) and every page (`page.tsx`) under `src/app/` has a test file, and `npm run check` fails when one has none.

> **AC-7** The test file of every route handler checks, for every HTTP method the route exports:
> - under `src/app/view/` and `src/app/device/`: 403 without a valid token;
> - elsewhere: that login is required;
> - for routes with an object id in the path (a segment other than `[id]` and `[token]`, today `[overlayId]`): an object id that is not a UUID is refused and nothing changes, with the answer the method gives before this change (today 404 for `GET`, and 400 "Ungültige ID." for `PUT` on `operations/[id]/overlays/[overlayId]`);
> - for `POST` and `PUT` under `src/app/operations/`: 401 before the body is read, rejection of a request from another site, and the size limit.
>
> `npm run check` fails when one of these is left out for a method, and when the route exports a method the test file does not name.

> **AC-8** For every check in AC-6 and AC-7, every action and route that was checked for it before the change is still checked for it after the change.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

## Nudges
> The helpers take the whole module - for example `expectEveryActionRequiresLogin(module)` - and check that their tables name exactly the module's exports, like the test "names every exported server action, and nothing else" in `src/app/server-actions.validation.test.ts` does today for all modules.

> The check finds which checks a test file runs by searching it for the helpers' names, including the helper that declares a page public (for example `expectPublicPage(page)`).

> Mocks (`next/headers`, `next/navigation`, `@/server/db/pg`) stay at the top of each test file, because `vi.mock` is only hoisted in the test file itself. The helpers do not mock.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Ticket 06 built `src/test/route-checks.ts` (`expectRouteRequiresLogin`,
  `expectNonUuidObjectIdRefused`, `expectUploadRules`; `calls` keyed by HTTP
  method, keys must equal the exported methods). Add
  `expectRouteRequiresToken(route, calls)` beside them in the same shape:
  each method answers 403 for a token that is no valid link. Ticket 23
  searches test files for this name.
- The routes and their tests today:
  - `view/[token]/events/route.ts` (32): `GET`, `resolveViewAccess` → 403,
    429 limit. Test 22 (403 only, access mocked).
  - `view/[token]/geocode/route.ts` (16): `GET`. Test 38.
  - `view/[token]/overlays/[overlayId]/route.ts` (18): `GET`, `visibleOnly`.
    Test 40.
  - `device/[token]/events/route.ts` (32): `GET`, `resolveDeviceAccess` →
    403. No test.
  - `device/[token]/geocode/route.ts` (16): `GET`. No test.
  - `device/[token]/overlays/[overlayId]/route.ts` (18): `GET`. Test 40
    (403, foreign Einsatz 404; mocked).
  - `device/[token]/position/route.ts` (51): `POST`, token via
    `reportPosition` → 403; body of at most 1024 bytes. Test 263.
- `auth-enforcement.test.ts` checks 403 for a bad token on the device
  events, geocode and position routes (lines ~397-417). After tickets 02-06
  nothing else is left in it.
  `overlay-routes.not-a-uuid.test.ts` has, after ticket 06, the `view` and
  `device` cases (overlay id `"marker-icon.png"` → 404, with a real link).
- Some existing tests mock the access lookup file-wide; the token check
  with a real database and a real link is the one that proves the route
  refuses an invalid token. Where a mocked case would conflict with the
  helper's real-database setup, rewrite it against the database or drop it
  when the helper covers it (and record which).
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
1. Add `expectRouteRequiresToken` to `src/test/route-checks.ts` and use it in
   `src/app/device/[token]/position/route.test.ts`, moving its bad-token
   case from `auth-enforcement.test.ts`. Proof: green; skip the access
   check in the route by hand and see the 403 test fail; restore.
2. `device/[token]/events/route.test.ts` and
   `device/[token]/geocode/route.test.ts` (new) with the token check, taking
   their cases from `auth-enforcement.test.ts`. Proof: green.
3. `view/[token]/events`, `view/[token]/geocode`: the token check in their
   existing test files. Proof: green.
4. The two `overlays/[overlayId]` route tests: the token check and
   `expectNonUuidObjectIdRefused` (`GET` → 404), moving the cases of
   `overlay-routes.not-a-uuid.test.ts`. Proof: green.
5. Delete `auth-enforcement.test.ts` and `overlay-routes.not-a-uuid.test.ts`
   once empty. Proof: `npm run check` green; the coverage comparison names no file.

## Not here
- The live-connection and geocoding-limit scenarios on these routes
  (tickets 09, 10).
- The view and device pages (ticket 08).
- No change to any route's answers.

## Left standing
