---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11, AC-12
after:     01-coverage-ausgangswert
status:    done
attempts:  1
---

## Build
`KmlPanel`, `ImageOverlayPanel` and `ViewLinkPanel` each get exactly one
test file: their `.notification` and `.document` test files are merged in,
tests of the shared action runner they only repeat are dropped, and where a
merged file is still over 500 lines the component is split together with
its test.

## Done when
Toward AC-1 and AC-2: `KmlPanel.notification.test.tsx`,
`KmlPanel.document.test.tsx`, `ImageOverlayPanel.notification.test.tsx`
and `ViewLinkPanel.notification.test.tsx` in `src/map/` are gone; each of
the three panels, and each file split off from one, has at most one test
file.

Toward AC-3: tests of the shared notification behaviour that
`src/app/useNotifyingActionRunner.test.tsx` already pins are not repeated
in the panel tests.

Toward AC-9: `KmlPanel.test.tsx` (644 lines) and the merged ViewLinkPanel
test are under 500 lines, as is every file split off.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

Toward AC-12: a component split off from a panel renders and behaves as the
panel did; only the file boundaries move.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-2** No source file has more than one test file. A source file may have none.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-9** When the change is done, no source file and no test file is over 500 lines.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Every jsdom test file costs about 3 s of setup; watch the runtime of `npm test` as test files multiply.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- `src/map/KmlPanel.tsx` (203): one component using
  `useNotifyingActionRunner(KML_OVERLAYS)` and `ConfirmationModal`.
  Tests: `KmlPanel.test.tsx` 644 (layout, sections, add by URL / file /
  KMZ with client-side `extractKml`, visibility toggle, reload only for URL
  layers, removing (6), actions without a result, "an earlier message" (9),
  locks while running), `KmlPanel.notification.test.tsx` 225 (title
  KML-Ebenen, does not close itself, close button, one notification after
  two failures, closes on success, it.each over the actions, kept while
  typing, none on session expiry, notifications while the removal dialog is
  open), `KmlPanel.document.test.tsx` 37 (the error keeps Name and URL - the
  same as "keeps name and URL when adding by URL throws" in the main test).
- `src/app/useNotifyingActionRunner.test.tsx` (115) already pins: an earlier
  notification closes as soon as the action starts, the close button, a
  redirect is no failure. "Does not close itself", "one notification after
  two failures", "closes on the next success" and "none on session expiry"
  are the runner's behaviour too: drop them from the panel test where the
  runner test pins them (break by hand to confirm, and record), or move
  them into the runner's test where it does not. What stays in the panel
  test is what the panel decides: which source title, which actions run
  through the runner, what the form keeps.
- If `KmlPanel.test.tsx` is still over 500 lines after that, split
  `KmlPanel.tsx` into the add forms (file and URL) and the layer list
  (switch, Neu laden, Entfernen with its confirmation) - for example
  `KmlAddForms.tsx` and `KmlLayerList.tsx` - each with its test, in a commit
  of its own before tests move into them. Add each split to
  `changes/2026-10-03-tests-ihren-dateien-zuordnen/coverage-splits.json`.
- `src/map/ImageOverlayPanel.tsx` (105): tests 246 +
  `.notification` 31. Merged about 270.
- `src/map/ViewLinkPanel.tsx` (181): tests 426 + `.notification` 109 ≈ 535.
  `ViewLinkRow` (from line ~109) holds copying (copy, "kopiert", clipboard
  unavailable or rejected, fallback) and the QR code, through
  `useClipboardCopy` (no test of its own; also used by `DeviceLinkPanel`).
  The seam if needed: `ViewLinkRow` into `ViewLinkRow.tsx` with its copy
  tests (~100 lines) in `ViewLinkRow.test.tsx`.
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
1. KmlPanel: merge `.document` (drop the duplicate) and `.notification` into
   `KmlPanel.test.tsx`; drop or move the runner duplicates as under Context;
   shorten with shared setup and `it.each`. Proof: green; `wc -l`.
2. Only if still over 500: split `KmlPanel.tsx` as under Context, in its own
   commit, with the tests divided between the new test files and the
   coverage-splits entry. Proof: green; every file under 500; the coverage comparison names no file.
3. ImageOverlayPanel: merge `.notification`. Proof: green.
4. ViewLinkPanel: merge `.notification`; if over 500, split off
   `ViewLinkRow.tsx` with its copy tests, in its own commit, with the
   coverage-splits entry. Proof: `npm run check` green; the coverage comparison names no file.

## Not here
- The panels' tests that today sit in `SituationWorkspace.notifications.test.tsx`
  and `SituationWorkspace.layers.test.tsx` move in tickets 14 and 16.
- From `CRITERIA.md`'s Out of scope: tests for source files that have none
  today, except where the coverage comparison would otherwise name the
  file (see Context) - `useClipboardCopy.ts` gets no new test here.
- No change of behaviour in any panel.

