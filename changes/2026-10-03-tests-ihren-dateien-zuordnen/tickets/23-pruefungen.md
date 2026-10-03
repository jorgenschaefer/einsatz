---
criteria:  CRITERIA.md
closes:    AC-4, AC-5, AC-6, AC-7, AC-13
advances:
after:     02-actions-konten, 03-actions-kartenzeichen-bereiche, 04-actions-ebenen-bilder, 05-actions-etb-staerke, 06-routes-einsatz, 07-routes-links, 08-seiten, 09-live-verbindungen, 10-sitzung-geocoding-ebenen, 11-kartenpanels, 12-situation-map-leaflet, 13-bereiche-zeichnen, 14-kartenzeichen-bild-overlays, 15-situation-map-view, 16-arbeitsplatz-main-view, 17-etb-panel-anzeige, 18-etb-panel-formulare, 19-staerke-panel, 20-kml-icons-import, 25-kml-dokumente, 21-server-module, 22-auth-konfiguration-staerke
status:    ready
attempts:  0
---

## Build
The check in `npm run check` that keeps the rule: every test file pairs
with exactly one source file, and every server action module, route
handler and page has a test file running the shared checks its kind
requires. The rule is written into `CLAUDE.md`.

## Done when
> **AC-4** `npm run check` fails when a test file tracked by git has no source file of the same name next to it, or when a source file has two test files.

> **AC-5** Every server action module (a module whose first statement is `"use server"`), every route handler (`route.ts`) and every page (`page.tsx`) under `src/app/` has a test file, and `npm run check` fails when one has none.

> **AC-6** The test file of every server action module names every export of the module and checks for each:
> - that it requires login, unless the test file declares it public (today `loginAction` and `logoutAction`); for admin-only exports, that an anonymous caller is sent to the login and a logged-in non-admin is refused. Admin-only are the exports of `src/app/admin/users/actions.ts`, `deleteOperationAction`, and every later export the test file declares admin-only;
> - that it rejects bad input and stores nothing, unless the test file declares that it takes no input (today `logoutAction` and `logoutOtherSessionsAction`);
> - for modules under `src/app/operations/[id]/`, that given the Einsatz-ID of one Einsatz and an object of another, it rejects the call and changes nothing - unless the test file declares that the export takes only the Einsatz-ID, or takes no Einsatz-ID (today the journal and strength actions that take only an object id, and `geocodeAddressAction`).
>
> `npm run check` fails when such a test file leaves out one of these checks for an export, and when the module has an export the test file does not name.

> **AC-7** The test file of every route handler checks, for every HTTP method the route exports:
> - under `src/app/view/` and `src/app/device/`: 403 without a valid token;
> - elsewhere: that login is required;
> - for routes with an object id in the path (a segment other than `[id]` and `[token]`, today `[overlayId]`): an object id that is not a UUID is refused and nothing changes, with the answer the method gives before this change (today 404 for `GET`, and 400 "Ungültige ID." for `PUT` on `operations/[id]/overlays/[overlayId]`);
> - for `POST` and `PUT` under `src/app/operations/`: 401 before the body is read, rejection of a request from another site, and the size limit.
>
> `npm run check` fails when one of these is left out for a method, and when the route exports a method the test file does not name.

> **AC-13** The test file of every page checks what its location requires: under `src/app/view/` and `src/app/device/`, that no Einsatz data is shown without a valid token; under `src/app/admin/`, that admin rights are required; anywhere else, that login is required, or the test file declares the page public. A page under `view/`, `device/` or `admin/` cannot be declared public. `npm run check` fails when a page's test file does not check what its location requires.

Beyond the criteria: each violation the check reports says what to do
about it, so the fix follows from the message without reading `CLAUDE.md`
or the check's code. It names the file at fault, what is missing or
doubled, and the remedy - the test file to create or merge into, or the
helper to call and the file in `src/test/` that defines it. For example:
`src/app/x/actions.ts: its test file src/app/x/actions.test.ts does not
call expectBadCallsRejected (src/test/action-checks.ts)`, or
`src/map/Foo.bar.test.tsx: no source file Foo.bar.tsx - move its tests
into src/map/Foo.test.tsx`.

## Nudges
> The pairing check lives in `src/test/` next to `server-action-modules.ts`, as a source file with its own test file, and that test runs it against the repository.

> The check finds which checks a test file runs by searching it for the helpers' names, including the helper that declares a page public (for example `expectPublicPage(page)`).

> The pairing check reads the file list from `git ls-files`, so it never walks `node_modules` or `.claude/worktrees/`.

