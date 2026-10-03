---
criteria:  CRITERIA.md
closes:
advances:  AC-22
after:     09-uploads-ueber-route-handler, 17-kartenobjekte-pruefen
status:    done
attempts:  1
---

## Build
The Lagekarte server actions check their inputs - types, UUID ids, lengths,
Bereich shape, geometry and colour - and reject bad ones with a message
instead of a server error, storing nothing. `src/server/validation.ts` gains
the shared helpers the later input tickets use.

## Done when
Toward AC-22, this slice makes it true for the Lagekarte actions - those in
`src/app/operations/[id]/actions.ts` (`setDefaultViewAction`),
`map-symbol-actions.ts`, `area-actions.ts`, `kml-actions.ts`,
`image-overlay-actions.ts` and `view-link-actions.ts`, as they are after
tickets 07, 09 and 17: each rejects wrong types, ids that are not a UUID,
Bereich shapes other than Polygon, Linie and Kreis, Bezeichnungen and
Beschriftungen over 200 characters, a KML URL over its maximum length, and a
Bereich colour that is not `#` and six hex digits, with a message, and then
stores nothing. The KML-Ebene's name is ticket 09's and only pinned here. The helpers
`assertUuid`, `assertText`, `assertBoolean`, `assertObject` and
`assertHexColor` exist in `src/server/validation.ts`, each with unit tests.
The ETB, Stärke, Einsatz, lifecycle, user, account, login and geocode
actions are not part of this slice.

## Toward
> **AC-22** Jede Server Action lehnt falsche Typen, IDs, die keine UUID sind, unbekannte Bereichsformen (alles außer Polygon, Linie, Kreis) und Strings über ihrer Höchstlänge mit einer Meldung ab statt mit einem Serverfehler, und speichert dann nichts. Höchstlängen: Namen, Bezeichnungen, Beschriftungen, Von/An und Weg 200 Zeichen; KML-URL 2.000; Einsatzbeschreibung und Notizen 2.000; ETB-Text 10.000; Bereichsfarbe genau `#` und sechs Hex-Ziffern. Ein Polygon hat mindestens 3 Punkte, eine Linie mindestens 2.

## Nudges
> Keine neuen Abhängigkeiten. Eingabeprüfung in `src/server/validation.ts` erweitern, ohne zod.

## Context
- **What ticket 17 did.** Every change/delete repository function for
  Kartenzeichen, Bereiche, KML-Ebenen, Bild-Overlays and Ansichtslinks takes
  `operationId` after `db` and puts it into the `WHERE` clause, answering
  "<Kind> nicht gefunden." when no row matches. So a malformed `operationId`
  now reaches Postgres too, alongside the malformed object id that already
  did.
- **What ticket 09 did.** `addKmlFileAction`, `addImageOverlayAction` and
  `replaceImageOverlayFileAction` are route handlers now, not server actions
  (`assertViewExtent` went with the image upload into a domain function in
  `src/server/image-overlays/`). The routes call domain code -
  `createKmlOverlay`, `createImageOverlay`, `replaceImageOverlayFile` - with
  the `[id]` / `[overlayId]` from the path and, for a new Bild-Overlay, the
  `view` parsed from JSON. `createKmlOverlay`
  (`src/server/kml/kml-overlays.ts`) takes `name: unknown`, rejects a
  non-string ("Der Name muss Text sein.") and a trimmed name over 200
  ("Der Name darf höchstens 200 Zeichen lang sein."), and applies the
  fallback `trimmed || (sourceUrl ?? "KML-Datei")` itself - for the file
  route and `addKmlUrlAction` alike. The URL fallback is not held to 200.