## Left standing
- **Review findings not fixed.** One review round, which found no blockers
  or should-fix items and three nits, so there was no second round.
  - Fixed (nit 1): `ImageOverlayPanel.test.tsx` still had "is gone while
    the next file is added and shows that one's failure", which is the
    runner's behaviour. By the same reasoning I also dropped "is gone while
    the visibility is being switched" there, and the switch, reload and
    add-by-URL rows of KmlPanel's "an earlier notification" table. That
    each action runs through the runner is pinned by each panel's "shows
    the failure when … throws" table. Taking the Kml toggle, the Kml reload,
    the image add or the view-link create out of `run` made those tables
    fail.
  - Not fixed (nit 2): the two tests moved into
    `useNotifyingActionRunner.test.tsx` ("does not close the notification
    by itself", "shows only one notification after failing twice") check
    what `action-notification.ts` decides (`autoClose: false`, one id per
    source). That file has no test file. I followed Context, which says to
    move them into the runner's test. Whether they belong in an
    `action-notification.test.ts` is for the review tickets 26-31.
  - Not fixed (nit 3): the reviewer asked for the German comments moved
    within `ViewLinkPanel.test.tsx` to be translated. The project's
    comments are German throughout, so I left them as they were.
- **Checks not run.** None skipped. `npm run check` is green (219 files,
  2735 tests). `npm run test:coverage` and then `compare-coverage.mjs`
  report no coverage drop. As in ticket 10, the script names only the
  `src/test/` helpers from tickets 02-10 as "new, compared with nothing".
  No file needed a new test file.
  - Unexplained: one `npm run check` run between the review and the
    commit reported `Errors 1 error` with every test passing. Its output
    was lost because I only kept the tail. Five further full runs (three
    `npm test`, one `npm run check`, one coverage run) and eight runs of
    the four changed test files were clean. It may be a flake elsewhere in
    the suite.
  - Unguarded before and after: I removed `notifications.hide` from
    `showActionError` (before `show`) and the map and app tests stayed
    green. The old panel tests did not guard it either.
- **Advanced without an automated test.**
  - AC-1/AC-2: I checked by listing the files. The four files are deleted,
    and each panel has one test file.
  - AC-9: checked with `wc -l`. `KmlPanel.test.tsx` has 483 lines,
    `ViewLinkPanel.test.tsx` 401 and `ImageOverlayPanel.test.tsx` 194.
  - AC-11: the commit's `Removed tests:` section is written from
    `removed-tests.mjs`, with all 67 names. Each has a `→` line. I broke each
    of these by hand and restored it; each time the named tests failed:
    - Runner: `autoClose: false` changed to 4000 failed "does not close
      the notification by itself". A unique id per `show` failed "shows
      only one notification after failing twice". Without
      `closeActionError` in `beginAction`, "closes an earlier notification
      as soon as the action starts" failed. A notification on redirect
      failed "stays busy without a notification while a redirect navigates
      away".
    - KmlPanel: fields not cleared on success, or no `trim`, failed "adds
      a KML by URL and empties the fields". Clearing them on error failed
      "keeps name and URL in the fields when adding by URL throws". Without
      `closeError` in `remove`, "closes the notification once the removal
      is confirmed" failed. Without it on Entfernen, "is gone once
      Entfernen is opened" failed. Reading the file outside `run` failed
      "is gone once the next file is still being read" and the lock row
      for a file still being read. Another source title failed "shows a
      failure as a notification titled KML-Ebenen …".
    - ImageOverlayPanel: another source title failed its title test.
      Without `closeError` on Bearbeiten, "goes away with Bearbeiten"
      failed.
    - ViewLinkPanel: another source title failed its title test. Without
      `closeError` on asking or on deleting, the two matching tests
      failed. Clearing the label on error failed both "shows … and keeps
      the label" rows. Never showing "kopiert" failed the copy test.
  - AC-12: no production file changed.
- **AC-3 review list.** This ticket created no test file. I held every
  test in `KmlPanel.test.tsx`, `ImageOverlayPanel.test.tsx` and
  `ViewLinkPanel.test.tsx` against its panel, so those three are added to
  `ac3-reviewed.txt`. One judgement call: the "failure that arrives
  outside the dialog, closable with the dialog open" tests stay in Kml and
  ViewLink. They check how the panel combines `ConfirmationModal` with its
  notification source. `useNotifyingActionRunner.test.tsx` was only
  edited, and nit 2 concerns it, so it is not listed.
- **Departures from the plan.** Step 2 (splitting `KmlPanel.tsx`) and the
  `ViewLinkRow` split in step 4 did not happen. After shortening, both
  files are under 500 lines, so the plan's "only if still over 500" did
  not apply. `coverage-splits.json` is unchanged. Steps 1, 3 and 4 went
  into one commit, because no production code moved and so no separate
  restructuring commit was needed.
- **Departures from a nudge.** None. Test files went from 7 to 3. The
  added assertions (the trim, the emptied fields, the file input locked in
  every lock row) pin behaviour no panel test held before. They passed at
  once, so their red came from breaking the code by hand, as listed above.
