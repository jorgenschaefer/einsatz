---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-5, AC-7, AC-8, AC-11
after:     05-actions-etb-staerke
status:    ready
attempts:  0
---

## Build
The shared checks for route handlers - login required, a non-UUID object id
refused, and the upload rules - each over every exported HTTP method, and
their use in the test files of the four session routes under
`src/app/operations/[id]/`: `events`, `kml`, `overlays` and
`overlays/[overlayId]`. `uploads.test.ts` and `foreign-operation.test.ts`
are dissolved into them, and `route.put.test.ts` is merged into
`route.test.ts`.

## Done when
Toward AC-1 and AC-2: `src/app/operations/[id]/uploads.test.ts`,
`src/app/operations/[id]/foreign-operation.test.ts` and
`src/app/operations/[id]/overlays/[overlayId]/route.put.test.ts` are gone;
each of the four routes has exactly one test file, `route.test.ts` next to
it.

Toward AC-3: the upload, login and object-id checks of these routes sit in
each route's own test file.

Toward AC-5: the four routes each have a test file
(`src/app/operations/[id]/events/route.test.ts` is new).

Toward AC-7: the test file of each of the four routes checks, for every
method it exports, that login is required; `overlays/[overlayId]` also
that a non-UUID object id is refused and nothing changes, with 404 on `GET`
and 400 "Ungültige ID." on `PUT`; the `POST` and `PUT`
methods also 401 before the body is read, rejection of a request from
another site, and the size limit; each test fails when the route exports a
method the test file does not name.

Toward AC-8: every check `auth-enforcement.test.ts`, `uploads.test.ts`,
`overlay-routes.not-a-uuid.test.ts` and `foreign-operation.test.ts` make on
these four routes today is made in the route's own test file.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-2** No source file has more than one test file. A source file may have none.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`. Another file of the project appears in it only as a harness around `X` (rendering `X` or providing context for it) or as a fixture or fake.

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
- The routes:
  - `operations/[id]/events/route.ts` (43): `GET`, `requireUser`, 404 for an
    unknown Einsatz, 429 over `LIVE_CONNECTIONS_PER_USER`. No test file.
  - `operations/[id]/kml/route.ts` (27): `POST` via `handleUpload`. Test 205.
  - `operations/[id]/overlays/route.ts` (23): `POST` via `handleUpload`. Test 414.
  - `operations/[id]/overlays/[overlayId]/route.ts` (35): `GET`
    (`requireUser`, `overlayImageResponse`) and `PUT` (`handleUpload`,
    `replaceImageOverlayImage`). Tests: `route.test.ts` 35 (mocks db,
    current-user, image-overlays and image-storage file-wide) and
    `route.put.test.ts` 295 (real database).
- `handleUpload` in `src/app/operations/[id]/upload-route.ts` answers 403
  for another site, 401 without a session (before reading the body), 413
  over the size limit, 400 for an unreadable form. A non-UUID `overlayId`
  answers 404 for `GET` (`overlay-routes.not-a-uuid.test.ts`) and 400
  "Ungültige ID." for `PUT` (`assertUuid` in `replaceImageOverlayImage`).
  This ticket changes no route: AC-7 pins each method's answer as it was
  before this change. So `expectNonUuidObjectIdRefused` takes the expected
  status per method, and, like `expectUploadRules`, a per-call snapshot of
  what is stored (rows and the files under the uploads directory) to show
  nothing changed. The `PUT` call must send a valid image: `formFile(form)`
  runs before `assertUuid`, so a `PUT` without a file answers "Keine Datei
  ausgewählt.", not "Ungültige ID.".
- `src/app/operations/[id]/uploads.test.ts` (328) runs for all three upload
  methods: 401 without a session and with an unknown token (0 bytes read),
  403 for four foreign-origin header variants (0 bytes read, nothing
  stored), 413 for a body over the limit without Content-Length (stops
  reading after about 21 MB, cancelled, nothing stored); plus per route:
  same-origin via Host or x-forwarded-host (kml), 20 MB accepted (each
  route). It sends the `PUT` cases with `streamedRequest("POST", ...)`
  (lines 139, 154, 189, 311) - send them as `PUT` when they move.
