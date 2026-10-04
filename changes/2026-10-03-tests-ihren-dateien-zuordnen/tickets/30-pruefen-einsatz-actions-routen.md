---
criteria:  CRITERIA.md
closes:    
advances:  AC-3, AC-11, AC-12
after:     23-pruefungen, 26-pruefen-karte-arbeitsplatz, 33-image-overlay-uploads
status:    done
attempts:  1
---

## Build
The review that every test tests its own file, for the test files in
`src/app/operations/`:
each test file whose source or test imports another project module is
read test by test against what its own file implements, and a test of
another file's behaviour is moved to that file's test file or dropped as
a duplicate.

## Done when
Toward AC-3: in `src/app/operations/`, every test tests behaviour implemented in its own
file; the verdict per test file is in Left standing.

Toward AC-11: each commit that moves or drops tests carries the record
described under Context.

Toward AC-12: a coupling restructured so a file can be tested on its own
leaves the app behaving as before.

## Toward
> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Mocks (`next/headers`, `next/navigation`, `@/server/db/pg`) stay at the top of each test file, because `vi.mock` is only hoisted in the test file itself. The helpers do not mock.

> Where a hook or component can only be tested through its parent, restructure it without changing behaviour, in commits separate from moving tests.

> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Pairing by name (ticket 23's check) does not show the failure AC-3 is
  about: a test file named after its source whose tests exercise another
  file - as `SituationWorkspace.areas.test.tsx` tested `useAreaFlows`
  before this change while importing only its own fixtures. Reading the
  tests shows it.
- Which test files to read (one rule for tickets 26-31): a test file
  `X.test.*` in the area that is not listed in `ac3-reviewed.txt` in this
  change's directory - the files listed there were written or read test by
  test by an earlier ticket of this change and count as judged - and
  that reaches another project file: `X` or the test file imports (not
  type-only) a project module other than `X`, or reads another project
  file at run time (`readFile`, `?raw`; for example
  `src/map/lageansicht-sizes.test.ts` reads `situation-workspace.css`).
  Importing a fixture (`*.fixtures.*`) or a `src/test/` file is not by
  itself a reason; what that file imports in turn is. A test file that
  reaches no other project file can only exercise its own. Each area
  belongs to one ticket, so no test file is read twice.
- The selection is `select-tests.mjs` in this change's directory, built by
  ticket 26; use it as it is, so all review tickets select by one rule.
  It treats `src/test/render.tsx` as a harness: what that file imports
  (the app's providers) is no reason to select a test.
- In `src/app/operations/`, for orientation:
  the action, route and page tests, which import server modules to set up
  an Einsatz and read it back, and `operation-action.test.ts`.
- A test belongs to its own file when the behaviour is that file's: what
  it decides, shows, calls or passes down, and how it combines other files
  (wiring). Other files running in the test is fine - the file's real
  children and hooks, a harness, fixtures, fakes; the assertions decide.
  An import used to set up state or read it back is a fixture. A test
  whose assertions check only another file's behaviour belongs to that
  file (AC-3).
- A test that moves follows the same record as before (AC-11): the commit
  body has a section `Removed tests:` with one line per removed test,
  `- <old file> › <describe> › <it>` followed by either `→ <new file> ›
  <it>` or `→ gone: <why>; broke <behaviour> by hand, <test that failed>
  failed`. Before committing, run `npm run test:coverage` and
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
- More than a handful of tests to move out of one test file means a slice
  was missed: halt the ticket naming the file and the tests, rather than
  leaving them in place.
- A file without a test file whose behaviour is tested only through other
  files' tests gets its own `X.test.*`, and those tests move into it -
  also when the file lies in another ticket's area. Two exceptions:
  - Tests in a file listed in `ac3-reviewed.txt` stay where they are: the
    ticket that listed it judged them as that file's own wiring, and no
    test file is read twice.
  - A test file in another ticket's area is created only when that ticket
    is `done`. Otherwise halt naming the file and the tests, so two
    tickets never edit the same area at once.
  A test file created this way goes into `ac3-reviewed.txt` in the same
  commit. The rule above still holds: more than a handful of tests to move
  out of one test file is a missed slice. Files without a test file known
  so far (re-plan after ticket 26's halt), in this area: none with behaviour of its own
  (`upload-messages.ts` holds only constants). The Bild-Overlay route
  tests of `image-overlay-uploads.ts` were moved by ticket 33.

## Plan
1. Run `select-tests.mjs` from this change's directory with patterns for
   `src/app/operations/`.
   Proof: the list in Left standing.
2. For each, hold every test against its own file. Proof: the verdict per
   file in Left standing ("all its own", or the tests that moved).
3. Move each misplaced test to the file whose behaviour it checks (or drop
   it where that file's test pins it, with the by-hand check), with the
   record. Proof: `npm run check` green; the coverage comparison names no
   file.

## Not here
- The other areas: `src/map/` - the components (`.tsx`) and hooks (`use*.ts`), except `SituationMap.tsx` and `ReadOnlySituationMap.tsx` (ticket 26); `src/map/` - `SituationMap.tsx`, `ReadOnlySituationMap.tsx` and the `.ts` modules other than `use*.ts` (ticket 27); `src/journal/`, `src/strength/`, `src/kml/`, `src/test/` and the test files directly under `src/` or at the repository root (ticket 28); `src/server/` (ticket 29); `src/app/` outside `src/app/operations/` (ticket 31).
- From `CRITERIA.md`'s Out of scope: any change of behaviour - a test that
  cannot reach another file's behaviour without this one is a coupling to
  restructure in a commit of its own, not a reason to change what the
  code does.

## Left standing
- **Selection (Plan 1).**
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/select-tests.mjs 'src/app/operations/**/*.test.*'`
  selected 8 files: `OperationLifecycleActions.test.tsx`,
  `OperationsOverview.test.tsx`, `lifecycle-actions.test.ts`,
  `[id]/kml/route.test.ts`, `[id]/operation-action.test.ts`,
  `[id]/overlays/route.test.ts`, `[id]/overlays/[overlayId]/route.test.ts`
  and `[id]/page.test.ts` (under `src/app/operations/`).
- **Verdict per file (Plan 2).** Five are "all their own":
  `OperationsOverview`, `operation-action`, `overlays/route`,
  `overlays/[overlayId]/route` and `page`. Three were not:
  - `OperationLifecycleActions.test.tsx`: five tests were dropped because
    they duplicate `ConfirmationModal.test.tsx`. They are the three "while
    deleting" tests, "shows an unexpected failure …" and "shows a returned
    error in the open dialog". "keeps the refusal in view when the Einsatz
    turns out to be active again" stays: it depends on this component
    keeping the delete dialog mounted. "shows a refused Abschließen …" also
    stays. It pins that `onClose`'s result reaches the dialog
    (`onConfirm={onClose}`), and the second review showed nothing else
    pins that.
  - `lifecycle-actions.test.ts`: two tests were dropped as duplicates.
    "ends every Gerätelink and Ansichtslink for good, also after reopening"
    is held by `operation-lifecycle.test.ts`. "places Kartenzeichen whose
    device had reported by hand again" is held by `map-symbols.test.ts ›
    removeAllDeviceLinks`. The only check of its own, a single live
    notification, moved into the status-change test, which now covers
    reopening too and was renamed to say so.
  - `kml/route.test.ts`: seven tests left.
    - JSON/HTML refused and the 201-character file name went to
      `kml-import.test.ts › addKmlFile`.
    - The two same-origin rows and the 20 MB file went to
      `upload-route.test.ts › handleUpload`. The 20 MB test now checks
      that `handleUpload` reads a form with a KML file and with a
      Bild-Overlay file of the largest size.
    - The NetworkLink test was dropped as a duplicate of `kml-fetch.test.ts`.
- **More than a handful?** Seven tests left `kml/route.test.ts` and five
  left `OperationLifecycleActions.test.tsx`. I did not halt. No slice was
  missing: every test went to a test file that already existed and
  already tested that file's behaviour (`addKmlFile`, `handleUpload`,
  `ConfirmationModal`), or was dropped as a duplicate there.
- **Judgement call: bad input stays with the route.** The routes and the
  page keep their tests of how they answer bad input they pass on: a
  non-UUID Einsatz-ID in the path, a name sent as a file, no file, a form
  without content, and a missing name becoming „KML-Datei“. Each one
  depends on what the route takes from the request and how it passes it
  on, and action tests pin the same kind of answer
  (`expectBadCallsRejected`). Rules that hold whatever the route passes
  (the KML content check, the length of the file name) moved. Ticket 33
  moved the overlay route's 201-character test the same way.
- **Edits outside this area.** These are tests moved into files of done
  tickets' areas: `kml-import.test.ts`, `upload-route.test.ts` (listed),
  and `map-symbols.test.ts`. In `map-symbols.test.ts › removeAllDeviceLinks
  › makes Kartenzeichen … manually placed again`, the assertion now also
  checks that the last reported position stays. The dropped lifecycle
  test had pinned that, and the second review found nothing else did. No
  new test file was created, so `ac3-reviewed.txt` is unchanged.
- **AC-11.** No automated test proves this. The commit message carries
  the record. For each dropped test, I broke its behaviour by hand,
  checked that the named test failed, and restored the code.
- **AC-12.** No production code changed, and nothing was restructured.
- **Coverage comparison.** It names no file with a drop and exits 0. It
  still prints the twelve "new, compared with nothing" notes that earlier
  tickets left behind.
- **Review.** Two rounds, and every finding was fixed. Round 1 had one
  should-fix and one nit. Round 2 had two should-fix and one nit.
- **Checks.** `npm run check` is green: 197 files, 2688 tests. I ran
  `test:coverage`, `compare-coverage.mjs` and `removed-tests.mjs` after
  the last edit. No checks were skipped.
- **Departures.** None from the plan or the nudges.
