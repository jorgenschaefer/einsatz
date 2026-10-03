---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-2, AC-3, AC-9, AC-11, AC-12
after:     01-coverage-ausgangswert
status:    ready
attempts:  0
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
