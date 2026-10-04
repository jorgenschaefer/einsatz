## For you

1. **Decide (review round 1, ticket 23):** `npm run check` requires the action checks only for `"use server"` modules under `src/app/`. The old `server-actions.validation.test.ts` covered every one in `src/`. AC-5 says "under `src/app/`", while AC-6 says "every server action module". None exists outside `src/app/` today. Extend the rule, or keep it?
2. **Decide (ticket 32):** this departs from a nudge. DeviceView's "renders the operation symbols read-only, without editing controls" was dropped whole, because its query could never fail. `ReadOnlySituationMap.test.tsx` now pins `draggable: false` instead.
3. **Clean up by hand (ticket 16):** the dev database still has the Einsatz "Upload-Test-Agent", with files under `data/uploads/`. An app-driving agent also briefly sent commands to someone else's browser driver on port 9231.
4. **Untested since before this change (tickets 18, 16):** nothing fails when `JournalPanel` also passes `presetChannel` to the correction form, so the remembered Weg could overwrite a corrected entry's Weg. Nothing pins `SituationWorkspace` passing `operationId` to `JournalPanel` either.
5. 24 more open items are below: 9 review findings I did not fix, then 15 left by the builds.

## Fixed in this review

Round 1 (critique of the whole diff, against CRITERIA.md) found no blockers and four should-fix items. I fixed three in three commits:

- `39b6bf1`: `src/strength/strength-total.ts` is now `src/strength/total.ts`, named after the glossary's `Total`. It was a mirror name of `src/server/strength/total-strength.ts`. `berlinTimeOfDay` is back in `strength.ts`, beside the tests in `strength.test.ts` that test it. The commit records the 27 renamed tests (AC-11).
- `ead2cb5`: `UPLOADS_DIR` is set in tests through one helper, `uploadsDirPerTest` (formerly `useUploadsDir`). Eight test files used to swap it by hand.
- `3598eff`: `oneOfEach` builds its Lagekarte objects with `oneOfEachIn`. `expectForeignObjectsRejected` compares every table and every upload with `snapshotDbAndUploads`, not `everythingIn`. The fixture moved from `src/test/bad-calls/fixture.ts` to `src/test/operation-fixture.ts`.

Round 2 (the whole diff again, with only the Stärke view named for driving) found no blockers and four should-fix items. I fixed three and part of the fourth:

- Live events are counted through `liveEventsFor` only. It now returns `{ result, events }`. Before, there were five names and four shapes.
- The ETB and Stärke objects of a test Einsatz are built once: `journalAndStrengthIn` in `operation-fixture.ts`. `src/test/journal-and-strength.ts` is gone.
- The sample Lagekarte objects come from `map-objects.fixtures.ts`:
  - `PUMPE` became `SYMBOL` and `KML` became `aKmlUrlOverlay`.
  - `succeed` and `karteNotification` are defined once each.
- `entry()` moved to `src/journal/JournalEntry.fixtures.ts`, beside `JournalEntryView`.

Each fix was made test-first where it changed what a helper does: `uploads-dir.test.ts`, `live-events.test.ts`, and `strength.test.ts` importing from `strength.ts`. The other fixes only move helpers, and the existing suite guards them. I broke code by hand to check two of them, and each break made the named tests fail. I restored both.
- I dropped the Einsatz condition of `moveMapSymbol`. "rejects moveMapSymbolAction with an object of another Einsatz and changes nothing" failed.
- I took `notifyAll` out of `publishOperationChanged`. Every "tells open clients" test of the moved files failed.

No commit of this review removes a test, except the renamed `total.test.ts` cases, which are recorded.

## Review findings not fixed

None of these departs from a nudge. I left them because they are nits, or, for the first one, for the reason given.

- **Round 2 should-fix 4, part not fixed.** `report`, `strength` and `minutesAfterReport` stay in `StrengthPanel.fixtures.tsx`, although `StrengthCards`, `ReportForms` and `StrengthHistories` tests use them. They build `StrengthReportView`, which is defined in `StrengthPanel.tsx`, so the fixture file already sits beside its type's home.
- **Nit (round 2):** `isReportStale` and `REPORT_STALE_AFTER_MS` describe a single Stärkemeldung, but they live in the Summe module `total.ts`. Moving them would also move their tests out of `total.test.ts`.
- **Nit (both rounds):** the component `JournalEntry` has the same name as the server type `JournalEntry`, which `src/app/operations/[id]/page.tsx` imports next to it.
- **Nit (round 1):** `ActAs` (action and page checks) and `SendAs` (route checks) name the same idea. `answerOf` in `route-checks.ts` and `visit` in `page-checks.ts` repeat the same "catch the redirect or rethrow" logic.
- **Nit (round 1):** `SituationMapView.test.tsx` (498 lines) stays under 500 only because its helpers moved into `SituationMapView.fixtures.tsx`, which has no other user. Four more test files are at 495-499 lines.
- **Nit (round 2):** `signIn` repeats the literal password instead of using the fixture's `PASSWORD`, although `PASSWORD`'s comment claims the link. `account/actions.test.ts` and `login/actions.test.ts` each have a second, local `PASSWORD`.
- **Nit (round 2):** several setup helpers are still repeated across route and action tests:
  - `anOperation()` in about 8 files;
  - the four-line `sendAs` in four route tests (left on purpose by ticket 06);
  - `pngFile` and `A_PLACEMENT` in two files each.

  `routeParams` lives in `src/test/upload-request.ts`, a name that hides it from tests that send no upload.
