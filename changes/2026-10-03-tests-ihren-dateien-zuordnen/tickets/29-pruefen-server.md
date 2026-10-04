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
`src/server/`:
each test file whose source or test imports another project module is
read test by test against what its own file implements, and a test of
another file's behaviour is moved to that file's test file or dropped as
a duplicate.

## Done when
Toward AC-3: in `src/server/`, every test tests behaviour implemented in its own
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
- In `src/server/`, for orientation:
  modules that delegate or set up through others - for example
  `rate-limit.test.ts`, whose `limiterAddress` table tests IPv6 parsing
  (zone stripping, leading zeros, invalid literals) implemented in
  `parseIpv6` in `src/server/http/ip-address.ts`; `geocode-service.test.ts`
  (→ `photon`, `geocoder`, `src/map/search`); `pinned-fetch.test.ts`
  (→ `public-address`); `fetch-budget.test.ts` (→ `read-body`);
  `validation.test.ts` (→ `db/uuid`); `operation-lifecycle.test.ts`, whose
  "leaves a closed operation fully editable (no write-lock)" closes the
  Einsatz and then only drives `appendEntry`/`listEntries` (judge it: it may
  be the lifecycle module's choice not to lock, pinned through the
  journal); `delete-operation.test.ts`, `account-admin.test.ts`,
  `total-strength.test.ts`.
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
  so far (re-plan after ticket 26's halt), in this area: `src/server/http/ip-address.ts` (31; through
  `rate-limit` and `kml/public-address`). `image-overlay-uploads.ts` is
  handled by ticket 33; `rate-limit-instance.ts`, `db/db.ts` and
  `db/pg.ts` need none. From ticket 28's area,
  `src/journal/entry-type.ts` is reached through
  `journal-history.test.ts`: `journal-history.ts` refusing a correction
  or an annulment is its own behaviour; a test that checks only which
  entry types qualify belongs to `entry-type`.

## Plan
1. Run `select-tests.mjs` from this change's directory with patterns for
   `src/server/`.
   Proof: the list in Left standing.
2. For each, hold every test against its own file. Proof: the verdict per
   file in Left standing ("all its own", or the tests that moved).
