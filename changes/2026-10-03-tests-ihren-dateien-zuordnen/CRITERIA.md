# Criteria: Jede Testdatei gehört zu genau einer Datei

## Problem
Someone who changes a file does not find its tests next to it. The tests
are spread over other test files, so they cannot tell whether a missing test
is missing or only lives somewhere else. Tests that check many files at once
keep hand-written lists of what they check (`userGuardedActions` in
`src/app/auth-enforcement.test.ts`), so a new action, route or page that
nobody adds to the list goes unchecked and no test fails.

What should be true instead: the tests of a file are found next to it and
test that file, and a security check that every entry point needs cannot be
forgotten for a new one.

Instance: slicing `changes/2026-10-03-kartenpanels-auffinden`, ticket 01 had
to say "do not add another `SituationWorkspace.*.test.tsx` file".
`src/map/SituationWorkspace.tsx` (229 lines) has 14 test files with about
4500 lines, which test mostly behaviour of other files - `SituationMapView.tsx`
(387 lines, no test file of its own), `useMainView.ts`, `useAreaFlows.ts`,
`useSymbolPlacement.ts`, `useImageOverlayEditing.ts`. The same pattern exists
elsewhere, as of 2026-10-03:

- Several test files for one source file: `src/journal/JournalPanel.tsx` (7),
  `src/app/operations/[id]/kml-actions.ts` (8), `src/strength/StrengthPanel.tsx`
  (6), `src/map/leaflet-adapter.ts` (5), `src/map/leaflet-areas.ts` (4),
  `src/server/journal/journal.ts` (4), `src/map/KmlPanel.tsx` (3), and 17 more
  with two each.
- Test files named after no file: `attempt-login`, `password-cost`,
  `correspondents`, `journal-history`, `security-headers`, and the tests over
  many files in `src/app/`: `auth-enforcement`, `server-actions.validation`,
  `operations/[id]/map-actions.validation`, `operations/[id]/foreign-operation`,
  `operations/[id]/uploads`, `token-views.hidden-layers`,
  `live-connections-end`, `live-connection-limits`, `session-lifetime`,
  `token-geocode-limits`, `overlay-routes.not-a-uuid`.
- Test files over 500 lines: `SituationWorkspace.areas` (738), `SituationMap`
  (690), `KmlPanel` (644), `server/strength/strength-reports` (579),
  `SituationWorkspace` (569), `map-actions.validation` (568).
- Pages are not checked for login at all: no test fails when a new
  `page.tsx` forgets `requireUser()`.

## Acceptance criteria
- **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.
- **AC-2** No source file has more than one test file. A source file may have none.
- **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.
- **AC-4** `npm run check` fails when a test file tracked by git has no source file of the same name next to it, or when a source file has two test files.
- **AC-5** Every server action module (a module whose first statement is `"use server"`), every route handler (`route.ts`) and every page (`page.tsx`) under `src/app/` has a test file, and `npm run check` fails when one has none.
- **AC-6** The test file of every server action module names every export of the module and checks for each:
  - that it requires login, unless the test file declares it public (today `loginAction` and `logoutAction`); for admin-only exports, that an anonymous caller is sent to the login and a logged-in non-admin is refused. Admin-only are the exports of `src/app/admin/users/actions.ts`, `deleteOperationAction`, and every later export the test file declares admin-only;
  - that it rejects bad input and stores nothing, unless the test file declares that it takes no input (today `logoutAction` and `logoutOtherSessionsAction`);
  - for modules under `src/app/operations/[id]/`, that given the Einsatz-ID of one Einsatz and an object of another, it rejects the call and changes nothing - unless the test file declares that the export takes only the Einsatz-ID, or takes no Einsatz-ID (today the journal and strength actions that take only an object id, and `geocodeAddressAction`).

  `npm run check` fails when such a test file leaves out one of these checks for an export, and when the module has an export the test file does not name.
- **AC-7** The test file of every route handler checks, for every HTTP method the route exports:
  - under `src/app/view/` and `src/app/device/`: 403 without a valid token;
  - elsewhere: that login is required;
  - for routes with an object id in the path (a segment other than `[id]` and `[token]`, today `[overlayId]`): an object id that is not a UUID is refused and nothing changes, with the answer the method gives before this change (today 404 for `GET`, and 400 "Ungültige ID." for `PUT` on `operations/[id]/overlays/[overlayId]`);
  - for `POST` and `PUT` under `src/app/operations/`: 401 before the body is read, rejection of a request from another site, and the size limit.

  `npm run check` fails when one of these is left out for a method, and when the route exports a method the test file does not name.
