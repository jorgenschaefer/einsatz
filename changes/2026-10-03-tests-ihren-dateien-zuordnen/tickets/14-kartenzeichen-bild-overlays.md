---
criteria:  CRITERIA.md
closes:
advances:  AC-1, AC-3, AC-11
after:     13-bereiche-zeichnen, 11-kartenpanels
status:    ready
attempts:  0
---

## Build
`useSymbolPlacement` and `useImageOverlayEditing` get their own test files,
tested with the hook harness from ticket 13, and every `SituationWorkspace.*`
test of behaviour they implement moves there; the Lageansicht's section
order test moves to `LayersPanel`. Duplicates of existing tests are dropped.

## Done when
Toward AC-1: `src/map/SituationWorkspace.image-placement.test.tsx` and
`src/map/SituationWorkspace.map-actions.test.tsx` are gone.

Toward AC-3: `src/map/useSymbolPlacement.test.ts`,
`src/map/useImageOverlayEditing.test.ts` and `src/map/LayersPanel.test.tsx`
(new) test their files directly; no test in a `SituationWorkspace.*` test
file checks behaviour `useSymbolPlacement`, `useImageOverlayEditing` or
`LayersPanel` implements.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

## Toward
> **AC-1** Every test file `X.test.ts` or `X.test.tsx` tracked by git sits next to a source file `X.ts` or `X.tsx` of the same name. A test file `A.<topic>.test.tsx` without a source file `A.<topic>.tsx` is a violation.

> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

## Nudges
> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Keep `browserTestsInTs` in `vitest.config.mts` in step with renamed test files.

> Every jsdom test file costs about 3 s of setup; watch the runtime of `npm test` as test files multiply.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Ticket 13 built `src/map/map-hooks.fixtures.tsx` (a hook rendered next to
  the real `useMapMode` and runner under `Providers`, `closeSheetOnPhone` a
  spy) and `src/map/map-objects.fixtures.ts` (`AREA`, `SYMBOL`,
  `anImageOverlay`). Use them.
- `useSymbolPlacement.ts` (77, no test): `{ mode, runMapAction,
  closeSheetOnPhone, onPlace }` plus `QUICK_SELECT`; uses `useDisclosure`.
  `useImageOverlayEditing.ts` (101, no test): `{ imageOverlays, mode,
  onUpdateImagePlacement, onReplaceImage, onDeleteImage,
  restoreImagePlacement }`, uses `useActionRunner` and
  `useNotifyingActionRunner(IMAGE_OVERLAYS)` (needs `Providers` to see its
  notification); its `WorkspaceImageOverlay` type is imported from
  `SituationMapView.tsx` (type only). `LayersPanel.tsx` (94) has no test.
- What moves here:
  - `SituationWorkspace.symbols.test.tsx` (483): placing with KTW (L20),
    Notunterkunft (L34), one Kartenzeichen per arming even while `onPlace`
    is in flight (L96), Erweitert (L119), the copying describe, an error
    surfaced (L57) and cleared on the next success (L73).
  - `SituationWorkspace.image-placement.test.tsx` (193): all of it -
    `saveImagePlacement`, restore through `restoreImagePlacement`, the busy
    lock, clearing the error, closing the Bild-Overlays notification on
    opacity / replace / delete / finish ("Fertig in the band" becomes a
    call of `finishEdit`).
  - `SituationWorkspace.layers.test.tsx` (419): starting the editor (L115),
    saving the placement (L127), opacity (L147), finishing (L165), the
    "does not come back with a result" describe, the delete result and mode
    reset of the confirming describe (L333, L353); the section order (L76)
    into `LayersPanel.test.tsx`.
  - `SituationWorkspace.phone-sheet.test.tsx`: arming from the
    Schnellauswahl, copying and Erweitert call `closeSheetOnPhone`;
    disarming and a failed placement do not.
  - `SituationWorkspace.map-actions.test.tsx`: the placing row of its
    it.each; with ticket 13's rows gone, its "closed with ×"
    (`ActionNotifications.test`) and redirect (`useNotifyingActionRunner.test`)
    cases are duplicates - drop them and delete the file.
- Duplicates to drop (confirm by breaking the behaviour by hand): symbols
  L290 (`SituationMap.test` L93), L306/L337/L356/L371
  (`SymbolDetailModal.test`), L431 (`placed-symbols.test`), the copy button
  (`SymbolsPanel.test` L120); layers L24, L90 (`SituationMap.test`), L55,
  L389 (`KmlPanel.test`), L102 (`ImageOverlayPanel.test`), the confirmation
  itself (`ImageOverlayEditor.test` L67).
- Leave for later tickets: symbols L243, L267, L394 and layers L177, L190
  (`SituationMapView`, ticket 15); symbols L452 and layers L238, L308
  (workspace wiring and uploads, ticket 16).
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
1. `src/map/useSymbolPlacement.test.ts` (new) with the symbol, phone-sheet
   and map-actions cases. Proof: green; let `placeSymbolAt` place twice per
   arming by hand and see L96's test fail; restore.
2. `src/map/useImageOverlayEditing.test.ts` (new) with the image-placement
   and layers cases; delete `SituationWorkspace.image-placement.test.tsx`.
   Proof: green.
3. `src/map/LayersPanel.test.tsx` (new) with the section order. Proof: green.
4. Drop the duplicates, delete `SituationWorkspace.map-actions.test.tsx`.
   Proof: `npm run check` green; the coverage comparison names no file.

## Not here
- `SituationMapView`, `useMapFocus` (ticket 15); `useMainView`, the
  workspace's wiring and uploads, and deleting the remaining topic files
  (ticket 16).
- No change to the hooks unless a behaviour cannot be reached without the
  workspace - then restructure, behaviour unchanged, in a commit of its
  own.

## Left standing