- **Nit (round 2):** `src/test/bad-calls/` now holds a single file, `bad-call.ts`, while `ForeignCalls` lives in `action-checks.ts`.
- **Nit (round 2):** the test "opens, switches and closes map sheets on a phone" in `SituationWorkspace.test.tsx` never switches panels.

The first round-2 reviewer stopped before reporting, and its area reports came in after it. They raised two points the final round-2 list did not take up:
- `expectForeignObjectsRejected` checks only the table's names for `geocode-actions` and `operations/[id]/actions`, because every entry there is declared "takes no / only the Einsatz-ID".
- The "takes no Einsatz-ID" declarations of the ETB and Stärke actions are not verified by anything. AC-6 allows such declarations. I did not judge either point further.

## Left standing by the builds

These are the builds' open items that are not blockers or should-fix. Each of the builds' review findings was settled in its own ticket: none is left as a blocker or should-fix. Ticket 22's nit (`berlinTimeOfDay` in the totals module) is fixed by `39b6bf1`. Ticket 11's nit (two runner tests checking `action-notification.ts`) was resolved by ticket 31.

- **Untested before this change too (ticket 18):** `compact` on the correction form, and `preventDefault` on Strg+Enter in `EntryForm` and `EntryRouteChips`.
- **Untested before this change too (ticket 19):** removing `key={correctingReport.id}` in `StrengthPanel.tsx` fails no test. `ReportTime`'s bold red stale time is pinned only through `data-stale`.
- **Untested before this change too (ticket 11):** dropping `notifications.hide` from `showActionError` fails no test.
- **App behaviour seen while driving, older than this change (ticket 16):**
  - each upload refreshes the page twice;
  - a broken KML (`<kml><broken`) is accepted and listed;
  - on a phone, "Datei ersetzen" is only reachable by reopening Ebenen.
- **App behaviour seen while driving, older than this change (ticket 17):**
  - number, time and author of an annulled entry are not struck through;
  - the Korrektur field gets no focus.
- **App behaviour seen while driving, older than this change (ticket 19):**
  - Escape does not close the name form;
  - the focus does not return to the name field after a rejected save;
  - the old error stays while a save is pending;
  - at 360 px with five or more Stellen, "+ Stelle" sits half behind the tab bar.
- **Unexplained (tickets 11, 13):** one `npm run check` run each reported `Errors 1 error` with every test passing. The output was lost, and later runs were clean.
- **Ticket 24, decided by you:** the `Removed tests:` record of 5523958 does not name the 17 `kmz.test.ts` tests it renamed.
- **Ticket 01:** the fixes made after its round-2 review were not reviewed again. No test pins that `removed-tests.mjs` cleans up its worktree on failure or Ctrl-C; the build checked it by hand.
- **Ticket 15:** `SituationMapView.test.tsx` still has tests that check two things under one name, joined by "and". The phone sheet closing after a jump is held only incidentally; ticket 16's `useMainView` tests were meant to pin it.
- **Ticket 16:** two round-2 fixes there were not reviewed again. Each failed under the reviewer's break before passing.
- **Ticket 29:** the Bild-Overlay and Ansichtslink cascade tests stay in their repositories' test files, while the journal, Kartenzeichen and Stärke cascades sit under `operations.test.ts`.
- **Ticket 31:** four older tests in `account-admin.test.ts` check the password by hand instead of through `passwordIs`. `datenschutz/page.test.tsx` has German test names.
- **Smaller nits (tickets 04, 07, 21):** these are recorded in each ticket's own record:
  - ticket 04: mocked versus real-bus event checks in `image-overlay-actions.test.ts`. The bus side is now `liveEventsFor`.
  - ticket 07: a 15-line `createImageOverlay` call in two route tests.
  - ticket 21: the `loadEntry(…, true)` flag, and the two return shapes in `map-symbols.test.ts`.
- **Comments:** German comments moved with tests into English test files (tickets 11, 12). The project comments in German throughout.

## Checks

- `npm run check` is green on the final tree: 201 files, 2692 tests.
- `npm run test:coverage`, then `compare-coverage.mjs`, exits 0 with no drop. It prints the same twelve "new, compared with nothing" notes as before. `coverage-splits.json` gained entries for `src/test/bad-calls/fixture.ts`, `src/test/journal-and-strength.ts` (`[]`) and `src/journal/JournalPanel.fixtures.tsx`.
- The scripts' own tests pass: `node --test changes/2026-10-03-tests-ihren-dateien-zuordnen/*.test.mjs`, 45 tests.
- `removed-tests.mjs` ran for each commit of this review.
- **Not run:**
  - The full suite on each intermediate commit. Where a commit holds an intermediate version of a file that a later commit also changes (`ead2cb5`, the live-events and map-fixture commits), I checked it in a separate worktree with `tsc`, Biome and the tests of the touched areas only.
  - The app was not driven. Both critique rounds judged it unnecessary, because the only production change of this review is the `total.ts` rename and its imports, and `StrengthPanel.test.tsx` renders the whole panel.