3. Move each misplaced test to the file whose behaviour it checks (or drop
   it where that file's test pins it, with the by-hand check), with the
   record. Proof: `npm run check` green; the coverage comparison names no
   file.

## Not here
- The other areas: `src/map/` - the components (`.tsx`) and hooks (`use*.ts`), except `SituationMap.tsx` and `ReadOnlySituationMap.tsx` (ticket 26); `src/map/` - `SituationMap.tsx`, `ReadOnlySituationMap.tsx` and the `.ts` modules other than `use*.ts` (ticket 27); `src/journal/`, `src/strength/`, `src/kml/`, `src/test/` and the test files directly under `src/` or at the repository root (ticket 28); `src/app/operations/` (ticket 30); `src/app/` outside `src/app/operations/` (ticket 31).
- From `CRITERIA.md`'s Out of scope: any change of behaviour - a test that
  cannot reach another file's behaviour without this one is a coupling to
  restructure in a commit of its own, not a reason to change what the
  code does.

## Left standing
- **Selection (Plan 1).**
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/select-tests.mjs 'src/server/**/*.test.*'`
  selected 27 files at the start: `areas`, `auth/rate-limit`, `auth/seed`,
  `auth/sessions`, `auth/users`, `db/migrations`, `events/sse`,
  `geocoder/geocode-service`, `image-overlays/image-overlays`,
  `image-overlays/image-upload`, `image-overlays/overlay-response`,
  `journal/correspondents`, `journal/journal-history`, `journal/journal`,
  `kml/fetch-budget`, `kml/kml-fetch`, `kml/kml-overlays`,
  `kml/pinned-fetch`, `kml/public-address`, `operations/create-operation`,
  `operations/delete-operation`, `operations/operation-lifecycle`,
  `strength/stations`, `strength/total-strength`, `validation` and
  `viewlinks/view-links` (`.test.ts`, under `src/server/`). After the
  change, `sse.test.ts` no longer reaches another file, and
  `operations.test.ts` now does, because tests moved into it. I read
  that file too, and all of its tests are its own.
- **Verdict per file (Plan 2).** Six files were not all their own:
  - `rate-limit.test.ts`: six `limiterAddress` rows tested `parseIpv6`.
    They were leading zeros, the zone, and the four invalid literals. They
    moved to the new `src/server/http/ip-address.test.ts`, which is now in
    `ac3-reviewed.txt`. The rest of the table stays: the /64 key,
    IPv4-mapped addresses and the pass-through of anything that is not
    IPv6.
  - `operation-lifecycle.test.ts`: "makes Kartenzeichen … manually placed
    again" moved to `map-symbols.test.ts › removeAllDeviceLinks`. "leaves
    another operation's links alone" was split between
    `removeAllDeviceLinks` (map-symbols) and `deleteAllViewLinks`
    (view-links). Until now neither function was tested in its own file.
    "leaves a closed operation fully editable (no write-lock)" stays: not
    locking is the lifecycle module's own choice.
  - `delete-operation.test.ts`: the two cascade tests moved to
    `operations.test.ts › deleteOperationRow`.
  - `view-links.test.ts`: "gives an old link no access after closing and
    reopening" was dropped. It duplicated the lifecycle's own "keeps old
    links dead after reopening".
  - `total-strength.test.ts`: "can be annulled" was dropped. It duplicated
    `journal-history.test.ts › a gesamtstärke-gemeldet entry › can be
    annulled`. So `entry-type.ts` still needs no test file of its own.
  - `sse.test.ts`: the burst test checked the bus's coalescing, which
    `operation-events.test.ts` pins. It was replaced by "sends „changed“
    each time the bus notifies", which tests what `sse.ts` itself does.

  The other 21 files are "all their own".
- **Tests added beyond the moves:**
  - `ip-address.test.ts` has rows of its own besides the moved ones, plus
    an `ipv4Groups` test.
  - `operations.test.ts › deleteOperationRow › deletes a closed operation
    only, reporting whether it did` was the reviewer's nit. The rule
    before was pinned only through `delete-operation.test.ts`.

  Each one fails when its behaviour is broken by hand. The moved zone row
  now uses `fe80::%eth0` rather than `fe80::1%eth0`. Node's `isIPv6`
  accepts zones, and `parseInt` drops the `%eth0` after a digit. So the
  old input passed even with the zone stripping removed, and the new one
  fails.
- **More than a handful?** Six rows left `rate-limit.test.ts`. All six
  are one `it.each` table that the ticket itself named, and they went to
  the file the ticket said was missing. I did not take that as a missed
  slice, so I did not halt.
- **Review nit left standing:** cascade tests now follow two layouts. The
  journal, Kartenzeichen and Stellen/Stärkemeldungen cascades sit under
  `operations.test.ts › deleteOperationRow`, because its doc comment
  promises them. The Bild-Overlay and Ansichtslink cascades stay in their
  own repositories' test files, which judged them as their own. Both are
  defensible, because the cascades live in the migrations' foreign keys.
  Moving those two as well would have touched tests that are not
  misplaced.
- **Coverage comparison.** It names no file with a drop and exits 0.
  It still prints the twelve "new, compared with nothing" notes that
  earlier tickets left behind.
- **AC-12.** No production code changed and nothing was restructured.
- **Review.** One round: no blockers, no should-fix, two nits. One nit
  was taken, and the other is described above.
- **Checks.** `npm run check` is green: 197 files, 2695 tests. I ran
  `test:coverage` and `compare-coverage.mjs` after the last code edit.
  No checks were skipped.
- **Departures.** None from the plan or the nudges.
