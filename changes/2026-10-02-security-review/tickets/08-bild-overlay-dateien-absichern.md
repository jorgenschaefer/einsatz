---
criteria:  CRITERIA.md
closes:    AC-20, AC-21
advances:
after:
status:    ready
attempts:  0
---

## Build
Replacing a Bild-Overlay's file writes into the directory of the Einsatz the
overlay belongs to, read from the database, and nothing is ever stored under
a directory name that is not a UUID. A PDF's first page is rendered at a
scale that keeps its longer edge at 4000 px or less, whatever its size, and a
PNG over 100 megapixels is refused with a message instead of being decoded.

## Done when
> **AC-20** Beim Ersetzen der Datei eines Bild-Overlays landet die neue Datei im Verzeichnis des Einsatzes, zu dem das Overlay gehört, egal welche Einsatz-ID der Aufruf mitliefert; außerhalb des Upload-Verzeichnisses wird nie etwas angelegt oder geschrieben.

> **AC-21** Eine PDF mit beliebig großer erster Seite und einem Seitenverhältnis bis 4000:1 wird mit höchstens 4000 px an der längeren Kante umgewandelt; eine PDF mit extremerem Seitenverhältnis wird mit „Die PDF-Datei konnte nicht umgewandelt werden." abgelehnt; ein PNG über 100 Megapixel wird mit „Das Bild konnte nicht verarbeitet werden." abgelehnt. In keinem Fall stürzt die App ab.

## Nudges
> Keine neuen Abhängigkeiten. Eingabeprüfung in `src/server/validation.ts` erweitern, ohne zod.

## Context
- **Replacing.** `replaceImageOverlayFileAction(operationId, id, file)` in
  `src/app/operations/[id]/image-overlay-actions.ts` loads `existing =
  getImageOverlay(db, id)` (which carries `operationId`), but stores the new
  file with `storeOverlayImage(operationId, webp)` — the id the caller sent.
  `operationId` is any string; `"../.."` would write outside the uploads
  directory. `addImageOverlayAction` already refuses an unknown Einsatz
  (`getOperation` returns `null` for a non-UUID) before storing.
- **Storage.** `src/server/image-overlays/image-storage.ts`:
  `storeOverlayImage(operationId, webp)` joins `uploadsDir()` (`UPLOADS_DIR`
  or `data/uploads`), `operationId` and a fresh UUID file name, `mkdir -p`s
  and writes. `deleteOperationUploads` already refuses a non-UUID id
  (`isUuid` from `src/server/db/uuid.ts`) with a developer error — the
  specimen for the same guard in `storeOverlayImage`.
- **Conversion.** `prepareOverlayImage(kind, buffer)` renders a PDF with
  `renderPdfFirstPageToPng` (`pdfToPng(pdf, { pagesToProcess: [1],
  viewportScale: 3 })` from `pdf-to-png-converter` 4.2.1), then `sharp(raster)`
  resizes to at most 3000 px (`MAX_EDGE_PX`) and encodes WebP; a sharp error
  becomes `ValidationError("Das Bild konnte nicht verarbeitet werden.")`.
  sharp's default `limitInputPixels` is 268,402,689, so a 100–268 MP PNG is
  decoded in full today.
- **pdf-to-png-converter** (`node_modules/pdf-to-png-converter/out/pageRenderer.js`,
  `getPageMetadata` and `renderPdfPage`) computes the viewport at the given
  `viewportScale` (page rotation included) and floors it to whole pixels:
  `width = Math.floor(viewport.width)`, the same for `height`. It then throws
  a plain `Error` when `width × height` exceeds `MAX_CANVAS_PIXELS`
  (100,000,000), or when either floored edge is 0. At scale 3 a large page
  (e.g. A0) already exceeds the pixel cap, and the action answers with the
  generic "Das Bild konnte nicht eingebunden werden.".
  `returnMetadataOnly: true` returns the floored `width`/`height` at the given
  scale without rendering, through the same two guards. So a probe can fail
  in both directions: a page over 100 MP at scale 1 (e.g. 200,000 ×
  100,000 pt) must be measured at a smaller scale, and an elongated page
  (e.g. 400,000 × 300 pt) measured at too small a scale (0.001 → 400 × 0)
  fails because its short edge floors to 0. `viewportScale` must be in
  (0, 100] (`pdfToPng.js`). Each `pdfToPng` call parses the PDF again.