- **Input checks today.** `src/server/validation.ts` (50 lines) has
  `ValidationError`, `isValidLatLng`, `assertLatLng`, `assertOpacity`,
  `assertRadius`, `assertScale`; its tests are
  `src/server/validation.test.ts` (92 lines). `src/server/db/uuid.ts` has
  `isUuid(value: string)`. Checks live in the repository functions (e.g.
  `createMapSymbol` calls `assertLatLng` and `assertComposition`). Gaps that
  turn into server errors today:
  - Any id or `operationId` that is not a UUID: Postgres throws
    `invalid input syntax for type uuid`.
  - `assertAreaGeometry` (`src/server/areas/areas.ts`) dereferences
    `geometry.shape`, `geometry.points`, `geometry.center` without checking
    that they exist; `null`, a missing `points` or `shape: "triangle"` throw a
    `TypeError`. An empty `points` array is stored and makes `areaCenter`
    (`src/map/area.ts`) divide by zero. Bereich colour and label are not
    checked at all; the Bereich editor (`src/map/AreaEditor.tsx`) offers a
    free text field "Farbe (Hex)".
  - `assertMapView` (`src/server/operations/operations.ts`) and
    `assertPlacement` (`image-overlays.ts`): a `null` object throws a
    `TypeError`.
  - `visible` (`setKmlVisibilityAction`, `setImageOverlayVisibilityAction`)
    is passed to Postgres unchecked.
  - `addKmlUrlAction` calls `.trim()` on `url` unchecked, and the URL has no
    length bound.
  - `assertViewExtent` (now behind the add-image route): a `null` `view`
    throws a `TypeError`.
  - The Ansichtslink label (`createViewLink`) is unbounded. The Kartenzeichen
    Bezeichnung is the composition's `text` field, already capped at
    `MAX_COMPOSITION_FIELD_LENGTH` (200) by `assertComposition`, which also
    rejects a non-object composition.
- **The auth guard comes first.** `src/app/auth-enforcement.test.ts` calls
  every action with placeholder ids like `"op-1"` and expects the login
  redirect. `operationAction` calls `requireUser()` before `run`; keep every
  new check inside `run` (or in the repository) so that test stays green.
- **Test patterns.** Real-DB action tests: `view-link-actions.test.ts` (fakes
  `getDb`, `next/cache`, `next/headers`, logs in with a real session) and
  ticket 17's `src/app/operations/[id]/foreign-operation.test.ts`.
  `image-overlay-actions.test.ts` (455 lines) and `map-symbols.test.ts`
  (364 lines) are long: new tests go in new files.

## Plan
1. **Red: the Lagekarte actions reject bad input.** New
   `src/app/operations/[id]/map-actions.validation.test.ts`, real DB, one
   Einsatz with one object of each kind. A table of bad calls, each expecting
   `{ error: <message> }` and an unchanged database (compare the `list…`
   results of the Einsatz and the row count of each Lagekarte table before
   and after):
   - an `operationId` and an object id that are not a UUID, for every action
     listed in `Done when`;
   - wrong types: `null` / a string for `composition`, `geometry`, `style`,
     `placement`, `view`; a string for `lat`/`lng`; `"yes"` for `visible`; a
     number for `name`, `label`, `url`;
   - `geometry.shape: "triangle"`, `points` missing or not an array, a point
     that is not an object, `center` missing, fewer points than the minimum
     for a polygon and for a line;
   - Bereich colour `"red"`, `"#e2001"`, `"#e2001aa"`, `"#gg001a"`;
   - Bereich Beschriftung and Ansichtslink label of 201 characters, and 200
     characters accepted (the boundary); a KML URL longer than
     `MAX_KML_URL_LENGTH`, rejected before any fetch (stubbed fetcher records
     no call);
   - KML name of 201 characters and a number as name through
     `addKmlUrlAction`, and Kartenzeichen Bezeichnung (`composition.text`) of
     201 characters - already rejected (09, `assertComposition`), pinned here
     so the table is complete.
   *Proof:* red - most cases end in a thrown server error today.
