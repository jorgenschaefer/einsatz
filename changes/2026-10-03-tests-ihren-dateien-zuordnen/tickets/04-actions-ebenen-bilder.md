---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-3, AC-5, AC-6, AC-8, AC-9, AC-11
after:     03-actions-kartenzeichen-bereiche
status:    done
attempts:  1
---

## Build
The test files of `kml-actions.ts`, `image-overlay-actions.ts` and
`geocode-actions.ts` under `src/app/operations/[id]/` run the three action
checks, the last cases leave `map-actions.validation.test.ts`, and that
file is deleted.

## Done when
Toward AC-1: `src/app/operations/[id]/map-actions.validation.test.ts` is
gone.

Toward AC-3: the login, input and other-Einsatz checks of these three
modules sit in each module's own test file.

Toward AC-5: the three modules each have a test file.

Toward AC-6: the test files of `kml-actions.ts`, `image-overlay-actions.ts`
and `geocode-actions.ts` each name every export and check login, bad input
and the other-Einsatz rule (`addKmlUrlAction` takes only the Einsatz-ID,
`geocodeAddressAction` takes no Einsatz-ID), failing when the module has an
export the test file does not name.

Toward AC-8: every export of these three modules checked today in
`auth-enforcement.test.ts`, `server-actions.validation.test.ts`,
`map-actions.validation.test.ts` or `foreign-operation.test.ts` is checked
for the same property in its own test file.

Toward AC-9: `map-actions.validation.test.ts` (568 lines) no longer exists.

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

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

## Nudges
> The helpers take the whole module - for example `expectEveryActionRequiresLogin(module)` - and check that their tables name exactly the module's exports, like the test "names every exported server action, and nothing else" in `src/app/server-actions.validation.test.ts` does today for all modules.

> Mocks (`next/headers`, `next/navigation`, `@/server/db/pg`) stay at the top of each test file, because `vi.mock` is only hoisted in the test file itself. The helpers do not mock.

> The tables in `src/test/bad-calls/` move to the test files of their modules.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Tickets 02 and 03 built `src/test/action-checks.ts`
  (`expectEveryActionRequiresLogin`, `expectBadCallsRejected`,
  `expectForeignObjectsRejected`) and moved `oneOfEachIn`/`everythingIn`
  into `src/test/bad-calls/fixture.ts`; use them as they are.
- `kml-actions.ts` (67 lines): `addKmlUrlAction` (takes the Einsatz-ID and a
  URL), `setKmlVisibilityAction`, `reloadKmlAction`, `removeKmlAction`.
  Its test `kml-actions.test.ts` (180) mocks `@/server/kml/kml-import`,
  `@/server/kml/kml-overlays`, `@/server/auth/current-user` (`requireUser`),
  `@/server/db/pg` (a fake `{ tag: "db" }`) and the operation events - none
  of which the login and other-Einsatz checks can run with. Replace them
  with the std mock block (real database, session from the mocked cookie,
  as in tickets 02 and 03). The helpers need the real overlays in the
  database: mock only `loadKmlFromUrl` from `kml-import`, recording the URLs
  it is called with (as `foreign-operation.test.ts` and
  `map-actions.validation.test.ts` do with `state.fetchedUrls`), and rewrite
  the cases that faked `kml-overlays` against the database. Pass the
  "nothing was fetched" assertion to `expectForeignObjectsRejected` through
  its extra-check option (ticket 03), so the other-Einsatz rows keep it. The
  seven other `kml-actions.*.test.ts` files are tickets 20's and 25's; do
  not touch them.
- `image-overlay-actions.ts` (62): placement, visibility, delete - all take
  the Einsatz-ID and an overlay id. Test `image-overlay-actions.test.ts`
  (168). Its fixture objects need an image file on disk (`oneOfEach` writes
  one) and a per-test `UPLOADS_DIR`.
- `geocode-actions.ts` (10): `geocodeAddressAction(query)` calls
  `requireUser` and `geocodeQuery`; its bad calls answer `[]` (`noHits`).
  Test `geocode-actions.test.ts` (61).
- Cases to collect: the kml/image/geocode entries in
  `src/test/bad-calls/map.ts` and `operations-accounts.ts` (copy; ticket 05
  deletes the originals); in `map-actions.validation.test.ts` the kml and
  image cases, "a KML URL that is a number or of 2001 characters is
  rejected before it is fetched", and "fetches a KML URL of 2,000
  characters"; in `foreign-operation.test.ts` the kml and image rows; in
  `auth-enforcement.test.ts` the entries for these modules.
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
1. `kml-actions.test.ts`: replace the `kml-overlays` mock with the database,
   keep a recording mock of `loadKmlFromUrl`, add the three helpers, the
   kml table entries, "rejected before it is fetched" and "fetches a KML URL
   of 2,000 characters". Proof: green; remove `assertText` on the URL by
   hand and see a bad call fail; restore.
2. `image-overlay-actions.test.ts`: the three helpers with the image entries.
   Proof: green.
3. `geocode-actions.test.ts`: the three helpers (`geocodeAddressAction`
   takes no Einsatz-ID). Proof: green.
4. Remove the migrated cases from `auth-enforcement.test.ts` and
   `foreign-operation.test.ts`, and delete
   `map-actions.validation.test.ts` once nothing is left in it (each of its
   cases named in the record with where it went). Proof: `npm run check`
   green; the coverage comparison names no file.