- Decided here, searched for by ticket 23, reused by ticket 07:
  `src/test/route-checks.ts` (new) with
  `expectRouteRequiresLogin(route, calls)`,
  `expectNonUuidObjectIdRefused(route, calls)` and
  `expectUploadRules(route, calls)`. `calls` is keyed by HTTP method; each
  helper fails unless its keys are exactly the methods the route module
  exports (for `expectUploadRules`: exactly its exported `POST` and `PUT`).
  Each entry says how to send the request and what answer is expected (a
  redirect to `/login`, or a status). The helpers register their own
  `describe`/`it` blocks. The upload helper takes, per method, how to
  build a streamed request and how to snapshot what is stored, and checks
  the 401/403/413 cases above.
- `foreign-operation.test.ts`: after ticket 04 only the overlay `PUT` row is
  left; it moves to `overlays/[overlayId]/route.test.ts` (and duplicates
  "PUT … under another Einsatz" in `route.put.test.ts` around line 223 -
  keep one). `oneOfEachIn`/`everythingIn` are in
  `src/test/bad-calls/fixture.ts` since ticket 03.
- `auth-enforcement.test.ts` lists these routes in `userGuardedRoutes` and
  `sessionGuardedUploads`; `overlay-routes.not-a-uuid.test.ts` has one case
  per overlay route (this ticket takes the `operations` one; ticket 07 the
  `view` and `device` ones and deletes the file). Remove what moves; neither
  file has a completeness test.
- Removing or merging tests (AC-11): the commit body has a section
  `Removed tests:` with one line per removed test, `- <old file> ›
  <describe> › <it>` followed by either `→ <new file> › <it>` or `→ gone:
  <why>; broke <behaviour> by hand, <test that failed> failed`. A test moved
  into another file counts as removed from its old file. Before committing,
  run `npm run test:coverage` and
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/compare-coverage.mjs`;
  it must name no file at all - a test moved away can drop the coverage
  of a file this ticket never opened. Fixtures and `src/test/` helpers
  count too: code in them that no test uses any more is deleted, and
  helper code moved to another file gets an entry in
  `coverage-splits.json`.
- AC-3 review list: add a test file to `ac3-reviewed.txt` in this change's
  directory (one path per line, in the same commit) only if this ticket
  created it, or held every test in it against its own file - say which in
  Left standing. A test file this ticket only edited (added helper calls,
  moved some tests in or out) is not listed: the review tickets 26-31 read
  it. A file listed here is skipped by them and judged only here.

## Plan
1. Write `src/test/route-checks.ts` (new) with the three helpers, and use
   them first in `src/app/operations/[id]/kml/route.test.ts`: login (`POST`
   → 401) and the upload rules, moving the kml cases of `uploads.test.ts`
   (with same-origin and 20 MB) into it. Proof: green; remove the
   same-origin check from `handleUpload` by hand and see the 403 cases fail;
   restore.
2. `overlays/route.test.ts`: the two helpers with the overlays `POST` cases
   of `uploads.test.ts`. Proof: green.
3. `overlays/[overlayId]/route.test.ts`: merge `route.put.test.ts`, rewrite
   the mocked `GET` case against the database, add the three helpers
   (`GET` → redirect / 404; `PUT` → 401 / 400 "Ungültige ID." / upload
   rules), move the `PUT` row of `foreign-operation.test.ts` and the
   `operations` case of `overlay-routes.not-a-uuid.test.ts`. Delete
   `route.put.test.ts` and `foreign-operation.test.ts`. Proof: green.
4. `src/app/operations/[id]/events/route.test.ts` (new): login for `GET`,
   plus "answers 404 for an Einsatz that does not exist" moved from
   `live-connection-limits.test.ts`. Proof: green.
5. Delete `uploads.test.ts` once empty, and remove these routes from
   `auth-enforcement.test.ts`. Proof: `npm run check` green; the coverage comparison names no file.

## Not here
- `view/*` and `device/*` routes, the rest of
  `overlay-routes.not-a-uuid.test.ts` and of `auth-enforcement.test.ts`
  (ticket 07).
- The other cases of `live-connection-limits.test.ts` and
  `live-connections-end.test.ts` (ticket 09).
- From `CRITERIA.md`'s Out of scope: requiring the other-Einsatz check for
  new route handlers with an object id; AC-8 keeps today's check on
  `operations/[id]/overlays/[overlayId]`, and nothing requires it of later
  routes. So the moved `PUT` row is a plain test, not a helper the check
  requires.
- No change to any route's answers.

## Left standing