2. **Green: helpers in `src/server/validation.ts`**, each with tests in
   `src/server/validation.test.ts`, one red/green cycle each:
   - `assertUuid(value: unknown)` → `ValidationError("Ungültige ID.")`,
     built on `isUuid` from `src/server/db/uuid.ts` (checks `typeof` first);
   - `assertText(value: unknown, field: string, max: number)` →
     "`<field>` muss Text sein." / "`<field>` darf höchstens `<max>` Zeichen
     lang sein." (e.g. field "Die Beschriftung"; `max` written with German
     digit grouping, `max.toLocaleString("de-DE")`, so "10.000"), counting
     `value.length` like `assertComposition` does;
   - `assertBoolean(value: unknown, field: string)`;
   - `assertHexColor(value: unknown)` → "Die Farbe muss # und sechs
     Hex-Ziffern sein, etwa #e2001a.";
   - `assertObject(value: unknown, message: string)` - a non-null,
     non-array object.
   Edge cases: empty string (allowed where today allowed - empty Beschriftung
   and label are valid), exactly 200, 201, non-ASCII (`"ä".repeat(200)`
   accepted), upper-case hex accepted, `null`/`undefined`/array for
   `assertObject`.
   *Proof:* the new unit tests, red then green.
3. **Green: ids.** `operationId` and object ids through `assertUuid` in every
   repository function ticket 17 reshaped, and in `createMapSymbol`,
   `createArea`, `createKmlOverlay`, `createViewLink`, `setDefaultView`.
   *Proof:* the id rows of step 1 green.
