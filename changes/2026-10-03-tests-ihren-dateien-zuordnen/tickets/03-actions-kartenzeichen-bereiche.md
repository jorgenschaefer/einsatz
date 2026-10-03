---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-3, AC-5, AC-6, AC-8, AC-11
after:     02-actions-konten, 08-seiten
status:    done
attempts:  1
---

## Build
The shared other-Einsatz check for actions, and the test files of four
action modules under `src/app/operations/[id]/` running all three action
checks: `actions.ts` (Standard-Ausschnitt), `map-symbol-actions.ts`,
`area-actions.ts` and `view-link-actions.ts`. Their cases leave
`map-actions.validation.test.ts`, `foreign-operation.test.ts` and
`auth-enforcement.test.ts`.

## Done when
Toward AC-1: `src/app/operations/[id]/actions.test.ts` exists next to
`actions.ts`; no case for these four modules is left in
`map-actions.validation.test.ts` or `foreign-operation.test.ts`.

Toward AC-3: the checks of these four modules' login, input and
other-Einsatz behaviour sit in each module's own test file, not in a test
over many modules; `map-symbol-actions.test.ts` checks that a removed
Gerätelink ends without rendering `DevicePage`.

Toward AC-5: the four modules each have a test file.

Toward AC-6: the test file of each of the four modules names every export
and checks login, bad input and - through the new shared helper - that given
the Einsatz-ID of one Einsatz and an object of another, the call is rejected
and nothing changes, or declares the export as taking only the Einsatz-ID;
it fails when the module has an export the test file does not name.

Toward AC-8: every export of these modules checked today in
`auth-enforcement.test.ts`, `server-actions.validation.test.ts`,
`map-actions.validation.test.ts` or `foreign-operation.test.ts` is checked
for the same property in its own test file.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

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
- Ticket 02 built `src/test/action-checks.ts` with
  `expectEveryActionRequiresLogin` and `expectBadCallsRejected`; read it
  first and use them as they are.
- `src/app/operations/[id]/foreign-operation.test.ts` (309 lines) creates
  one of each object in Einsatz A (`oneOfEachIn(opId)`, with a real
  `storeOverlayImage` and a generated device link), calls each action with
  Einsatz B's id and A's object, and expects `{ error: "<X> nicht
  gefunden." }`, A unchanged (`everythingIn(opId)`: lists plus files under
  uploads) and nothing fetched (`state.fetchedUrls`, from a mocked
  `@/server/kml/kml-import`). Its table covers move/updateComposition/
  delete/generateDeviceLink/removeDeviceLink, area updateStyle/
  updateGeometry/delete, kml set/reload/remove, image placement/visibility/
  delete, view-link delete, and the overlay `PUT` route.
- Decided here, used by tickets 04 and 05 and searched for by ticket 23:
  `expectForeignObjectsRejected(module, table, options)` in
  `src/test/action-checks.ts`. The table is keyed by export name; an entry
  is either a call (given the fixture objects of Einsatz A and the id of
  Einsatz B) with the expected error, or `"takes only the Einsatz-ID"`, or
  `"takes no Einsatz-ID"`. It fails unless the keys are exactly the
  module's exports, and for each call expects the error and Einsatz A
  unchanged, plus any extra "nothing happened" check the test file passes
  as an option (ticket 04 passes "nothing was fetched" for the KML actions,
  which `foreign-operation.test.ts` asserts today). Move `oneOfEachIn` and `everythingIn` from
  `foreign-operation.test.ts` into `src/test/bad-calls/fixture.ts` beside
  `oneOfEach`, so the helper and later tickets share one copy.
- `src/app/operations/[id]/map-actions.validation.test.ts` (568 lines) has
  its own copy of a fixture and of the bad-calls constants, a `withIds`
  table generating non-UUID cases for 20 actions (the same cases as
  `src/test/bad-calls/map.ts`), about 30 hand-written cases (area geometry
  shapes, four bad colours, label as number or of 201, symbol composition
  and coordinates as text, view-link label), and three "longest allowed"
  tests (Bereich label of 200 stored, Ansichtslink label of 200 stored, KML
  URL of 2000 fetched). The hand-written and longest cases for this ticket's
  modules become table entries or tests in the module's test file; the
  generated id cases are already in the copied `map.ts` entries.
