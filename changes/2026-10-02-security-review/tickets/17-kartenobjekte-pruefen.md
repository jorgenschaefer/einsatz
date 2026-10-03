---
criteria:  CRITERIA.md
closes:    AC-23
advances:
after:     07-links-entfernen-und-beim-abschliessen-loeschen, 09-uploads-ueber-route-handler
status:    done
attempts:  1
---

## Build
Every change or deletion of a Kartenzeichen, Bereich, KML-Ebene, Bild-Overlay
or Ansichtslink only touches the object if it belongs to the Einsatz the call
names, and reports an error otherwise.

## Done when
> **AC-23** Ändern oder Löschen eines Kartenzeichens, Bereichs, einer KML-Ebene, eines Bild-Overlays oder Ansichtslinks unter der ID eines Einsatzes, zu dem es nicht gehört, ändert nichts und meldet einen Fehler.

## Nudges

## Context
- **The hole (AC-23).** Every child-object action takes `(operationId, id, …)`
  but mutates by `id` alone; `operationId` is only used for revalidation and
  the live event. The repository functions run `UPDATE … WHERE id = $1` /
  `DELETE … WHERE id = $1`:
  - `src/server/mapsymbols/map-symbols.ts`: `moveMapSymbol`,
    `updateMapSymbolComposition`, `deleteMapSymbol`, `generateDeviceLink`,
    and `removeDeviceLink`, which ticket 07 adds.
  - `src/server/areas/areas.ts`: `updateAreaStyle`, `updateAreaGeometry`,
    `deleteArea`.
  - `src/server/kml/kml-overlays.ts`: `setKmlVisibility`, `updateKmlContent`,
    `deleteKmlOverlay`; `reloadKmlOverlay` reads through the private
    `getKmlOverlay(db, id)` (tickets 03/04/21 change its fetcher argument,
    budget and icon embedding, not its lookup).
  - `src/server/image-overlays/image-overlays.ts`: `updateImagePlacement`,
    `setImageOverlayVisibility`, `replaceImageOverlayFile`,
    `deleteImageOverlay`. Replacing the file runs through the route handler
    ticket 09 adds under `src/app/operations/[id]/…` and calls the domain code
    there; ticket 08 already writes the new file into
    `existing.operationId`'s directory. Deleting is
    `deleteImageOverlayAction`, which reads the overlay with
    `getImageOverlay(db, id)`, deletes, then cleans up the file.
  - `src/server/viewlinks/view-links.ts`: `deleteViewLink`.
  The comment on `operationAction`
  (`src/app/operations/[id]/operation-action.ts`, paragraph
  "Zugehörigkeit (flaches Trust-Modell)") and the one-line
  "Zur Objekt-Zugehörigkeit … siehe `operationAction`" comments in
  `kml-actions.ts`, `image-overlay-actions.ts` and `view-link-actions.ts`
  describe the hole as deliberate; they go.
- **`Queryable` has no `rowCount`** (`src/server/db/db.ts` returns only
  `rows`). "No row matched" is detected with `RETURNING id` and an empty
  `rows`.
- **Message for "not in this Einsatz".** The codebase already says
  "KML-Overlay nicht gefunden.", "Stelle nicht gefunden.", "Eintrag nicht
  gefunden.". Follow that: "Kartenzeichen nicht gefunden.", "Bereich nicht
  gefunden.", "KML-Overlay nicht gefunden." (unchanged), "Bild-Overlay nicht
  gefunden.", "Ansichtslink nicht gefunden.", thrown as `ValidationError`
  (`src/server/validation.ts`) so `operationAction` returns it as `{ error }`
  and does not revalidate. The same message appears when the object was
  deleted meanwhile by someone else (today such a call silently does
  nothing).
- **No input validation needed here.** The AC-23 calls use real UUIDs of a
  real other Einsatz; `ValidationError` is all this ticket needs from
  `src/server/validation.ts`. Once `operationId` reaches the `WHERE` clause,
  a malformed `operationId` makes Postgres throw (as a malformed `id` already
  does today); ticket 23 adds `assertUuid` to exactly the signatures this
  ticket reshapes, which is why 23 comes after this one.
- **The auth guard comes first.** `src/app/auth-enforcement.test.ts` calls
  every action with placeholder ids like `"op-1"` and expects the login
  redirect. `operationAction` calls `requireUser()` before `run`; nothing
  here may run before it.