4. **Green: Bereiche.** `assertAreaGeometry` checks the object, the shape
   enum ("Unbekannte Bereichsform."), `points` as an array of objects with at
   least `MIN_AREA_POINTS[shape]` entries, `center` as an object, before the
   existing coordinate checks. `MIN_AREA_POINTS = { polygon: 3, line: 2 }`
   is one constant in `areas.ts`; the message is built from it ("Ein Polygon
   braucht mindestens 3 Punkte.", "Eine Linie braucht mindestens 2
   Punkte."). `createArea` and `updateAreaStyle` check that `style` is an
   object, the colour (`assertHexColor`) and the label (`assertText`, 200,
   "Die Beschriftung").
   *Proof:* the Bereich rows of step 1 green; unit tests in
   `src/server/areas/areas.test.ts` for each minimum (at it accepted, one
   below rejected).
5. **Green: the rest of the shapes.** `assertMapView`, `assertPlacement`
   and `assertViewExtent` reject a non-object first; visibility through `assertBoolean` in
   `setKmlVisibility` and `setImageOverlayVisibility`; Ansichtslink label
   (`assertText`, 200, "Die Bezeichnung") in `createViewLink`.
   *Proof:* the matching rows of step 1 green.
   The upload routes get the same id and `view` checks through the domain
   functions they call: in 09's route tests, a non-UUID `[id]` /
   `[overlayId]` and a `view` of `null` answer `400 { error }` and write no
   file and no row.
6. **Green: KML URL.** In `addKmlUrlAction`, before `.trim()` and before any
   fetch: `url` through `assertText` against `MAX_KML_URL_LENGTH` (one
   constant next to the action, proposed 2,000, field "Die KML-URL").
   `reloadKmlAction` needs no check (it uses the stored URL). If 09's name
   check in `createKmlOverlay` is hand-written, switch it onto `assertText`,
   keeping its messages.
   *Proof:* the KML URL rows of step 1 green, with a fetcher that records no
   call.
7. **In the browser** (skill `run-einsatz`): open a Bereich, set the colour
   to `red` → the editor shows the colour message and the Bereich keeps its
   colour; set a valid colour and a 201-character Beschriftung → the length
   message. Draw a polygon, a line and a circle, add a KML-Ebene by URL with
   and without a name, create an Ansichtslink, save the default view - all
   still work.
   *Proof:* observations under `## Left standing`.
8. `npm run check` green.

Decided here (show at approval): the shared "Ungültige ID." for any
malformed id; lengths counted in UTF-16 code units (`String.length`), as
`assertComposition` already does; the helper names and messages above,
which tickets 24 and 25 build on.

Open product points (each answer changes one constant):
- The longest KML URL accepted: `MAX_KML_URL_LENGTH`, proposed 2,000.
- The fewest points of a polygon and of a line: `MIN_AREA_POINTS`, proposed
  3 and 2 (an empty one breaks `areaCenter` today).

## Not here
- The KML-Ebene `name` check and its fallback in `createKmlOverlay` (type
  and 200 characters, file and URL): ticket
  `09-uploads-ueber-route-handler`. This ticket only pins it in its table.
- The upload routes' session check, body cap and multipart parsing: ticket
  `09-uploads-ueber-route-handler`. This ticket covers only their ids and
  `view`, through the domain functions.
- The Einsatz check on Kartenobjekte: ticket `17-kartenobjekte-pruefen`.
- ETB and Stärke: ticket `24-etb-und-staerke-eingaben`. Einsatz anlegen,
  lifecycle, Nutzerverwaltung, Konto, Login, Kartensuche: ticket
  `25-einsatz-und-konten-eingaben`. The test that walks every server action:
  ticket `18-eingaben-pruefen`.
- `maxLength` on form inputs: not required; the server message is what
  AC-22 asks for.
- How labels are drawn (HTML as text): ticket `01-beschriftungen-als-text`.
- From `CRITERIA.md`'s Out of scope: "Ein abgeschlossener Einsatz bleibt
  bearbeitbar; Abschließen sperrt nichts außer den Links." - do not reject
  input because the Einsatz is closed.

## Left standing
- **Bereiche already stored with another colour or a longer Beschriftung**
  (review nit, not fixed). "Farbe (Hex)" was never checked, so rows like
  `#f00` or `red` can exist. Every style save now checks the colour, so
  changing only the Beschriftung or radius of such a Bereich fails with
  the colour message until the user enters a valid colour. The message
  says how to fix it. Normalising old rows with a migration is a product
  decision this ticket did not settle.
- **`addKmlUrlAction` fetches before it rejects a non-UUID Einsatz-ID**
  (review nit, not fixed). The id is checked in `createKmlOverlay`, which
  runs after the fetch. Nothing is stored and the answer is "Ungültige ID.".
  Checking in the action breaks six KML test files that call it with
  `"op-1"` against a mocked repository, and only a tampered client sends
  such an id. The same order applies to the KML name: 09's check in
  `createKmlOverlay` runs after the fetch. Its table rows here pin "message,
  nothing stored" and not "nothing fetched".
- **Departure from the plan, Bereich editor:** `AreaEditorModal` saved the
  radius before the style. Once the server rejected a bad colour or
  Beschriftung, a circle whose radius changed in the same save was left
  half-saved (found in review). It now saves the style first, and the three
  tests that pinned the old order were turned around. A radius the server
  rejects after the style was saved still leaves the style saved. The editor
  checks the radius before sending, so only "Bereich nicht gefunden." gets
  there.
- **Beyond the plan:** a Kartenzeichen Bezeichnung over 200 characters now
  answers "Die Bezeichnung darf höchstens 200 Zeichen lang sein." instead
  of "Ungültige Zeichen-Komposition." (`assertComposition` uses
  `assertText` for `text`). The upload routes now answer "Ungültige ID."
  for a malformed `[id]` / `[overlayId]`, where they used to say "Der
  Einsatz existiert nicht mehr." / "Bild-Overlay nicht gefunden.". A `null`
  `view` was already rejected by `assertViewExtent` and is now pinned.
- **Step 7, in the browser:** the reviewers checked this, not me, at
  1280×800, 1920×1080 and 390×844. Colour `red` and a 201-character
  Beschriftung showed their messages and left the Bereich unchanged, also
  with a changed radius in the same save. Valid edits saved. Polygon, line
  and circle drew and stored. A KML-Ebene by URL, with and without a name,
  was added, and the URL was used as the name when none was given. A KML
  URL of 2,001 characters was refused without a fetch. Ansichtslinks of 200
  characters were created and those of 201 refused. The default view
  saved. A 201-character Kartenzeichen Bezeichnung (form `maxLength`
  removed) showed the length message.
- **Open product points:** I took the proposed values unchanged:
  `MAX_KML_URL_LENGTH` 2,000 and `MIN_AREA_POINTS` 3 / 2. Geoman finishes
  polygons at 3 and lines at 2 vertices, so drawing never sends fewer.