- **Measuring with floored sizes.** A probe at scale `s` reports `w =
  floor(W·s)`, so the true width `W` is less than `(w + 1) / s`. A render
  scale computed from `w / s` can overshoot: a page of 2000.9 pt measured as
  2000 gives scale 2 and a 4001 px edge. Computing it from `(w + 1) / s` (the
  ceiling) cannot.
- **Pages that cannot be rendered at all.** A page whose long edge is more
  than 4000 times its short edge has a short edge under 1 px once the long
  edge is at most 4000 px; pdf-to-png-converter refuses that canvas. A page
  so small that it floors to 0 at every probe scale is refused too. Both get
  the existing "Die PDF-Datei konnte nicht umgewandelt werden." instead of
  the generic error.
- **Tests.** `src/server/image-overlays/image-storage.test.ts` mocks
  `pdf-to-png-converter` and stores under `"op-1"` in two tests; those move to
  the file's `OPERATION_ID`. `src/app/operations/[id]/image-overlay-actions.test.ts`
  (455 lines) has the action harness (`login`, `pngFile`,
  `anOverlayWithStoredFile`, temp `UPLOADS_DIR`). No test renders a real PDF
  yet.

## Plan
1. **Red: replacing writes into the overlay's own Einsatz.** New
   `src/app/operations/[id]/image-overlay-actions.files.test.ts` (copy the
   harness from `image-overlay-actions.test.ts` rather than growing that
   455-line file). Two Einsätze A and B, an overlay of A with a stored file.
   - `replaceImageOverlayFileAction(B.id, overlay.id, png)`: no directory for
     B exists under `UPLOADS_DIR`, and every file under `UPLOADS_DIR` lies in
     A's directory.
   - `replaceImageOverlayFileAction("../escape", overlay.id, png)`: nothing is
     created next to or above `UPLOADS_DIR` (the temp dir's parent lists the
     same entries before and after), and every file lies in A's directory.
   Proof: both fail today (B's directory, and `escape` beside the uploads
   directory, appear).
2. **Use the overlay's Einsatz.** In `replaceImageOverlayFileAction`, store
   with `existing.operationId` and return it to `operationAction` for
   revalidation and the live event. Proof: step 1's first case green.
3. **Refuse non-UUID directories.** `storeOverlayImage` throws, like
   `deleteOperationUploads`, when `operationId` is not a UUID, before
   `mkdir`. Proof: in `image-storage.test.ts`, `it.each(["..", "../x",
   ""])` rejects and leaves the temp dir's parent unchanged; the `"op-1"` tests
   use `OPERATION_ID`. Step 1's second case green.
4. **Red: a huge PDF page is converted.** A test helper
   `minimalPdf(widthPt, heightPt)` (new `src/test/minimal-pdf.ts`) writes a
   one-page PDF with that `MediaBox` and a correct xref table. In the new
   action test file from step 1, uploads via `addImageOverlayAction` of
   - a page of 200,000 × 100,000 pt (over 100 MP at scale 1) returns `{}`
     and creates an overlay with a 2:1 aspect ratio;
   - an elongated page of 400,000 × 300 pt returns `{}` and creates an
     overlay;
   - a page of 40,000,000 × 1 pt (long edge more than 4000 × the short one)
     returns `{ error: "Die PDF-Datei konnte nicht umgewandelt werden." }`
     and stores nothing.
   And in a new `src/server/image-overlays/image-storage.pdf.test.ts`
   (without the `pdf-to-png-converter` mock), the PNG that the exported
   `renderPdfFirstPageToPng` produces has a longer edge of at most 4000 px
   (read with `sharp(...).metadata()`) for: A4 (595.28 × 841.89 pt), a
   non-round page of 2000.9 × 1000.3 pt, a huge non-round page of
   200,000.7 × 100,000.3 pt, and the elongated 400,000 × 300 pt page (whose
   PNG is at least 1 px high). The 2000.9 pt page shows the off-by-one: a
   scale from the floored size renders 4001 px.
   Proof: the huge and the elongated page fail today with the generic embed
   error; the 2000.9 pt page fails against a scale computed from the floored
   size. If the real renderer cannot run under Vitest, record it under Left
   standing and prove it with a one-off script instead.