- **Test patterns.** Real-DB action tests: `view-link-actions.test.ts` (fakes
  `getDb`, `next/cache`, `next/headers`, logs in with a real session) and
  `src/app/overlay-routes.not-a-uuid.test.ts` (fakes `requireUser`).
  Repository tests with `freshDb()` next to each repository. Several existing
  action tests mock the repository functions whose signatures change here
  (`kml-actions.test.ts`, `image-overlay-actions.test.ts`,
  `view-link-actions.test.ts`, `area-actions.test.ts`); they move with the
  signatures. `image-overlay-actions.test.ts` (455 lines) and
  `map-symbols.test.ts` (364 lines) are long: put new tests in new files.

## Plan
1. **Red: AC-23 where the user acts.** New
   `src/app/operations/[id]/foreign-operation.test.ts`, real DB (fake
   `getDb` → `freshDb()`, `requireUser` → a user, `next/cache` no-op). Two
   Einsätze A and B; in A one of each: Kartenzeichen (with a Gerätelink),
   Bereich, KML-Ebene from a URL, Bild-Overlay (row via
   `createImageOverlay`, file via `storeOverlayImage`), Ansichtslink. Call each
   change and delete action with B's id and A's object id:
   `moveMapSymbolAction`, `updateMapSymbolCompositionAction`,
   `deleteMapSymbolAction`, `generateDeviceLinkAction`,
   `removeDeviceLinkAction`, `updateAreaStyleAction`,
   `updateAreaGeometryAction`, `deleteAreaAction`, `setKmlVisibilityAction`,
   `reloadKmlAction` (fetcher stubbed like `kml-actions.test.ts` does),
   `removeKmlAction`, `updateImageOverlayPlacementAction`,
   `setImageOverlayVisibilityAction`, `deleteImageOverlayAction`,
   `deleteViewLinkAction`. Each returns `{ error: "<Kind> nicht gefunden." }`,
   and re-reading the object through the `list…` function of A shows it
   unchanged (position, composition, Gerätelink token, style, geometry,
   visibility, content, placement, file still on disk, Ansichtslink still
   there).
   For replacing a Bild-Overlay file: call the replace route handler from
   ticket 09 with B's id in the path and A's overlay id; it answers with an
   error and the overlay row, its file, and the upload directory of B are
   unchanged (no new file anywhere).
   *Proof:* red - today every call succeeds and changes A's object.
2. **Green: Kartenzeichen.** `moveMapSymbol`, `updateMapSymbolComposition`,
   `deleteMapSymbol`, `generateDeviceLink`, `removeDeviceLink` take
   `operationId` after `db`, add `AND operation_id = $n … RETURNING id`, and
   throw `ValidationError("Kartenzeichen nicht gefunden.")` on no row.
   `map-symbol-actions.ts` passes `operationId` through. Repository tests in
   a new `src/server/mapsymbols/map-symbols.ownership.test.ts`: own Einsatz
   changes, other Einsatz throws and changes nothing.
   *Proof:* the Kartenzeichen cases of step 1 and the new repository tests
   green.
3. **Green: Bereiche.** Same for `updateAreaStyle`, `updateAreaGeometry`,
   `deleteArea` ("Bereich nicht gefunden."), `area-actions.ts` passes
   `operationId`. Tests in `src/server/areas/areas.test.ts` (164 lines).
   *Proof:* Bereich cases of step 1 green.
4. **Green: KML-Ebenen.** `getKmlOverlay`, `setKmlVisibility`,
   `updateKmlContent`, `deleteKmlOverlay`, `reloadKmlOverlay` take
   `operationId`; no row → "KML-Overlay nicht gefunden.".
   `reloadKmlOverlay` must not fetch at all when the overlay is not in the
   Einsatz. `kml-actions.ts` passes `operationId`; `kml-actions.test.ts`
   follows. Tests in `src/server/kml/kml-overlays.test.ts`.
   *Proof:* KML cases of step 1 green; a test with a fetcher that records
   calls shows no fetch for a foreign Einsatz.
5. **Green: Bild-Overlays.** `updateImagePlacement`,
   `setImageOverlayVisibility`, `replaceImageOverlayFile`,
   `deleteImageOverlay` take `operationId` ("Bild-Overlay nicht gefunden.").
   `deleteImageOverlayAction` cleans up the file only after the delete
   matched. The replace route rejects before preparing or storing the upload
   when `existing.operationId !== operationId` (same message), so no file is
   written. Tests in a new
   `src/server/image-overlays/image-overlays.ownership.test.ts`.
   *Proof:* Bild-Overlay cases of step 1 green, including the replace route.
6. **Green: Ansichtslinks.** `deleteViewLink(db, operationId, id)`
   ("Ansichtslink nicht gefunden."). *Proof:* last case of step 1 green.
