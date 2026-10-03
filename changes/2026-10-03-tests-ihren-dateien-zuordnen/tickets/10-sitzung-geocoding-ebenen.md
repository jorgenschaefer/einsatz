---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-3, AC-11
after:     07-routes-links, 08-seiten
status:    ready
attempts:  0
---

## Build
The last three tests over many files - session lifetime, the geocoding
limits for token links, and hidden layers in the token views - move into
the test files of the modules that implement each behaviour, and are
deleted.

## Done when
Toward AC-1: `src/app/session-lifetime.test.ts`,
`src/app/token-geocode-limits.test.ts` and
`src/app/token-views.hidden-layers.test.ts` are gone.

Toward AC-3: each of their cases sits in the test file of the module whose
code decides it - and the entry point's own part (a valid token is
served) in the test of that entry point - (`current-user.ts`, `sessions.ts`, `login.ts`,
`upload-route.ts`, `geocode-service.ts`, `read-only-situation-map.ts`,
`overlay-response.ts`), driving that module directly.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

## Nudges
> Mocks (`next/headers`, `next/navigation`, `@/server/db/pg`) stay at the top of each test file, because `vi.mock` is only hoisted in the test file itself. The helpers do not mock.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- `src/app/session-lifetime.test.ts` (203) drives a page
  (`account/page.tsx`), an action (`createOperationAction`), an upload (kml
  `POST`), an automatic reload (`rsc: 1`), the Live-Verbindung and an image
  load, with fake `Date` and request headers, and checks: still signed in
  24 h 5 min minus 1 s after the last use; login required after 24 h 5 min
  1 s; never before 24 h after an unrecorded use; page, action and upload
  count as use; reload, Live-Verbindung and image do not; no
  `Sec-Fetch-Mode` never counts; absolute end 30 days after login.
- Where it is decided: `getCurrentUser` in `src/server/auth/current-user.ts`
  records a use when `isUserActivity(headers)` (a `next-action` header, or
  `sec-fetch-mode: navigate`) or when called with `recordUse: true`;
  `handleUpload` in `src/app/operations/[id]/upload-route.ts` is the caller
  that passes `recordUse: true`. `src/server/auth/sessions.ts` has
  `SESSION_IDLE_MS` (24 h), `SESSION_USE_WRITE_INTERVAL_MS` (5 min),
  `recordSessionUse`, `findUserBySessionToken`, `idleCutoff` (test
  `sessions.test.ts` exists). `src/server/auth/login.ts` has
  `SESSION_TTL_MS` (30 days) and `createSession` (test `login.test.ts`).
  `current-user.ts` and `upload-route.ts` have no test file yet; create
  `src/server/auth/current-user.test.ts` and
  `src/app/operations/[id]/upload-route.test.ts` for the moved cases.
- `src/app/token-geocode-limits.test.ts` (105): Ansichts- and Gerätelinks
  together search at most once in 3 s; logged-in users keep at least two
  thirds while token links search all the time; a query over 200
  characters answers `[]` without using a slot (view route, device route,
  `geocodeAddressAction`); exactly 200 still reaches Photon. All decided in
  `src/server/geocoder/geocode-service.ts` (`geocodeQuery`,
  `geocodeQueryForTokenLink`, `isWorthGeocoding`,
  `MAX_GEOCODE_QUERY_LENGTH`, the two `RateGate`s); its test
  `geocode-service.test.ts` (121) exists. The gates are module-wide
  singletons: the old test starts each case an hour after the last.
- `src/app/token-views.hidden-layers.test.ts` (275): the view and device
  page data leave out hidden KML-Ebenen and Bild-Overlays (decided in
  `loadReadOnlySituationMap`, `src/app/read-only-situation-map.ts` lines
  ~46/53; test `read-only-situation-map.test.ts` 51); a hidden overlay's
  image answers 404 under `/view` and `/device`, a visible one 200 (decided
  in `overlayImageResponse(..., { visibleOnly })`,
  `src/server/image-overlays/overlay-response.ts`, whose test already has
  "answers 404 for a hidden overlay when only visible ones may be served");
  showing a layer again notifies open token views once and the page then
  includes it (the notification is `revalidateOperation` in
  `src/app/operations/[id]/operation-action.ts`, test
  `operation-action.test.ts`; the inclusion is `loadReadOnlySituationMap`).
  Cases another test already pins are dropped with the record and the
  break-by-hand check; the rest move to the module that decides them.
- These three files are today the only tests that reach the valid-token
  path of three entry points: `src/app/view/[token]/page.tsx` and
  `src/app/device/[token]/page.tsx` (`loadReadOnlySituationMap`, the
  `if (!map)` branch and the rendered view - reached only by
  `token-views.hidden-layers.test.ts`) and
  `src/app/device/[token]/geocode/route.ts` (lines 14-15 - reached only by
  `token-geocode-limits.test.ts`). Serving a valid token is each entry
  point's own behaviour: move one case each into
  `view/[token]/page.test.tsx`, `device/[token]/page.test.ts` (both from
  ticket 08) and `device/[token]/geocode/route.test.ts` (from ticket 07),
  or the coverage comparison names those files.
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
1. `src/server/auth/current-user.test.ts` (new): which requests count as use
   (action header, navigate, `recordUse`; not RSC reload, not without
   `Sec-Fetch-Mode`) and the idle and absolute ends as `getCurrentUser`
   sees them, with mocked `next/headers` and fake `Date`. Proof: green;
   drop the `navigate` condition by hand and see "a page load counts" fail;
   restore.
2. `src/app/operations/[id]/upload-route.test.ts` (new): an upload counts as
   use (`handleUpload` passes `recordUse: true`). Proof: green.
3. Session constants that `sessions.test.ts` / `login.test.ts` do not pin yet
   (24 h idle, 5 min write interval, 30 days) go there. Delete
   `session-lifetime.test.ts`. Proof: green.
4. The geocoding cases into `geocode-service.test.ts`, keeping the
   one-hour spacing between cases (or resetting the gates if the module
   offers that). Delete `token-geocode-limits.test.ts`. Proof: green.
5. One valid-token case each into the view and device page tests and the
   device geocode route test, as under Context. Proof: green; the coverage
   comparison does not name the three files.
6. The hidden-layer cases into `read-only-situation-map.test.ts` and
   `overlay-response.test.ts`, dropping what `overlay-response.test.ts` and
   `operation-action.test.ts` already pin. Delete
   `token-views.hidden-layers.test.ts`. Proof: `npm run check` green;
   the coverage comparison names no file.

## Not here
- "The stream ends once the session is gone" (ticket 09).
- The token and login checks of routes and pages (tickets 06-08).
- No change to session, geocoding or visibility behaviour.

## Left standing
