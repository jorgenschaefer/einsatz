---
criteria:  CRITERIA.md
closes:
advances:  AC-3, AC-10, AC-11, AC-12
after:     23-pruefungen
status:    ready
attempts:  0
---

## Build
`image-overlay-uploads.ts` gets its own test file, calling `addImageOverlay`
and `replaceImageOverlayImage` directly on a fresh database, and holds what
it decides: the uploader's view checked and used for the placement, the
checks it makes before anything is stored, and the cleanup of written files
when the database step fails. The tests of that behaviour leave the two
Bild-Overlay route tests, the size-limit tests go to
`image-storage.test.ts`, and the route tests that repeat another module's
test are dropped.

## Done when
Toward AC-3: `src/server/image-overlays/image-overlay-uploads.test.ts`
(new) tests its file directly; no test in
`src/app/operations/[id]/overlays/route.test.ts` or
`src/app/operations/[id]/overlays/[overlayId]/route.test.ts` checks only
behaviour of `image-overlay-uploads`, `image-storage` or `image-overlay`.

Toward AC-10: the coverage comparison names no file.

Toward AC-11: each commit that removes or merges tests carries the record
described under Context.

Toward AC-12: production code is unchanged, or only restructured.

## Toward
> **AC-3** Every test in `X.test.*` tests behaviour implemented in `X`: what `X` decides, shows, calls or passes on, and how it combines the files it uses. Other project files may run in it - `X`'s real children and hooks, a harness around `X` (rendering `X` or providing context for it), fixtures and fakes - but a test whose assertions check only another file's behaviour belongs in that file's test file.

> **AC-10** For every source file, the share of covered lines and the share of covered branches, measured with `@vitest/coverage-v8`, are no lower after the change than on the commit the change starts from. A source file that was split is compared by adding up the covered and total lines and branches of its parts.

> **AC-11** Every commit that deletes or merges tests names each removed test and, for each, either the test that now holds what it checked, or why it is gone and that breaking its behaviour by hand made another test fail.

> **AC-12** The app's behaviour is unchanged: what users see, every HTTP response and the stored data. Changes to production code only restructure it.

## Nudges
> Shorten a test file before splitting it: shared setup, `it.each`, helpers for repeated assertions, and removing tests that were written to introduce something and neither pin a criterion nor guard against an accidental bug.

## Context
- Found while re-planning after ticket 26's halt: `image-overlay-uploads.ts`
  (110, no test) lies in ticket 29's area (`src/server/`), but is tested
  only through the two Bild-Overlay routes in ticket 30's area. Ticket 30
  would have to move well over a handful of tests into a file of another
  area and halt, as ticket 26 did for `ReadOnlySituationMap`.
- The routes only wire: `POST` calls `addImageOverlay` with `formFile`
  and `formJson(form, "view")` inside `handleUpload`
  (`src/app/operations/[id]/upload-route.ts`, which owns origin, session,
  body size, the status code and the message for a failure). `PUT` does
  the same with `replaceImageOverlayImage`.
- `image-overlay-uploads.ts` decides: `assertUuid` of the Einsatz-ID (and
  overlay id), `assertViewExtent` (private), `trimmedName` of the file
  name, the overlay of another Einsatz refused before the file is
  prepared, the Einsatz missing before anything is written,
  `defaultImagePlacement(view, width / height)` with the uploader's view,
  deleting the new file when the database step fails, deleting the old
  file after a replace. A test calls it with `freshDb()` and an uploads
  directory as the route tests set one up today (`UPLOADS_DIR`,
  `useUploadsDir` from `src/test/uploads-dir.ts`, `snapshotDbAndUploads` from
  `src/test/db-snapshot.ts`); the PNG and PDF builders the route tests use
  move along with the tests that need them, into a fixture if both test
  files need them.
- What moves, from `src/app/operations/[id]/overlays/route.test.ts`:
  - "centers a landscape image on the uploader's view at half its width" →
    `image-overlay-uploads.test.ts`, as "places the image in the uploader's
    view, not the Einsatz's default view". The half-width rule is
    `defaultImagePlacement`'s.
  - "rejects %s and creates nothing" (9 rows) and "accepts a view centred
    on the date line" → `image-overlay-uploads.test.ts`
    (`assertViewExtent`).
  - "shows the embed failure message, logs the error and leaves no file
    behind when the database insert fails": the leftover file →
    `image-overlay-uploads.test.ts`; the message and the log are
    `handleUpload`'s and `changeOperation`'s. Keep that half in the route
    test only if no other test pins it.
  - "refuses a file name of 201 characters and creates nothing" →
    `image-overlay-uploads.test.ts`.
  - "refuses a PNG over 100 megapixels and stores nothing", "accepts a PNG
    of exactly 100 megapixels" → `image-storage.test.ts`, under
    `prepareOverlayImage` (`MAX_INPUT_PIXELS`), with `grayPngFile`; the
    "stores nothing" part is the next bullet's.
  - one new test in `image-overlay-uploads.test.ts`: an image that cannot
    be prepared stores no file and no row.
