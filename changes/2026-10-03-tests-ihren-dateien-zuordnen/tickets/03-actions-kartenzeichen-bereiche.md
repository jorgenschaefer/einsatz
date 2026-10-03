---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-3, AC-5, AC-6, AC-8, AC-11
after:     02-actions-konten, 08-seiten
status:    ready
attempts:  0
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

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`. Another file of the project appears in it only as a harness around `X` (rendering `X` or providing context for it) or as a fixture or fake.

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
