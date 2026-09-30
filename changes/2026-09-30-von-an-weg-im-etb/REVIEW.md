# Review: Von, An und Weg im ETB

One review round of the whole change (`git diff 6392481`), by `critique` in a
fresh context against `CRITERIA.md`. It found no blockers and nothing to
fix before merging, only six nits, so there was no second round.

The reviewer checked the joins between the tickets and found them clean:
- Nothing was built twice. `submitOnCtrlEnter` moved into `EntryForm`; it
  was not copied there.
- The old `draft`/`editText` state is gone.
- Every automatic entry passes `NO_ROUTE`.
- AC-12 works through the existing `router.refresh()`.
- All 44 old `JournalPanel` tests survived the split.

## Fixed

- The "same Gesprächspartner" check had four different implementations:
  `toLowerCase`, and `localeCompare` with two different sensitivities. The
  client now uses one `correspondentKey`/`sameCorrespondent` in
  `entry-route.ts`, pinned by a test, which folds case the way the server's
  `lower()` does (996281c).
- `EntryRouteHeader` and `useEntryRouteMemory` moved from `JournalPanel.tsx`
  into `src/journal/`, next to `formatEntryRoute` and the route storage.
- `JournalPanel.tsx` no longer applies the default Weg (Funk) a second time.
- The glossary entry **Kopfzeile** now names `EntryRouteHeader` too (64bda7b).

## Left standing

- **`appendEntry` takes `{ text, route }` with the route nested, while
  `reviseEntry`/`correctEntry` take a flat `EntryContent`.**
  `addJournalEntryAction` unpacks the route only to nest it again. I left
  it: `appendEntry` has five other fields (operation, type, author …), and
  the nested `route` makes every automatic caller say `route: NO_ROUTE`
  explicitly. That fits the nudge that automatic entries never pass Von, An
  or Weg. Flattening would touch every automatic caller for no change in
  behaviour.
- **`EntryForm` has `pinned` and `compact`, and only the correction form sets
  them, always both together.** I left it: they mean different things (chip
  order vs. control size), and merging them into one "correction" flag would
  only rename the variation.
- **The glossary mentions "Route (`EntryRoute`)" only inside the entry for
  An.** I left it: Route is the code's name for Von+An+Weg, not a word users
  say, and the Kopfzeile entry covers what users see.
- **The case-folding rule is still written twice: in SQL (`lower()` in
  `listCorrespondents`) and on the client (`correspondentKey`).** Server and
  client cannot share code here. Both fold with `lower`/`toLowerCase` and
  agree.

## Checks

- `npm run check` (tsc, Biome, Vitest: 137 files, 1365 tests) is green after
  the fixes. The DB tests ran against the test container.
- AC-13 was not measured exactly. The reviewer measured the new-entry area in
  the desktop sidebar at 178 px and estimated the old one at about 100 px,
  which is within the 80 px limit but close to it. Nobody measured the old
  height on the base commit, and I did not re-check the UI in the browser
  after the fixes. They are refactors covered by the component tests.
