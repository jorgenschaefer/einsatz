# Review: Kartenpanels auffinden

There are no open decisions for you. The build reports listed no blocker or
should-fix finding, and the review of the whole change found only nits.

## Review rounds

- **Round 1:** one fresh-context `critique` review of `git diff dd225ba..HEAD`,
  judged against CRITERIA.md and the specimen. Its driver ran the app at
  1440×900, 768×900, 390×844 and 360×740, plus the Ansichtslink and Gerätelink
  views. It found no blocker and no should-fix. AC-1 to AC-14 held in the app.
  It found four nits.
- **No round 2:** round 1 came back with nits only. I fixed three of them
  test-first and stopped there.

## Fixed

- **Focus after a menu dialog closes:** after "Teilen" or "Standard-Ausschnitt
  festlegen" closed, the focus fell to `<body>`, because the menu item that
  opened the dialog was already gone. Now both dialogs give the focus back to
  the ⋮ button they were opened from. `ConfirmationModal` gets an `onExited`
  prop for this. The review only reported this for festlegen; the new test
  showed that Teilen had the same problem.
- **Nested Stacks:** `MapControls` had two nested `Stack`s around a single
  button. They are now one. The phone rule that hides it under an open sheet
  now targets `.map-controls`. This is the round-2 nit that tickets 01 and 02
  left standing.
- **One name for the festlegen action:** it is `onSetDefaultView` on both
  `SituationWorkspace` and `LageansichtShell`. The confirmation's disclosure
  is now `setDefaultViewConfirmation`.

## Left standing

- **Nit: the keyboard rule is decided in two places.** The row hides in
  `useMainView` (`panelSwitchShown`) and the bottom bar hides in
  `LageansichtShell`, and each reads `useKeyboardOpen()` on its own. If the
  bar's rule changes, the row would not follow, and no test would catch it.
  - Why not fixed: both read the same hook today, so they cannot drift without
    someone editing one of them. Putting the decision in one place would mean
    the shell takes a prop from the workspace just for this, for a nit.
- **Nits from the build reports, for acceptance:**
  - At 360 px, "Zurück" overlaps Leaflet's zoom-in by about 2 px when the
    attribution wraps. This was already the case before the change.
  - At 768 px, Einsatz names longer than about 66 characters will wrap in the
    desktop header.

## Checks

- **`npm run check`:** green after the fixes (230 files, 2773 tests). It was
  also green at the start (2769 tests).
- **Not seen in the browser:** the focus fix and the Stack merge. They are
  pinned only by jsdom tests:
  - focus on ⋮ after Escape, in both dialogs and both headers;
  - "Zurück" inside `.map-controls` under `data-panel-open`.

  No layout check confirms that the merged Stack still sits in the same place,
  and that it still hides on the phone while a sheet is open. Its class and
  position CSS are unchanged.
- **Not checked by the review:**
  - The read-only views were not compared side by side with `main`, because a
    worktree of `main` would not start under Turbopack. Their files are
    unchanged.
  - The on-screen keyboard was simulated by shrinking `visualViewport`.