7. **Remove the "flat trust model" comments** on `operationAction` and in
   the three action files; the remaining comment says only what
   `operationAction` does. *Proof:* `npm run check`.
8. **In the browser** (skill `run-einsatz`): move, edit and delete a
   Kartenzeichen, a Bereich, a KML-Ebene, a Bild-Overlay and an
   Ansichtslink, generate and remove a Gerätelink, reload a URL KML-Ebene and
   replace a Bild-Overlay file - all still work.
   *Proof:* observations under `## Left standing`.
9. `npm run check` green.

Decided here (show at approval): the "not found" messages above; a change or
delete of an object that no longer exists now reports "… nicht gefunden."
instead of silently succeeding; `operationId` goes after `db` in every
reshaped repository signature.

## Not here
- Type, UUID, length, shape and colour checks on the Lagekarte actions, and
  the helpers in `src/server/validation.ts`: ticket
  `23-kartenobjekte-eingaben`. Until it is built, a malformed `operationId`
  on these actions ends in a server error, as a malformed object id does
  today.
- ETB and Stärke inputs: ticket `24-etb-und-staerke-eingaben`. Einsatz,
  lifecycle, user, account, login and geocode inputs: ticket
  `25-einsatz-und-konten-eingaben`. The test that walks every server action:
  ticket `18-eingaben-pruefen`.
- The upload route handlers' own checks (session, 20 MB stream limit) and the
  Bild-Overlay directory from `existing.operationId`: tickets
  `09-uploads-ueber-route-handler` and `08-bild-overlay-dateien-absichern`.
  This ticket adds only the Einsatz check to the replace route.
- How labels are drawn (HTML as text): ticket `01-beschriftungen-als-text`.
- From `CRITERIA.md`'s Out of scope:
  - "Rechte je Einsatz; das flache Vertrauensmodell bleibt." - the check is
    that the object belongs to the named Einsatz, not whether this user may
    edit that Einsatz.
  - "Ein abgeschlossener Einsatz bleibt bearbeitbar; Abschließen sperrt
    nichts außer den Links." - do not reject changes because the Einsatz is
    closed.

## Left standing
- **Departures from the plan.**
  - Step 5: the Einsatz check for replacing a Bild-Overlay file sits in
    `replaceImageOverlayImage` (`image-overlay-uploads.ts`), which the route
    handler calls, and not in the handler itself. It runs before the upload is
    prepared or stored. `getImageOverlay` stays an id-only lookup, followed by
    a comparison like the one in `overlay-response.ts`. The `UPDATE` after it
    also carries `operation_id`.
  - Step 5: `deleteImageOverlay` now returns the deleted row's `filePath`
    (`RETURNING file_path`). `deleteImageOverlayAction` no longer reads the
    overlay first. It cleans up only the file of a delete that matched.
  - Step 1: "unchanged" is checked by comparing all `list…` results of
    Einsatz A, plus every file under the upload directory, before and after
    each call. The plan named each property one by one.
- **Tests replaced, not added.** `route.put.test.ts` pinned the old
  behaviour: a file replaced under another Einsatz's address landed in the
  overlay's own Einsatz and refreshed it. AC-23 reverses that. The first of
  those tests is gone, because `foreign-operation.test.ts` now covers it. The
  second now asserts that no Einsatz is refreshed.
- **One test was never red.** The repository test "reloading a KML-Ebene of
  another Einsatz does not fetch its address" passed on its first run. Before
  the signature changed, the shifted arguments made the lookup miss. It holds
  the behaviour now, but no run showed it failing for the right reason.
- **Browser check (step 8)** was done by the reviewer with `run-einsatz` at
  1280×800 and 390×844, checking the database after each step. All of these
  still work for objects of the open Einsatz: moving, editing and deleting a
  Kartenzeichen; generating and removing a Gerätelink; editing and deleting a
  Bereich; hiding, reloading (URL) and removing a KML-Ebene; hiding, scaling,
  replacing the file of and deleting a Bild-Overlay; deleting an
  Ansichtslink. AC-23 itself is proven by `foreign-operation.test.ts`.
- **Not fixed: a stale delete dialog.** Deleting a Bereich that someone else
  already deleted shows "Bereich nicht gefunden." in the confirm dialog, as
  agreed. But the dialog stays open and the Bereich stays on the map until
  the next live update. This is only reachable when that live update has not
  arrived yet. Whether a "nicht gefunden" result should close the dialog or
  refresh the map is a UI decision this ticket does not settle.
- **Seen in passing, unrelated:** the reviewer saw that changing a
  Bild-Overlay's opacity slider by keyboard did not save. This ticket does not
  touch that path.