## Not here
- The seven `kml-actions.*.test.ts` files belong to the server KML modules
  (tickets 20 and 25).
- `journal-actions.ts`, `strength-actions.ts`, and deleting
  `server-actions.validation.test.ts` and the `bad-calls` tables (ticket 05).
- The overlay `PUT` route's other-Einsatz case (ticket 06).
- No change to the actions themselves.

## Left standing
- **Review findings not fixed.** The one review round found no blocker and
  nothing that should be fixed. It found two nits:
  - Fixed: `addKmlUrlAction` and `reloadKmlAction` each had two `describe`
    blocks. Each action now has one; the shared loading-failure tests are
    registered inside it by `expectLoadingFailuresHandled`. The test names
    did not change.
  - Not fixed (nit): `image-overlay-actions.test.ts` checks "tells open
    clients" through a mocked `publishOperationChanged`, while
    `kml-actions.test.ts` counts events on the real bus (`subscribeOperation`).
    The mocked style was already in the image file and its cleanup-failure
    test also asserts `revalidatePath` through the same mock block. Switching
    would only change style, so it stays for the review tickets.
  Since only nits came back, there was no second round.
- **Checks not run.** None skipped. `npm run check` is green (231 files,
  2888 tests), after the last edit. `npm run test:coverage` and then
  `compare-coverage.mjs` exit 0. As after tickets 02, 03 and 08, the script
  names only `src/test/action-checks.ts` and `src/test/page-checks.ts` as
  "new, compared with nothing". No file's coverage dropped, no file needed a
  new test file, and no helper code moved, so `coverage-splits.json` is
  unchanged.
- **Advanced without an automated test.**
  - AC-1, AC-5, AC-9: I checked by listing the files.
    `map-actions.validation.test.ts` is deleted (it was 312 lines when this
    ticket started, not 568 - ticket 03 had already moved most of it), and
    each of the three modules has its test file. The largest touched file is
    `kml-actions.test.ts` at about 340 lines. Ticket 23 adds the check.
  - AC-3: no automated check yet. None of the three test files imports
    another `@/app/` module.
  - AC-6: the helpers were proven by breaking things by hand. Each break
    made the named test fail, and I restored all of them:
    - `assertText` on the URL removed from `addKmlUrlAction`: the bad calls
      "a URL of null" and "a URL of 2,001" and the "before fetching it" tests
      failed.
    - A fetch added at the start of `reloadKmlAction`'s body: "rejects
      reloadKmlAction with an object of another Einsatz and changes nothing"
      failed on the `nothingElseHappened` check (this ticket is its first
      user).
    - `loadKmlFromUrl` called before the login in `addKmlUrlAction`: "fetches
      nothing for an anonymous caller" failed, among others.
    - `setKmlVisibility` / `deleteKmlOverlay` called before the login: "login
      required › … › sends an anonymous caller to the login" failed for each.
      This is why the old "enforces the login before mutating" tests point
      there.
    - The Einsatz condition dropped from `setImageOverlayVisibility`'s
      `UPDATE`: "rejects setImageOverlayVisibilityAction with an object of
      another Einsatz and changes nothing" failed.
    - `geocodeAddressAction` passing `JSON.stringify(query)` on: the bad
      calls "a query as a number" and "a query of null" failed. The Photon
      mock always finds a hit, so the table's `[]` answer holds what the old
      "without asking Photon" assertion checked.
  - AC-8, AC-11: the commit's `Removed tests:` section is written from
    `removed-tests.mjs`. It names all 55 removed names, and each has its `→`
    line pointing to a test that exists.
- **AC-3 review list.** All three test files are added to
  `ac3-reviewed.txt`. I rewrote each whole and held every test in it against
  its own module. `auth-enforcement.test.ts` and `foreign-operation.test.ts`
  were only edited, so they are not listed.
- **Departures from the plan.**
  - `image-overlay-actions.test.ts` lost "lets a redirect thrown while
    deleting through instead of reporting an error". It checks only
    `operationAction`'s rethrow, which `operation-action.test.ts` › "lets a
    Next navigation error such as redirect through" already pins, and it
    could not run with the `redirect` mock the login check needs (that mock
    makes `redirectError()` return an error `unstable_rethrow` does not
    know).
  - Tests the plan did not ask for: success tests against the database for
    every KML action and for placing and hiding a Bild-Overlay (before, the
    KML ones were mock-call assertions and the two image ones had none); the
    trimmed URL in "adds the KML-Ebene fetched from the trimmed URL"; a "URL
    of blanks" bad call and before-fetch case, replacing the mocked "asks for
    a URL and creates nothing"; and a bad call 'visible as "yes"' for the
    Bild-Overlay and "placement of null", both from
    `map-actions.validation.test.ts`, which `bad-calls/map.ts` lacked.
  - The revalidation assertions of the old mocked KML tests are not
    repeated; `operation-action.test.ts` holds them, as in ticket 03.
  - `foreign-operation.test.ts` lost its `loadKmlFromUrl` mock and
    `fetchedUrls` assertion along with the KML rows: the one case left (the
    overlay `PUT` route, ticket 06) cannot fetch a KML.
- **Departures from a nudge.** None.
