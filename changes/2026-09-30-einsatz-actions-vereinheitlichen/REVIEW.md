# Review: Einsatz-Actions vereinheitlichen

Two review rounds over `git diff 0edf093` against `CRITERIA.md`. Neither found
a bug or blocker. `npm run check` is green after every fix (138 files, 1414
tests).

## Fixed

- `WorkspaceSymbol` now extends `StatefulSymbol` instead of repeating its fields.
- Every test Kartenzeichen is built from `src/map/symbol.fixtures.ts`
  (`aStatefulSymbol`, `aSymbol`). Before, six test files each wrote out the
  required fields.
- A failed Bild-Overlay deletion now logs under the same prefix as
  `operationAction` ("Einsatz-Action fehlgeschlagen:"). The old prefix was
  "Bild-Overlay-Verarbeitung fehlgeschlagen:", left over from upload processing.

## Left standing

- **Two catch paths for unexpected server errors** (should-fix, both rounds).
  `deleteImageOverlayAction` still uses its own `toError` + `toFormError`,
  which do the same thing as `operationAction`'s fallback branch but without
  `unstable_rethrow`. The reviewer checked that routing the deletion through
  `operationAction(…, DELETE_FAILED)` keeps all AC-6 tests green. That would
  go against the agreed design ("Außerhalb bleiben nur
  `deleteImageOverlayAction` …") and the nudge that `toError` stays for it, so
  it was not done. Only the log prefix was unified. `toFormError` is still
  exported from `operation-action.ts` for this one caller. Worth revisiting in
  a follow-up.
- **`runMapAction` wording and redirect handling** (nit). It shows
  "Aktion fehlgeschlagen. Bitte erneut versuchen." where the new hook shows
  "Das hat nicht geklappt. Bitte erneut versuchen.". It also does not check
  `isNextNavigation`, so an expired session briefly shows that message before
  the login page. Fixing this goes against the nudge "`runMapAction` … nicht
  anfassen" and against "Andere Fehlertexte" being out of scope. Follow-up.

## Checks

- `npm run check` ran after every fix.
- The second-round reviewer checked AC-1 in the running app with two browsers:
  a new Ansichtslink appeared in the other client without a reload.
- The red failure alert in "Ansichtslinks teilen" (AC-2) was not seen in the
  running app. Forcing a failure would have meant stopping the dev database.
  Component tests cover it.
- The reviewer removed the navigation check from `useActionRunner`, and all 11
  redirect tests failed. So the AC-7 tests do catch a regression.