- **AC-13** The test file of every page checks what its location requires: under `src/app/view/` and `src/app/device/`, that no Einsatz data is shown without a valid token; under `src/app/admin/`, that admin rights are required; anywhere else, that login is required, or the test file declares the page public. A page under `view/`, `device/` or `admin/` cannot be declared public. `npm run check` fails when a page's test file does not check what its location requires.
- **AC-8** For every check in AC-6 and AC-7, every action and route that was checked for it before the change is still checked for it after the change.
- **AC-9** When the change is done, no source file and no test file is over 500 lines.
- **AC-10** For every source file, the share of covered lines and the share of covered branches, measured with `@vitest/coverage-v8`, are no lower after the change than on the commit the change starts from. A source file that was split is compared by adding up the covered and total lines and branches of its parts.
- **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.
- **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Agreed design
Every test file belongs to exactly one source file, by name and by content;
a source file has zero or one test files. A test in `Bar`'s test file may
run other files - `Bar`'s children and hooks, a harness, fixtures, fakes -
but what it asserts is `Bar`'s behaviour; a test that checks only `Foo`'s
behaviour is a test of `Foo`. Where `Foo`'s behaviour can only be reached
through `Bar`, that shows broken coupling, and the code is restructured, not
the test.

Tests over many files are dissolved into the test files of the files they
check. What they share becomes helpers that take a whole module and cover
every export of it, so a new export cannot be forgotten. One check, run by
`npm run check`, enforces the pairing (AC-4) and requires a test file calling
the right helpers for every server action module, route handler and page
(AC-5 to AC-7, AC-13).

Test files that are too long are shortened first, and split together with
their source file only if they are still too long. No test is lost: coverage
per file does not drop (AC-10), and every removed test is accounted for in
its commit (AC-11). A file without a test file whose coverage would drop
because a test moved away gets a test file of its own, holding tests of its
own behaviour, rather than keeping a test that belongs elsewhere.

## Nudges
- The pairing check lives in `src/test/` next to `server-action-modules.ts`, as a source file with its own test file, and that test runs it against the repository.
- The helpers take the whole module - for example `expectEveryActionRequiresLogin(module)` - and check that their tables name exactly the module's exports, like the test "names every exported server action, and nothing else" in `src/app/server-actions.validation.test.ts` does today for all modules.
- The check finds which checks a test file runs by searching it for the helpers' names, including the helper that declares a page public (for example `expectPublicPage(page)`).
- Mocks (`next/headers`, `next/navigation`, `@/server/db/pg`) stay at the top of each test file, because `vi.mock` is only hoisted in the test file itself. The helpers do not mock.
- The tables in `src/test/bad-calls/` move to the test files of their modules.
- Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.
- `src/map/SituationWorkspace.test.tsx` keeps the tests of the workspace's own wiring.
- `src/security-headers.test.ts` becomes `next.config.test.ts` at the repository root; the `include` of the node project in `vitest.config.mts` must then cover it, or it silently stops running.
- Keep `browserTestsInTs` in `vitest.config.mts` in step with renamed test files.
- The pairing check reads the file list from `git ls-files`, so it never walks `node_modules` or `.claude/worktrees/`.
- Every jsdom test file costs about 3 s of setup; watch the runtime of `npm test` as test files multiply.
- Measure the coverage baseline on the commit the change starts from and keep it in this directory. Add `@vitest/coverage-v8` as a dev dependency and a `test:coverage` script; do not add it to `npm run check`.
- Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.
- Add the rule to the "Tests" section of `CLAUDE.md`.

## Out of scope
- Tests for source files that have none today, other than server action modules, route handlers, pages, and files whose coverage would otherwise drop (AC-10).
- Layouts (`layout.tsx`): they only wrap pages and load no Einsatz data.
- Requiring the other-Einsatz check for new route handlers with an object id; AC-8 keeps today's check on `operations/[id]/overlays/[overlayId]`, and nothing requires it of later routes.
- A check of file sizes in `npm run check`; 500 lines stays a guideline that review enforces.
- Coverage thresholds in `npm run check`.
- Mutation testing.
- Any change of behaviour.

## Ruled out
- **Topic test files (`X.<topic>.test.ts`) counting as `X`'s test file** - the rule is one test file per source file.
- **A list of today's violations that may only shrink** - it stops new violations but leaves the old ones in place.
- **A test file required for every source file** - not every file needs a test; the rule is about pairing.
- **Pairing alone, without required checks for actions, routes and pages** - a new entry point without tests would never be checked for login or bad input, a guarantee the bad-input checks give today.
- **The guarantee as a wrapper in production code** - a larger change to production code for what the check gives in the tests.
- **Requiring only the login and bad-input checks** - a new Lagekarte action would lose the other-Einsatz check, and token routes their 403 check.
- **Mutation testing** - too slow on about 4500 lines of DOM tests to pay off.
- **A hard size limit in `npm run check`** - decided against by the user; review enforces it.