- Existing tests: `map-symbol-actions.test.ts` 124 (removeDeviceLink,
  "refuses without a session"), `area-actions.test.ts` 58 (fully mocked:
  `createArea` returns the id), `view-link-actions.test.ts` 149 ("refuses
  without a session" for create and delete). `actions.ts` (16 lines,
  `setDefaultViewAction`) has none. A file-wide `vi.mock` of a server module
  cannot sit beside the real-database checks: rewrite such a mocked case
  against the real database, or drop it when a helper check covers it (and
  record which).
- `map-symbol-actions.test.ts` asserts through `DevicePage` and
  `DeviceClosed` (from `src/app/device/[token]/page.tsx`) that a removed
  Gerätelink no longer opens the Geräteansicht - assert it with
  `resolveDeviceAccess` from the server layer (`src/server/mapsymbols/map-symbols.ts`, or `device-links.ts` beside it if ticket 21 has split it off) instead
  (AC-3: a test drives its own file). Today this test and
  `lifecycle-actions.test.ts` (ticket 02) are the only ones reaching the
  `DeviceClosed` branch of `device/[token]/page.tsx`; ticket 08's
  invalid-token page test reaches it again, which is why this ticket comes
  after 08.
- `server-actions.validation.test.ts` and the `bad-calls` table files stay
  until ticket 05 (copy entries, do not delete them). Remove migrated cases
  from `auth-enforcement.test.ts`, `map-actions.validation.test.ts` and
  `foreign-operation.test.ts` now - none of them has a completeness test.
  Leave the kml and image cases (ticket 04) and the overlay `PUT` route case
  (ticket 06) where they are.
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
1. Add `expectForeignObjectsRejected` to `src/test/action-checks.ts` and
   move `oneOfEachIn`/`everythingIn` into `src/test/bad-calls/fixture.ts`;
   use all three helpers in `src/app/operations/[id]/map-symbol-actions.test.ts`
   (`placeMapSymbolAction`: takes only the Einsatz-ID). Proof: green; drop
   the Einsatz condition from `moveMapSymbol`'s lookup by hand and see the
   other-Einsatz test fail; restore. Replace the `DevicePage` assertion as
   under Context; the file then imports no other entry point or component.
2. `area-actions.test.ts`: the three helpers, the area cases from
   `map-actions.validation.test.ts` as table entries, and "stores a Bereich
   Beschriftung of 200 characters" as a test; replace the mocked
   `createArea` case with one against the database. Proof: green.
3. `view-link-actions.test.ts`: the three helpers, the view-link cases and
   "stores an Ansichtslink label of 200 characters"; drop its "refuses
   without a session" cases where the login check covers them. Proof:
   green.
4. `src/app/operations/[id]/actions.test.ts` (new): the three helpers for
   `setDefaultViewAction` (takes only the Einsatz-ID) with the six entries
   for it in `src/test/bad-calls/map.ts`, plus the hand-written cases of
   `map-actions.validation.test.ts` for it. Proof: green.
5. Remove the migrated cases from `auth-enforcement.test.ts`,
   `map-actions.validation.test.ts` and `foreign-operation.test.ts`, with
   the record. Proof: `npm run check` green; the coverage comparison names
   none of the four modules.

## Not here
- `kml-actions.ts`, `image-overlay-actions.ts`, `geocode-actions.ts`
  (ticket 04); `journal-actions.ts`, `strength-actions.ts` (ticket 05).
- The overlay `PUT` route's other-Einsatz case (ticket 06).
- Deleting `server-actions.validation.test.ts`, the `bad-calls` tables
  (ticket 05) and `map-actions.validation.test.ts` (ticket 04).
- No change to the actions themselves.