> Add the rule to the "Tests" section of `CLAUDE.md`.

## Context
- Tickets 02-22 and 25 moved every test to the file it tests and deleted the
  tests over many files. The shared checks, with the names this check
  searches for:
  - `src/test/action-checks.ts`: `expectEveryActionRequiresLogin`,
    `expectBadCallsRejected`, `expectForeignObjectsRejected` (each fails at
    run time when the module has an export its table or options do not
    name).
  - `src/test/route-checks.ts`: `expectRouteRequiresLogin`,
    `expectRouteRequiresToken`, `expectNonUuidObjectIdRefused`,
    `expectUploadRules` (each fails at run time when the route exports a
    method its `calls` do not name).
  - `src/test/page-checks.ts`: `expectPageRequiresLogin`,
    `expectPageRequiresAdmin`, `expectPageRequiresToken`,
    `expectPublicPage`.
  Read the three files first; if a name differs from this list, the files
  win.
- `src/test/server-action-modules.ts` (`serverActionModules(dir)`) finds the
  `"use server"` modules; reuse it. Its test is
  `server-action-modules.test.ts`.
- What the check requires, by kind:
  - every git-tracked file `X.test.ts` / `X.test.tsx`: a file `X.ts` or
    `X.tsx` beside it, and no second test file for the same `X` (AC-1, AC-2,
    AC-4);
  - every `"use server"` module under `src/app/`: a test file calling
    `expectEveryActionRequiresLogin` and `expectBadCallsRejected`, and under
    `src/app/operations/[id]/` also `expectForeignObjectsRejected` (AC-5,
    AC-6);
  - every `route.ts` under `src/app/`: a test file calling
    `expectRouteRequiresToken` under `src/app/view/` and `src/app/device/`,
    `expectRouteRequiresLogin` elsewhere; `expectNonUuidObjectIdRefused` when
    the path has a dynamic segment other than `[id]` and `[token]`;
    `expectUploadRules` under `src/app/operations/` when the route exports
    `POST` or `PUT` (AC-5, AC-7);
  - every `page.tsx` under `src/app/`: `expectPageRequiresToken` under
    `view/` and `device/`, `expectPageRequiresAdmin` under `admin/`,
    otherwise `expectPageRequiresLogin` or `expectPublicPage`;
    `expectPublicPage` is refused under `view/`, `device/` and `admin/`
    (AC-5, AC-13).
- Who reads the messages: mostly a coding agent that has just added an
  action, route, page or test file and sees `npm run check` fail. A
  message that names the remedy lets it fix the violation in one step
  instead of searching for the rule. Where the remedy is ambiguous (a
  topic test file whose tests may belong to several files), the message
  names the source file of the same stem and says each test goes to the
  file whose behaviour it tests.

## Plan
1. The AC-4 test first, red: `src/test/test-files.test.ts` (new) with
   cases for a lone topic test file, two test files for one source, and a
   test file without a source, against `checkTestFiles(files)` in
   `src/test/test-files.ts` (new), which takes the file list and returns the
   violations as messages; each case asserts the whole message, file and
   remedy included. Proof: red, then green once the pairing rule is written.
2. The entry-point rules (AC-5, AC-6, AC-7, AC-13) in the same function,
   with a case each in the test: a `"use server"` module without a test
   file, an action test without `expectBadCallsRejected`, a token route
   test calling `expectRouteRequiresLogin`, an admin page declared public.
   Each case asserts that the message names the missing helper and the
   file in `src/test/` that defines it. Proof: each case red before its
   rule, green after.
3. A test in `test-files.test.ts` that runs `checkTestFiles` on the real
   `git ls-files` output and expects no violations. Proof: green on the
   tree; make a copy of a topic test file by hand and see it fail with a
   message that names the remedy; remove the copy. If the real tree has violations, fix them here when each is a
   single file; more than that halts the ticket naming them.
4. Add the rule to the "Tests" section of `CLAUDE.md` (German, like the
   rest): one test file per source file, named after it; a test tests its
   own file; actions, routes and pages run the shared checks; `npm run
   check` enforces both. Proof: `npm run check` green.

## Not here
- The audit of the finished change - AC-1, AC-2 and AC-8 to AC-12 - is
  ticket 24's; the review of what each test tests (AC-3) is tickets
  26-31's.
- From `CRITERIA.md`'s Out of scope: a check of file sizes in
  `npm run check` (500 lines stays a guideline that review enforces), and
  coverage thresholds in `npm run check`.

## Left standing
