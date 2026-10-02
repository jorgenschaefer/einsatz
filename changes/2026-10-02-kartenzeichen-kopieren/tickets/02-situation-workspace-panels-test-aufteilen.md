---
criteria:  CRITERIA.md
closes:
advances:
after:
status:    ready
attempts:  0
---

## Build
Split `src/map/SituationWorkspace.panels.test.tsx` (648 lines) by topic before
ticket 01 adds a test to it. Behaviour and tests are unchanged; only where the
tests live changes.

## Done when
The tests of `src/map/SituationWorkspace.panels.test.tsx` live in three files,
each test unchanged and each one run exactly once:

- `src/map/SituationWorkspace.panels.test.tsx`: the map panels and the sidebar
  (the opening test, "the map panel in the sidebar on the desktop", "working
  beside the Lagekarte on the desktop", the phone ✕ test, the marking and
  switching tests, "crossing 768 px").
- `src/map/SituationWorkspace.phone-sheet.test.tsx` (new): the
  "closing the sheet on a phone" block.
- `src/map/SituationWorkspace.map-view.test.tsx` (new): where the
  map looks - saving and returning to the Einsatz's default view, and the zoom
  when jumping to a Kartenzeichen or Bereich (the two default-view tests before
  the "closing the sheet on a phone" block, and everything after it).

No production code changes, the number of tests `npm test` runs is the same as
before, and `npm run check` is green.

## Nudges

## Context
`CODING_STANDARDS.md` has a large file split before code is added to it.
Ticket 01 (Kartenzeichen kopieren) adds "closes it when a Kartenzeichen is
copied" to the "closing the sheet on a phone" block and comes `after:` this
ticket. The workspace tests were split by topic before (`8d8ebf7`); the shared
helpers are in `src/map/SituationWorkspace.fixtures.tsx`.

## Plan
1. **Count the tests before.** Run `npx vitest run src/map/SituationWorkspace.panels.test.tsx`
   and note the number of tests. Proof: the number.
2. **Move the "closing the sheet on a phone" block** with its `beforeEach` /
   `afterEach` into `src/map/SituationWorkspace.phone-sheet.test.tsx` (new),
   inside its own `describe("SituationWorkspace", …)`, with only the imports
   it uses. Proof: the new file runs green on its own.
3. **Move the map view tests** (from "saves the current map view
   as the default after confirming" through the end of the file, minus the
   block moved in step 2) into
   `src/map/SituationWorkspace.map-view.test.tsx` (new), the same way,
   including any `vi.doMock` / `vi.doUnmock` they rely on. Proof: green on
   its own.
4. **Trim the imports** of the remaining `SituationWorkspace.panels.test.tsx`.
   Proof: `npm run check` green (Biome flags unused imports), and the three
   files together run the number of tests from step 1.

## Not here
- Any change to production code or to what a test asserts.
- The copy test itself: ticket 01 adds it to the new phone-sheet file.
- Splitting the other workspace test files or `SituationMapView.tsx`.

## Left standing

