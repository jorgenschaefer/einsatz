---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11
after:     15-situation-map-view
status:    done
attempts:  1
---

## Build
`useMainView` gets its own test file, `SituationWorkspace.test.tsx` keeps
only the workspace's own wiring, the last tests of the Lageansicht's topic
files move to the file they test, and every
`SituationWorkspace.<topic>.test.tsx` is deleted.

## Done when
Toward AC-1 and AC-2: no `src/map/SituationWorkspace.<topic>.test.tsx`
exists; `SituationWorkspace.tsx` has exactly one test file.

Toward AC-3: `src/map/useMainView.test.ts` (new) tests `useMainView`
directly; `SituationWorkspace.test.tsx` holds only tests of what
`SituationWorkspace.tsx` itself does or wires together.

Toward AC-9: `SituationWorkspace.test.tsx` (569 lines) and
`useMainView.test.ts` are under 500 lines.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-2** No source file has more than one test file. A source file may have none.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

## Nudges
> `src/map/SituationWorkspace.test.tsx` keeps the tests of the workspace's own wiring.

> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Keep `browserTestsInTs` in `vitest.config.mts` in step with renamed test files.

> Every jsdom test file costs about 3 s of setup; watch the runtime of `npm test` as test files multiply.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- `SituationWorkspace.tsx` (229) itself: the live-event hook whose callback
  refreshes the router; closing the Lageansicht notifications on unmount;
  `useMainView`; `useStalenessClock` → `now`; `mapRef`; `refreshingAfter`
  (router refresh after a successful upload, built with `uploads.ts`);
  `saveDefaultView` (`MAP_LOADING` without a map);
  `setDefaultViewDisabled={!mapShown}`; `MainViewBar` rendered twice (shell
  navigation and `.sidebar-bar`); `data-layout="unknown"` while
  `isDesktop === null`; the ETB and Stärke panes kept mounted and hidden
  with `display: none`.
- `useMainView.ts` (106, no test) takes `{ journalEntries, currentUsername }`
  and reads `matchMedia` (`useIsDesktop`) and `visualViewport`
  (`useKeyboardOpen`): `renderHook` with `stubMatchMedia` /
  `stubVisualViewport` from `src/test/`. To test the cursor in the ETB,
  attach `newEntryRef` to a real textarea. A test without `stubMatchMedia`
  runs as a phone (`src/test/setup.ts`).
