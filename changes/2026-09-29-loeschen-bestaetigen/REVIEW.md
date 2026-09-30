# Review: Unwiderrufliche Aktionen einheitlich bestätigen

The whole change from `cb52b626` was reviewed twice by `critique`, each time with a fresh context. Neither review found a blocker or a correctness defect. `npm run check` is green after the last fix commit: tsc, biome, and vitest with 117 files and 1192 tests.

## Fixed

- **Konto löschen lost the name while fading out.** The dialog showed "Das Konto  wird unwiderruflich gelöscht." without the name while it faded out. It now keeps the account the same way the KML and view link dialogs do, and a test pins this. Commit `3767ba38`.
- **`ActionResult` lived under the `operations/[id]` route** although the admin actions and `ConfirmationModal` use it. It moved to `src/app/action-result.ts`. Commit `21e52544`.
- **`deleteOperationAction` was typed `Promise<ActionResult>`** but only redirects or throws. It is now `Promise<never>`. Commits `713b4a11` and `79d75c63`.
  - This departs from the CRITERIA nudge that it "liefert im Fehlerfall ein ActionResult". `deleteOperation` has no failure with a meaningful message; it throws no `ValidationError`. So every failure shows the generic message in the dialog, which AC-4 and AC-9 allow.
- **The confirm button defaulted to blue**, although 10 of the 12 Rückfragen pass red. Red is now the default. "Gesamtstärke melden" and "Standard-Ausschnitt festlegen" ask for blue explicitly. Commit `88413e13`.
- **One test stub had two names:** `succeed` and `deleteNothing`. Both are now called `succeed`. Commit `3f90952a`.

## Left standing

- **Four ways to hold "which object is being confirmed" (both rounds).** The callers use four different shapes for this:
  - KmlPanel, ViewLinkPanel and UserAdminPanel keep a target and a flag. Each has a `target ? … : {}` guard that can never be reached.
  - JournalPanel and StrengthPanel mount the dialog only once there is a target, and use a disclosure.
  - SituationWorkspace uses an id-keyed `deleteAskedFor`.
  - The single-object callers use a plain boolean.

  I did not fix this because the behaviour is the same everywhere, and after the fix above every shape keeps the title while the dialog fades out. Unifying the shapes would rewrite the state of three components with no change a user can see. If a thirteenth Rückfrage is added, the JournalPanel/StrengthPanel shape is the one to copy.
- **Callers' tests repeat `ConfirmationModal`'s own behaviour (both rounds).** Locking, Escape, clicking beside the dialog, and the fallback text are tested again in many caller suites. The failure text appears in 11 test files. I did not remove these tests:
  - The per-caller lock tests prove that each caller passes its promise through instead of firing and forgetting, so they are not pure duplicates.
  - Deciding which of the rest to drop means going through about nine suites. That is a separate clean-up, not a fix to this change.
- **Unrelated commit in the range.** The range also contains `6af4e3fb` (switch to `@taktische-zeichen/core`), which has nothing to do with this feature. The review found nothing wrong with it.

## Checks not run

- `critique` drove these in the real browser at 390×844 and 1280×800: Ansichtslink löschen with an 80-character name, Gerätelink neu generieren, Kartenzeichen löschen, and Einsatz löschen.
- Nobody drove Bereich, Bild-Overlay, KML or Konto löschen in the browser, and none of the fixes after round 2 were driven in the browser either. For those, only unit tests cover AC-10 and the button colours.