- What moves, from `src/app/operations/[id]/overlays/[overlayId]/route.test.ts`
  → `image-overlay-uploads.test.ts`: "keeps the placement, updates
  file+dimensions, and deletes the old file", "leaves the overlay untouched
  when the file cannot be processed", "does not orphan the new file when
  the database update fails" (the log as above), "refuses a file name of
  201 characters and changes nothing", "creates nothing outside the uploads
  directory for an Einsatz-ID like ../escape".
- What goes as duplicates (break the behaviour by hand, see the test that
  fails, restore):
  - "sizes a portrait image to half the height of the uploader's view":
    `src/map/image-overlay.test.ts` "makes a portrait image half as high as
    the view when its height limits it".
  - "POST … with a PDF" › "converts a first page too large to render at
    scale 1, keeping its aspect ratio", "converts an elongated first page",
    "refuses a first page more than 4000 times longer than wide and stores
    nothing": rows of `image-storage.test.ts` "renders %s with its longer
    edge at 4000 px or less" and "refuses %s as not convertible". The
    "stores nothing" part is held by the new test above.
- What stays, because it is the routes': "embeds the image as a new
  overlay of the Einsatz" (the wiring, and `publishOperationChanged`),
  "rejects a view that is not JSON and creates nothing" (`formJson`),
  "asks for a file … when none was sent" (both, `formFile`), "answers 400
  for an Einsatz-ID that is not a UUID …" (both: the HTTP answer), the
  `GET` test, and the whole describe "under another Einsatz": CRITERIA's
  Out of scope says AC-8 keeps today's other-Einsatz check on
  `operations/[id]/overlays/[overlayId]`. `image-overlay-uploads.test.ts`
  checks the same refusal on the module, before the file is prepared, as
  its own test. The shared checks (`expectRouteRequiresLogin`,
  `expectUploadRules`, the object-id checks) stay as they are.
- Removing or merging tests (AC-11): the commit body has a section
  `Removed tests:` with one line per removed test, `- <old file> ›
  <describe> › <it>` followed by either `→ <new file> › <it>` or `→ gone:
  <why>; broke <behaviour> by hand, <test that failed> failed`. A test moved
  into another file counts as removed from its old file. Before committing,
  run `npm run test:coverage` and
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/compare-coverage.mjs`;
  it must name no file at all. A file it names that has no test file gets
  one, `X.test.*` next to it, with tests of its own behaviour until the
  comparison is clean; say which in Left standing. Fixtures and `src/test/`
  helpers count too: code in them that no test uses any more is deleted,
  and helper code moved to another file gets an entry in
  `coverage-splits.json`.
- Before each commit that touches a test, fixture or `src/test/` file, run
  `node changes/2026-10-03-tests-ihren-dateien-zuordnen/removed-tests.mjs`
  (ticket 01). Every name it lists as removed is in the commit's `Removed
  tests:` section; the names it lists as added show where a moved or
  renamed test went.
- AC-3 review list: add `src/server/image-overlays/image-overlay-uploads.test.ts`
  to `ac3-reviewed.txt` in this change's directory, in the same commit;
  this ticket created it. The two route test files and
  `image-storage.test.ts` are not listed: tickets 29 and 30 read them.

## Plan
1. `image-overlay-uploads.test.ts` (new) with the tests moved from the
   `POST` route test; delete them there. Proof: green; remove the
   `deleteOverlayFiles([filePath])` in `addImageOverlay`'s `catch` by hand
   and see the new test fail; restore.
2. The tests moved from the `PUT` route test. Proof: green; the same check
   for the old file deleted after a replace.
3. The 100-megapixel tests into `image-storage.test.ts`; drop the
   duplicates, each with the by-hand check. Proof: green.
4. Proof: `npm run check` green; the coverage comparison names no file.

## Not here
- The rest of the review of the two route test files (ticket 30) and of
  `image-storage.test.ts` (ticket 29).
- No change of behaviour.

## Left standing