- What goes where (tickets 13-15 have taken theirs):
  - `useMainView.test.ts`: from `SituationWorkspace.test.tsx` the counting
    of new ETB entries (describe.each, partly duplicating `MainViewBar.test`
    L41-62), starting on the ETB on phone and desktop, keeping the main view
    across 768 px, the cursor in the ETB (L453-498); from `panels` no sheet
    at start on a phone, the desktop sidebar describe (except "switches the
    sidebar with its own bar", which is workspace wiring), switching and
    closing sheets, the sheet open across ETB/Stärke, the crossing-768 px
    describe, the panel switch not under ETB/Stärke, the on-screen keyboard
    describe; from `modes` which main view hides the map (L78, L86 and the
    rest of that kind); from `phone-sheet` the desktop case (the sheet stays
    open); from `areas` L288 and the `mapShown` side of L441/L449; from
    `map-view` setting the default view disabled or usable per view (L112)
    and with a sheet open on a phone (L136), where the decision is
    `useMainView`'s.
  - `SituationWorkspace.test.tsx` keeps: the Stärke pane hidden/shown, a
    half-filled Stärkemeldung and an ETB entry surviving view switches (the
    panes stay mounted), not recreating the map, the server-rendered
    `data-layout="unknown"`, reloading on a live event, `MainViewBar` twice,
    "working beside the Lagekarte", and takes: `saveDefaultView` (map-view
    L35, L92), the uploads wiring (`uploads` L43, L58, L98, L118; layers
    L238), closing the Lageansicht notifications on unmount
    (`notifications` L46, L56), going stale while the view stays open
    (symbols L452).
  - `SituationMapView.test.tsx`: `addImage` before the map has loaded
    (`uploads` L75).
  - `LageansichtShell.test.tsx` (385): the phone bar hidden while the
    keyboard is open (`SituationWorkspace.test` L430; no Shell test has it).
  - `KmlPanel` and `ViewLinkPanel` tests (one file each since ticket 11):
    KML-Ebenen notifications surviving the panel unmounting
    (`notifications`, 4 tests) and the Ansichtslinks notification (L134), or
    dropped where their merged tests already pin them.
  - Duplicates to drop (break by hand to confirm): the Stärke tests at
    `SituationWorkspace.test` L177-311 (`StrengthPanel` tests), "shows the
    latest ETB entry" and "adds an entry" (`JournalPanel` tests), the
    operation name in the header (L26) and the connection-lost symbol
    (L544) (`LageansichtShell.test` L48, L370), map-view L59 and the
    confirm dialog (`LageansichtShell.test`), the panel switch offers
    (`MapPanelSwitch.test`), "no panel button among the Kartenknöpfe"
    (`MapControls.test`), layers L308 (`uploads.test` L126), the
    near-duplicate "does not recreate the map" in `panels` L453.
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
1. `src/map/useMainView.test.ts` (new) with the cases listed for it.
   Proof: green; make `selectMapPanel` toggle on the desktop too by hand and
   see the desktop sidebar tests fail; restore.
2. Move the workspace cases from the topic files into
   `SituationWorkspace.test.tsx`, drop its duplicates, shorten. Proof:
   green; `wc -l` under 500.
3. The Shell, KmlPanel, ViewLinkPanel and SituationMapView cases. Proof:
   green.
4. Delete every `SituationWorkspace.<topic>.test.tsx` (each should be empty;
   anything left is moved or recorded first). Proof: `npm run check` green;
   `ls src/map/SituationWorkspace.*.test.tsx` lists nothing (the pattern
   matches only topic files); the coverage comparison names no file.

## Not here
- The JournalPanel and StrengthPanel tests themselves (tickets 17-19).
- No change of behaviour.

## Left standing
- **Review findings not fixed.** There were two review rounds. Each
  found two should-fix and no blockers. I fixed all four:
  - Round 1: the desktop case of `closeSheetOnPhone`, and an upload
    without a session never settling.
  - Round 2: the workspace handing `currentUsername` to `useMainView`,
    and editing going on after a successful file replacement.

  Round 2 said "one nit" but listed none. The two-round limit means
  nobody reviewed the round 2 fixes. Each is one assertion, and each
  failed under the reviewer's mutation before I restored the code.

  The first reviewer also saw three things in the app that this change
  did not cause. I did not touch them:
  - Every successful upload refreshes the page twice, probably once
    from `router.refresh()` and once from the live event.
  - A broken KML (`<kml><broken`) is accepted with 200 and listed.
  - On a phone, "Datei ersetzen" is only reachable by reopening Ebenen
    after "Bearbeiten" closes the sheet.
- **Left behind by the review's app run.** Two things need cleaning up
  by hand:
  - The dev database still has the Einsatz "Upload-Test-Agent", with
    files under `data/uploads/`.
  - An app-driving agent briefly sent commands to someone else's
    browser driver on port 9231.
- **Checks not run.** None skipped:
  - After the last edit, `npm run check` is green (205 files, 2692
    tests, 42 s).
  - `npm run test:coverage` and then `compare-coverage.mjs` exit 0
    with no drop. The only file from this ticket that the comparison
    names is `useUploads.ts`, which is now listed in
    `coverage-splits.json` as a part of `SituationWorkspace.tsx`. No
    file needed a new test file for coverage.
  - The first commit (the `useUploads` split) was checked on its own
    in a worktree with tsc, biome and every test in `src/map`
    (72 files), not with the full suite.
- **A gap this ticket did not close.** No test pins `SituationWorkspace`
  passing `operationId` to `JournalPanel`. It was never pinned: the old
  tests let it pass when I replaced it by hand.
- **Advanced without an automated test.**
  - AC-1 and AC-2: `ls src/map/SituationWorkspace.*.test.tsx` lists
    nothing.
  - AC-9: checked with `wc -l`. `SituationWorkspace.test.tsx` has 499
    lines, `useMainView.test.ts` 357, `SituationWorkspace.fixtures.tsx`
    228, `useUploads.ts` 32 and `useUploads.test.ts` 83.
  - AC-11: the commit's `Removed tests:` section comes from
    `removed-tests.mjs` and names all 100 removed tests, two of them
    renames. Some tests are marked "gone". For each, I broke its
    behaviour by hand, saw the named test fail, and restored the code.
    For the workspace's own wiring, I made 51 hand-made breaks, one at a
    time: each prop and call replaced with a no-op or a fixed value. Every one made a test in
    `SituationWorkspace.test.tsx` fail, except the `operationId` above.
  - For `useMainView` I broke 15 decisions by hand, one at a time. Each
    made a test in `useMainView.test.ts` fail. Making `selectMapPanel`
    toggle on the desktop failed the desktop sidebar test, as the plan
    asks.
  - AC-3: `ac3-reviewed.txt` gains three files:
    - `useMainView.test.ts` and `useUploads.test.ts`, which this ticket
      created;
    - `SituationWorkspace.test.tsx`, which this ticket rewrote. I held
      every test in it against the workspace's own wiring with the
      sweep above.

    The test files I only edited are not listed:
    `LageansichtShell.test.tsx`, `KmlPanel.test.tsx`,
    `ViewLinkPanel.test.tsx`, `useImageOverlayEditing.test.ts`,
    `uploads.test.ts` and `useNotifyingActionRunner.test.tsx`.
  - AC-12: `useUploads` is the old inline code moved word for word.
    The first reviewer drove the three uploads at 375 px and 1920 px.
    Each upload sent its request and showed its result after the
    refresh. A refused upload showed its notification.
- **Departures from the plan and Context.**
  - **`SituationWorkspace.tsx` was split.** The plan did not foresee
    this. Even after shortening, the workspace tests came to more than
    600 lines, because they hold what the old tests held. The uploads
    (`refreshingAfter` and the three route uploads) moved into
    `useUploads.ts`, which has its own tests. This is a commit of its
    own. I chose not to split the ETB and Stärke panes off as a
    component. That component would only pass the same 16 props on,
    and the relay would need its own tests again.
  - **The fixtures now hold the UI steps.** `SituationWorkspace.fixtures.tsx`
    holds one step for each handler the workspace passes on
    (`annulJournalEntry`, `renameStation`, …), so the table in the test
    file stays short.
  - **Kept as wiring, though Context named them duplicates.**
    - The operation name and the connection-lost symbol: they are the
      only tests of `operationName` and `connected` reaching the shell.
    - One test of Standard-Ausschnitt festlegen being disabled or
      usable, for `setDefaultViewDisabled={!mapShown}`.
  - **Pinned for the first time.** These pass-throughs were never
    tested: `status`, `viewLinks`, the live events URL,
    `correspondents`, correcting and annulling in the ETB and in
    Stärke, and `onDeleteViewLink`.
  - **Where the KML-Ebenen notifications went.** "Through an action in
    the Bild-Overlays panel" went to `useNotifyingActionRunner.test.tsx`,
    because closing only its own source is the runner's decision. The
    other three cases all unmount `KmlPanel`, so one KmlPanel test holds
    them.
  - **Owning tests made stronger before dropping a test.** Context
    called some tests duplicates, but breaking the behaviour by hand
    showed they were not fully held elsewhere:
    - `useImageOverlayEditing.test.ts` shows a failed replacement in the
      editor, and keeps editing after a successful one.
    - `uploads.test.ts` checks that the upload without a session never
      settles.
    - `LageansichtShell.test.tsx` checks that there is no banner.
  - **"Working beside the Lagekarte" lost two rows.** The "Eintrag
    hinzufügen" and "Unverändert melden" rows are gone. They are the
    panels' second ways to submit, and the panels' own tests hold them.
- **Departures from a nudge.** None. `browserTestsInTs` already matches
  `src/map/use*.test.ts`. On balance there are seven fewer jsdom test
  files (nine deleted, two added). `npm test` took 41-43 s, about the
  same as before.
