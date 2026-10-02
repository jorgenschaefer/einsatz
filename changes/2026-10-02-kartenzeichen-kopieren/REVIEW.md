# Review: Copy a Kartenzeichen, add Notunterkunft to the Schnellauswahl

One review round over `git diff c6a7c8d` against `CRITERIA.md`. It came back
with nits only (no blockers, nothing should-fix), so there was no second round
and no code changed.

## Checks
- `npm run check` (tsc, Biome, Vitest: 166 files, 1714 tests) is green. That
  is 10 more tests than the 1704 before the change, and all 42 tests from the
  old `SituationWorkspace.panels.test.tsx` still exist, with the same names,
  in `panels`, `phone-sheet` or `map-view`.
- The reviewer checked AC-1, AC-2, AC-3, AC-8 and AC-9 in the running app at
  1280x800 and 360x780. At 360 px the name ends in "…", pen and Kopieren are
  fully visible, and `scrollWidth` equals `clientWidth`.
- Not checked in this review: AC-7 (the copy appears live for a second user).
  It goes through the same `placeMapSymbolAction` → SSE path as every other
  placement, and ticket 01's build reviewer checked it with two sessions.
  AC-4 and the server side of AC-3 are covered only by client-side tests. That
  is enough because `createMapSymbol` takes only a composition and a position,
  so a copy has no way to carry a Gerätelink.

## Findings left standing
- **`src/map/SituationMapView.tsx` (385 lines) gained the `onCopy` wiring
  without a split first.** Ticket 02 put that split under "Not here", and
  ticket 01 recorded it as left standing. A large file gets its own split
  ticket even when it only gains wiring. That split is a separate ticket for
  the next change that touches this file, so it was not done in the review.
- **The test split was aimed at the wrong file.** Ticket 02 split
  `SituationWorkspace.panels.test.tsx` because ticket 01 would add a test to
  it. In the end only one copy test went into the split-off `phone-sheet`
  file, and most of the new tests went into
  `SituationWorkspace.symbols.test.tsx`, which grew from 333 to 460 lines.
  That file now covers placing, copying, the detail dialog, deleting,
  Gerätelink and stale markers. A natural split is placing and copying versus
  the detail dialog and marker display. Not done here for the same reason: it
  is its own ticket.