5. **Scale the PDF to 4000 px.** In `src/server/image-overlays/image-storage.ts`:
   - `measurePdfFirstPage(pdf)`: probe with `pdfToPng(pdf, { pagesToProcess:
     [1], returnMetadataOnly: true, viewportScale: s })` for `s` in
     `PROBE_SCALES = [1, 0.1, 0.01, 0.001, 1e-4, 1e-5, 1e-6]`, in that
     order, and take the first that succeeds: `{ width, height, scale: s }`.
     A probe that throws (too many pixels, or an edge floored to 0) moves on
     to the next scale; when none succeeds, throw
     `ValidationError("Die PDF-Datei konnte nicht umgewandelt werden.")`.
     The 400,000 × 300 pt page fails at 1 (120 MP) and succeeds at 0.1
     (40,000 × 30); with steps of 10, a page skipped by every probe has an
     aspect ratio over 10⁶ and could not be rendered at 4000 px anyway.
   - `pdfRenderScale({ width, height, scale })`, a small pure function:
     `min(3, 4000 / ((max(width, height) + 1) / scale))`, the ceiling of the
     measured size from Context, so `floor(trueLongEdge × result) ≤ 4000`.
   - `renderPdfFirstPageToPng` renders with that scale. When pdf-to-png-converter
     refuses the render (short edge floored to 0), it throws the same
     `ValidationError`.
   Proof: a unit test of `pdfRenderScale` that, for each case, takes the
   true size, floors it at the probe scale like the library does, and checks
   `floor(trueLongEdge × pdfRenderScale(…)) ≤ 4000` and, above 4000/3 pt,
   `≥ 3990`: A4 at 1 (scale 3), A0 at 1, 2000.9 × 1000.3 at 1,
   exactly 4000/3 pt long at 1, 200,000.7 × 100,000.3 at 0.01, and
   400,000 × 300 at 0.1. Step 4 green.
6. **Red, then green: a PNG over 100 MP is refused.** In the new action test
   file, an upload of a PNG of 10,001 × 10,000 px returns `{ error: "Das Bild
   konnte nicht verarbeitet werden." }` and stores nothing; one of exactly
   10,000 × 10,000 px is accepted. Build these as 8-bit grayscale PNGs by hand
   in the test (IHDR + one `zlib.deflateSync`ed IDAT of zero rows +
   `zlib.crc32`) so they are a few hundred KB, not 100 MB. Then pass
   `{ limitInputPixels: 100_000_000 }` to `sharp(raster, …)` in
   `prepareOverlayImage`. Proof: the 10,001 × 10,000 case fails before the
   option (it is decoded and embedded), passes after. If the accepted
   10,000 × 10,000 case takes more than a few seconds, keep it and say so under
   Left standing.
7. **Check.** `npm run check` green. In the browser (`run-einsatz` skill),
   upload an ordinary PDF Lageplan and an ordinary PNG as Bild-Overlays and
   replace one of them, to see nothing regressed.

Decided here: the scale probe uses pdf-to-png-converter's
`returnMetadataOnly` rather than importing `pdfjs-dist` directly, which would
be a new direct dependency. Decided here (show at approval): a PDF whose
first page cannot be rendered with its longer edge at 4000 px or less and its
shorter edge at 1 px or more (long edge over 4000 × the short one, or a page
under 1 pt) is refused with "Die PDF-Datei konnte nicht umgewandelt werden."
rather than converted; AC-21's "beliebig große erste Seite" is read as any
size, not any aspect ratio. Up to seven metadata probes each parse the PDF
again; an ordinary page needs one.

## Not here
- Moving the uploads (add, replace, KML file) from server actions to route
  handlers with a streamed 20 MB limit, and `serverActions.bodySizeLimit`
  back to 1 MB (AC-14): ticket 09.
- Refusing to replace or change a Bild-Overlay under an Einsatz it does not
  belong to, with an error (AC-23): ticket 17. This ticket only decides where
  the file lands.
- UUID checks on the action arguments with a user-facing message (AC-22):
  ticket `23-kartenobjekte-eingaben` (Lagekarte actions); AC-22 is closed by
  ticket 18.
- Hidden Bild-Overlays under `/view/…` and `/device/…` (AC-13): ticket 16.

## Left standing
