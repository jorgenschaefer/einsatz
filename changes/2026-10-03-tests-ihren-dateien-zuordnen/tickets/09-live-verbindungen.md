---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-3, AC-11
after:     07-routes-links
status:    ready
attempts:  0
---

## Build
The Live-Verbindung scenarios - a stream ends once its access is gone, and
the per-user and per-link limits - move from the two tests over many files
into the test files of the three events routes that implement them, and
those two files are deleted.

## Done when
Toward AC-1: `src/app/live-connections-end.test.ts` and
`src/app/live-connection-limits.test.ts` are gone.

Toward AC-3: each case of the two files is in the test file of the events
route whose stream it is about (or of `src/server/events/sse.ts` for the
one-hour limit), and drives that route directly; loss of access is set up
through the server-layer functions, not by calling another entry point.

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
- `src/app/live-connections-end.test.ts` (254): fake timers for
  `setInterval`/`clearInterval`/`Date`; helpers `watch(res)` (reads the body
  in the background, `ended()`), `openLageansicht`/`openGeraeteansicht`/
  `openAnsicht`, `elapse(ms)` (advances the timers, then waits 150 ms of
  real time for the database). Cases "ends within 30 seconds": after
  Abmelden (`logoutAction`), session idle, session expired, "Überall
  abmelden" on another device (not this one), user deleted (not another
  user's), Ansichtslink deleted (not another), Gerätelink removed,
  Gerätelink regenerated (not the new link's), Einsatz closed (links end,
  Lageansicht and another Einsatz stay), Einsatz deleted (frees the user's
  places); plus "stays open while access remains" and "ends after an hour
  and frees its place".
- `src/app/live-connection-limits.test.ts` (176, without its 404 case, which
  ticket 06 moved): per user ten open / eleventh 429 / next one after a
  close, another user still in; per Gerätelink ten, another link of the same
  Einsatz still in; per Ansichtslink fifty, another link still in.
- Where the behaviour lives: each events route builds a `stillAllowed`
  closure (session or link still valid) and calls
  `operationEventStream` in `src/server/events/sse.ts` (heartbeat
  `HEARTBEAT_MS` 25 s calls `stillAllowed`; `MAX_STREAM_MS` one hour;
  cleanup releases the place from `openLiveConnection` in
  `src/server/events/live-connections.ts`). The limits are constants in the
  routes (`LIVE_CONNECTIONS_PER_USER` 10, `..._PER_DEVICE_LINK` 10,
  `..._PER_VIEW_LINK` 50). So the session cases and the per-user limit belong
  in `src/app/operations/[id]/events/route.test.ts`, the Gerätelink cases in
  `src/app/device/[token]/events/route.test.ts`, the Ansichtslink cases in
  `src/app/view/[token]/events/route.test.ts`, "ends after an hour" in
  `src/server/events/sse.test.ts` (197). All three route test files exist
  after tickets 06 and 07.
- "After Abmelden" and "Überall abmelden" call account actions today; in the
  route test, end the session with the server-layer function those actions
  use (`src/server/auth/sessions.ts`), as the other cases already do with
  `deleteViewLink`, `removeDeviceLink`, `closeOperation` and friends - that
  logging out deletes the session is the account actions' own test.
- `watch`, `elapse` and the stream openers are needed by all three route
  tests: put them in a shared helper file under `src/test/` (new), not in
  one of the route tests.
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
1. Move `watch`, `elapse` and the stream openers into a helper file under
   `src/test/` (new) and the session cases (Abmelden, idle, expired,
   "Überall abmelden", user deleted, Einsatz deleted, stays open) into
   `src/app/operations/[id]/events/route.test.ts`, with the same fake-timer
   setup. Proof: green; make the route's `stillAllowed` always return true
   by hand and see these cases fail; restore.
2. The Gerätelink cases into `device/[token]/events/route.test.ts` and the
   Ansichtslink cases into `view/[token]/events/route.test.ts`; the "Einsatz
   closed" case splits by link kind, with the Lageansicht side in the
   operations route test. Proof: green.
3. The limits into the three route tests, and "ends after an hour" into
   `src/server/events/sse.test.ts`. Proof: green.
4. Delete the two files. Proof: `npm run check` green; the coverage comparison names no file.

## Not here
- Session lifetime rules (idle 24 h, 30 days, what counts as use) are ticket
  10's; here only "the stream ends once the session is gone".
- The token and login checks of these routes (tickets 06, 07).
- No change to the routes or the stream.

## Left standing