## Left standing
- **Review findings not fixed.** The one review round found no blocker and
  nothing that should be fixed. It found three nits, and I fixed two:
  - `createAreaAction` now has a test that a refused Bereich returns no id.
  - `expectForeignObjectsRejected` now also expects the same call under
    Einsatz A's own ID to be accepted, so a table entry that names the
    wrong kind of object fails. Pointing `deleteMapSymbolAction`'s entry at
    `a.areaId` made that test fail.
  Nit 3 is not fixed: the uploads directory is listed by two helpers.
  `everythingIn` in `src/test/bad-calls/fixture.ts` (moved here) lists files
  only. `everything` in `src/test/action-checks.ts` (ticket 02) lists files
  and directories. Merging them would either weaken the bad-calls check or
  change what `everythingIn` compares, and ticket 04 is told to use both as
  they are. Since only nits came back, there was no second round. The
  reviewer also noted the stale "complete inventory" comment in
  `auth-enforcement.test.ts`, and I reworded it.
- **Checks not run.** None skipped. `npm run check` is green (232 files,
  2862 tests). `npm run test:coverage` and then `compare-coverage.mjs` exit
  0. The script names only `src/test/action-checks.ts` and
  `src/test/page-checks.ts` as "new, compared with nothing", as after
  tickets 02 and 08. No file's coverage dropped, and no file needed a new
  test file. `oneOfEachIn` and `everythingIn` came from a test file, which
  is not in the baseline, so `coverage-splits.json` has no entry for them.
- **Advanced without an automated test.**
  - AC-1, AC-5: I checked by listing the files. `actions.test.ts` exists, and
    each of the four modules has exactly one test file. Ticket 23 adds the
    check to `npm run check`.
  - AC-3: no automated check yet. I grepped the four test files, and none
    imports another `@/app/` module or a component. `DevicePage` is gone
    from `map-symbol-actions.test.ts`.
  - AC-6: the helpers are proven by breaking things by hand. Each break made
    the named test fail, and I restored all of them:
    - The Einsatz condition dropped from `moveMapSymbol`'s `UPDATE`: "rejects
      moveMapSymbolAction with an object of another Einsatz and changes
      nothing" failed.
    - `generateDeviceLinkAction` left out of the other-Einsatz table: "names
      every export of the module, and nothing else" failed.
    - `requireUser()` replaced in `operationAction`: all eight "sends an
      anonymous caller to the login" tests of `map-symbol-actions` and
      `view-link-actions` failed.
    - `setDefaultView` taken out of `setDefaultViewAction`: the new success
      test and the bad calls failed.
    - `createAreaAction` returning no id: "returns the id of the new
      Bereich …" failed.
  - AC-8: every name the four old places checked for these 13 exports has a
    `→` line in the commit's record, and each target is a test that exists.
  - AC-11: the commit's `Removed tests:` section is written from
    `removed-tests.mjs`. It names all 82 removed names, and each has its
    `→` line.
- **AC-3 review list.** All four test files are added to
  `ac3-reviewed.txt`. `actions.test.ts` is new. I rewrote the other three
  whole and held every test in them against their own module.
- **Departures from the plan.**
  - `expectForeignObjectsRejected` registers no "calls" block when a table
    has only "takes only the Einsatz-ID" / "takes no Einsatz-ID" entries, as
    for `actions.ts`. Vitest fails a `describe` with no tests in it.
  - The helper calls as a signed-in `user`, not an admin. That is the
    attacker the check is about, and no export under `operations/[id]` is
    admin-only.
  - The `nothingElseHappened` option has no user yet. Ticket 04 is its
    first user, as the Context decides, so it goes untested until then.
  - The "takes no Einsatz-ID" entry has no user yet either. The ticket
    defines it for `geocodeAddressAction` (ticket 04).
  - In `view-link-actions.test.ts`, the five success tests were merged into
    two ("creates a named view link and tells open clients", "deletes the
    view link and tells open clients"), following the nudge to shorten. The
    two "refuses … without a session" tests were dropped because the login
    check covers them, and so was `map-symbol-actions`'s. Breaking the
    login check as above showed that.
  - `actions.test.ts` also got a success test ("stores the Einsatz's default
    view and tells open clients"). Before this, no test of the action
    checked that it stores the view.
  - The mocked `area-actions.test.ts` case "returns no id on a
    ValidationError" became a real-database test, "returns no id when the
    Bereich is refused". The `revalidatePath` assertion of the mocked "returns
    the id" case is not repeated: `operation-action.test.ts` holds it.
- **Departures from a nudge.** None.
