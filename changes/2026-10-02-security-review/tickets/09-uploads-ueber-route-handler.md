---
criteria:  CRITERIA.md
closes:    AC-14
advances:  AC-22
after:     04-kml-icons-einbetten, 05-sicherheits-header, 08-bild-overlay-dateien-absichern, 22-standortmeldung-begrenzen
status:    ready
attempts:  0
---

## Build
The three uploads - add a KML file, add an image overlay, replace an image overlay's file - move from server actions to route handlers that check the session before reading anything and read the body as a stream, stopping at 20 MB. With the big uploads gone, server actions go back to Next's 1 MB limit and the proxy buffers at most 1 MB. The name of a KML-Ebene - which the file upload now sends to a route handler instead of a server action - is checked for type and length where every KML-Ebene is created.

## Done when
> **AC-14** Ohne gültige Sitzung nimmt die App keinen Request-Body über 1 MB an, eine Standortmeldung keinen über 1 KB – auch wenn der Body ohne `Content-Length` gesendet wird. Angemeldet lassen sich KML-Dateien und Bild-Overlays bis 20 MB weiter einbinden, hochladen und ersetzen.

From the ACs under *Toward*:

- AC-22, for the name of a KML-Ebene: a name that is not text or is longer
  than 200 characters (after trimming) is rejected with a message, from the
  KML file upload and from `addKmlUrlAction`, and nothing is stored; an
  empty name still falls back as today („KML-Datei" for a file, the URL for a
  URL import).

## Toward
> **AC-22** Jede Server Action lehnt falsche Typen, IDs, die keine UUID sind, unbekannte Bereichsformen (alles außer Polygon, Linie, Kreis) und Strings über ihrer Höchstlänge mit einer Meldung ab statt mit einem Serverfehler, und speichert dann nichts. Höchstlängen: Namen, Bezeichnungen, Beschriftungen, Von/An und Weg 200 Zeichen; KML-URL 2.000; Einsatzbeschreibung und Notizen 2.000; ETB-Text 10.000; Bereichsfarbe genau `#` und sechs Hex-Ziffern. Ein Polygon hat mindestens 3 Punkte, eine Linie mindestens 2.

## Nudges
> Uploads (KML-Datei, Bild-Overlay hinzufügen und ersetzen) laufen über eigene Route Handler, die den Body als Stream lesen und bei 20 MB abbrechen; `serverActions.bodySizeLimit` geht zurück auf 1 MB. `src/proxy.ts` läuft nicht für Server-Action-Anfragen und Route Handler (Matcher), weil der Proxy jeden Body puffert und bei `proxyClientMaxBodySize` abschneidet.

> Keine neuen Abhängigkeiten. Eingabeprüfung in `src/server/validation.ts` erweitern, ohne zod.

## Context
**Today.** `next.config.ts` raises `experimental.serverActions.bodySizeLimit` to `"25mb"` so the uploads fit. Next reads a server action's body before the action runs, so any anonymous POST with a `Next-Action` header gets up to 25 MB read before `requireUser` is reached. Next's action handler counts streamed bytes against the limit (`node_modules/next/dist/server/app-render/action-handler.js`, `sizeLimitTransform`), so with the limit back at the 1 MB default a body without `Content-Length` is also cut off at 1 MB and answered with 413.

The three upload actions:
- `addKmlFileAction(operationId, name, content)` in `src/app/operations/[id]/kml-actions.ts`. The client (`src/map/KmlPanel.tsx`, `readKml`) unpacks KMZ in the browser with `extractKml` and sends the KML text. The action runs `enforceKmlSizeLimit`, `assertKmlDocument`, `resolveKmlNetworkLinks` and `createKmlOverlay`. Tickets 03, 21 and 04 change this path (address check, import budget, icons embedded; the action calls `resolveKmlFile` from 21 instead of `resolveKmlNetworkLinks`); take it as it is after them.
- `addImageOverlayAction(operationId, file, view)` and `replaceImageOverlayFileAction(operationId, id, file)` in `src/app/operations/[id]/image-overlay-actions.ts`, using `prepareUpload` (`enforceUploadSize`, `classifyUpload`, `prepareOverlayImage`), `storeOverlayImage`, `createImageOverlay` / `replaceImageOverlayFile`, and cleaning up files on failure. Ticket 08 has changed replace to take the Einsatz from the overlay's row and `storeOverlayImage` to reject a non-UUID; keep that.
- All three go through `operationAction` (`src/app/operations/[id]/operation-action.ts`): `requireUser`, run, `ValidationError` → `{ error }`, other errors logged and returned as the fallback message, then `revalidateOperation` (revalidate + `publishOperationChanged`).

`src/app/operations/[id]/page.tsx` binds the actions (`addKmlFileAction.bind(null, operation.id)` etc.) and passes them to `SituationWorkspace` (`src/map/SituationWorkspace.tsx`) as `onAddKmlFile`, `onAddImage`, `onReplaceImage`; these are part of `SituationMapViewProps` and flow to `KmlPanel`, `LayersPanel`, `useImageOverlayEditing`. A server component can only pass server actions, so callbacks that call `fetch` have to be built on the client.

The Standortmeldung route `src/app/device/[token]/position/route.ts` already reads at most 1 KB (ticket 22) through `readRequestBody(request, maxBytes)` in `src/server/http/request-body.ts`, which rejects an announced oversize at once, reads a body chunk by chunk, cancels the reader and throws `RequestBodyTooLargeError` past `maxBytes`. The upload routes use the same function.

**KML name today.** `createKmlOverlay(db, { operationId, sourceType, sourceUrl, name, content })` in `src/server/kml/kml-overlays.ts` stores `name` unchecked; `addKmlFileAction` passes `name.trim() || "KML-Datei"`, `addKmlUrlAction` passes `name.trim() || source`. A non-string `name` throws a `TypeError` on `.trim()`; any length is stored. In a multipart form the `name` field arrives as `string | File | null`. Ticket 23 adds general helpers (`assertText` …) to `src/server/validation.ts`, but this ticket does not wait for it; whichever of the two is built second may switch this check onto `assertText`, keeping the messages.

Other anonymous request paths: the token routes under `/view/…` and `/device/…` (events, geocode, overlays) are GET and read no body; login is a server action. Page requests go through `src/proxy.ts` (ticket 05), which buffers every body up to `experimental.proxyClientMaxBodySize`, 10 MB by default (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md`). Ticket 05's matcher leaves out server-action requests and the existing route handlers. The new upload routes must be left out too, or the proxy would cut every upload at its limit.

Test harness: `src/app/auth-enforcement.test.ts` lists every guarded action and route. `src/app/operations/[id]/image-overlay-actions.test.ts` and `kml-actions*.test.ts` test the actions with a real `freshDb()`, mocked `next/headers` cookies and `@/server/db/pg`. `src/test/scripted-fetch.ts` scripts `fetch` for client tests.

**Decided in this ticket** (expensive to reverse, shown at approval):
- Routes: `POST /operations/[id]/kml` (new `src/app/operations/[id]/kml/route.ts`), `POST /operations/[id]/overlays` (new `src/app/operations/[id]/overlays/route.ts`), and `PUT` on the existing `src/app/operations/[id]/overlays/[overlayId]/route.ts` for replacing the file.
- All three take `multipart/form-data`: KML has `name` and `content` (the extracted KML text as a Blob); add image has `file` and `view` (the `ViewExtent` as JSON); replace has `file`.
- Responses: `200 {}` on success, `400 { error }` for a `ValidationError`, `413 { error }` when the body exceeds the cap, `500 { error: <fallback> }` for anything unexpected (logged), and `401` without a valid session, before any byte of the body is read. On 401 the client goes to `/login`, the same as a server action's redirect today. A route never calls `redirect()`, because `fetch` follows a 307 by re-sending the body to `/login`.
- The stream cap is 20 MB plus 1 MB of multipart overhead. The domain's own checks (`enforceUploadSize`, `enforceKmlSizeLimit`) still decide exactly at 20 MB with their messages. When the cap itself trips, the route answers 413 with "Die KML-Datei ist größer als 20 MB." (KML) or "Die Datei ist größer als 20 MB." (image).
- After a successful upload, the client helper calls `router.refresh()`, because a route handler's `revalidatePath` does not refresh the caller's router the way a server action's does. Without it, the uploader would see the result only through the live connection.
- `experimental.proxyClientMaxBodySize: "1mb"`. The proxy only runs for page requests, which carry no legitimate body.
- *KML name check in `createKmlOverlay`.* `createKmlOverlay` takes the name as the user gave it (`name: unknown`), rejects a non-string with "Der Name muss Text sein." and a trimmed name over 200 characters with "Der Name darf höchstens 200 Zeichen lang sein." (counting `.length`, like `assertComposition`), and applies the fallback itself: `trimmed || (sourceUrl ?? "KML-Datei")`. Both entry points then share one check and one fallback. The URL fallback is not subject to the 200 limit (it is the URL, whose own maximum length is ticket 23's question); for a URL import the check runs after the fetch, which stores nothing either way.

**Merge note.** Ticket `16-token-ansichten` also creates `src/app/operations/[id]/overlays/[overlayId]/route.test.ts` (a test that the operations route still serves a hidden overlay), and neither ticket comes after the other. This ticket adds the `PUT` tests there. Whichever is built second extends the file the first created instead of creating it again, and keeps both sets of tests and their mocks working together.

## Plan
1. **AC-14 as tests, red.** New `src/app/operations/[id]/uploads.test.ts`, the same harness as `image-overlay-actions.test.ts`:
   - Without a session, `POST /operations/[id]/kml`, `POST /operations/[id]/overlays` and `PUT /operations/[id]/overlays/[overlayId]` answer 401. The request body is a `ReadableStream` without `Content-Length` that counts its pulls, and the count is 0.
   - Signed in, a KML file of just under 20 MB is added, and an image overlay is added and replaced (small PNG). This shows the 20 MB path end to end without a 20 MB image fixture.
   - Signed in, a body of 22 MB sent as a stream without `Content-Length` answers 413 with the message. The stream stops being pulled shortly after 21 MB, nothing is stored and no file is written.

   The Standortmeldung part of AC-14 is already pinned by ticket 22's tests in `src/app/device/[token]/position/route.test.ts`; they stay green.

   In `src/app/auth-enforcement.test.ts`: the three upload actions are replaced by the three routes in a "401 without a session" group.

   *Proof:* red. The routes do not exist yet, so the import fails. Commit the test with the step that adds the routes, and confirm red on an assertion first: create empty `POST`/`PUT` exports that return 200.
2. **KML name, red then green.** Tests first in `src/server/kml/kml-overlays.test.ts`: `createKmlOverlay` with a name of 201 characters (also 201 after trimming surrounding spaces) → `ValidationError` "Der Name darf höchstens 200 Zeichen lang sein." and no row; 200 characters (also `"ä".repeat(200)`) stored; a number or object as name → "Der Name muss Text sein." and no row; `""` and `"  "` → „KML-Datei" for a file, the `sourceUrl` for a URL (also a URL longer than 200). In `kml-actions.test.ts`: `addKmlUrlAction` with a 201-character name returns `{ error: "Der Name darf höchstens 200 Zeichen lang sein." }` and stores nothing, and with a non-string name returns `{ error: "Der Name muss Text sein." }` instead of a server error. Then build it as decided above in `src/server/kml/kml-overlays.ts`; `addKmlUrlAction` (and `addKmlFileAction` until step 4 removes it) pass the raw `name`.
   *Proof:* the new tests red, then green; the route-level case is in step 4.
3. **One flow for actions and upload routes.** Split `operationAction` so that its middle part (run, map `ValidationError`, log and fall back, revalidate) can be called by a route that has already checked the session with `getCurrentUser()`. A route turns the `ActionResult` into the status codes above. Keep it in `src/app/operations/[id]/operation-action.ts`.
   *Proof:* `src/app/operations/[id]/operation-action.test.ts` stays green unchanged.
4. **KML route.** Move the body of `addKmlFileAction` (as it is after tickets 03, 21 and 04) into a domain function, e.g. `addKmlFile(db, { operationId, name, content })` next to `createKmlOverlay` in `src/server/kml/`. Add `src/app/operations/[id]/kml/route.ts` (`POST`): session check → `readRequestBody` with the cap → parse the bytes as `FormData` (`new Response(bytes, { headers: { "content-type": … } }).formData()`) → `addKmlFile` → revalidate. Delete `addKmlFileAction`. Move its tests from `kml-actions.test.ts` / `kml-actions.document.test.ts` ("a file that is not KML", "adds a file whose content is KML", the NetworkLink case) to the route. The route reads `name` from the form and passes it to `createKmlOverlay` as it is (a `File` in the `name` field is not text and is rejected there; a missing field becomes `""`).
   *Proof:* the KML cases from step 1 go green; the moved tests pass against the route; a route test with a 201-character `name` answers 400 with "Der Name darf höchstens 200 Zeichen lang sein." and stores nothing.
5. **Image overlay routes.** `POST` in new `src/app/operations/[id]/overlays/route.ts` and `PUT` in `src/app/operations/[id]/overlays/[overlayId]/route.ts`, same shape as step 4. `addImageOverlayAction` and `replaceImageOverlayFileAction` become domain functions in `src/server/image-overlays/` (e.g. `addImageOverlay`, `replaceImageOverlayImage`) and keep file cleanup, `assertViewExtent` and ticket 08's rules. The actions are deleted, and their tests in `image-overlay-actions.test.ts` move to the routes.
   *Proof:* the image cases from step 1 go green; the moved tests (cleanup on DB failure, "asks for a file", the view extent cases, ticket 08's cases) pass against the routes. `src/app/overlay-routes.not-a-uuid.test.ts` stays green.
6. **Client helper.** New `src/map/uploads.ts`: `uploadKmlFile(operationId, name, content)`, `uploadImageOverlay(operationId, file, view)`, `replaceImageOverlayImage(operationId, id, file)`. Each builds the `FormData`, calls `fetch`, and returns an `ActionResult` from the JSON `{ error }`. On 401 it goes to `/login`. On any other non-JSON answer it returns the fallback message the action had ("KML konnte nicht geladen werden." / "Das Bild konnte nicht eingebunden werden.").
   *Proof:* `src/map/uploads.test.ts` with `src/test/scripted-fetch.ts`: the right URL, method and form fields; `{}` on 200; the error on 400/413; the fallback on a 500 HTML page; navigation on 401.
7. **Wire the client.** `SituationWorkspace` builds `onAddKmlFile`, `onAddImage` and `onReplaceImage` from `operationId` with the helper, and calls `router.refresh()` after a success. `SituationWorkspaceProps` no longer takes these three from the page. `page.tsx` stops importing and binding the three actions. Adjust `SituationWorkspace.fixtures.tsx` and `SituationWorkspace.image-upload.test.tsx` / `.image-placement.test.tsx` / `.layers.test.tsx`: stub `fetch` and assert the request sent, instead of handing in `vi.fn` props.
   *Proof:* those workspace tests green; `src/app/operations/[id]/page.test.tsx` green.
8. **Limits back down.** `next.config.ts`: remove `serverActions.bodySizeLimit` together with its comment, and set `experimental.proxyClientMaxBodySize: "1mb"`. In `src/proxy.ts`, make sure the matcher leaves out `/operations/[id]/kml` and `/operations/[id]/overlays…` (POST and PUT). If ticket 05's pattern already covers them, change nothing.
   *Proof:* `src/proxy.test.ts` (from ticket 05, or new) with `unstable_doesMiddlewareMatch` from `next/experimental/testing/server`: false for the three upload URLs (with `POST`/`PUT`) and for `/device/x/position`. The docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`) call it `unstable_doesProxyMatch`, but the installed Next exports only `unstable_doesMiddlewareMatch` (`node_modules/next/dist/experimental/testing/server/middleware-testing-utils.d.ts`); use that.
9. **Check on a real server.** `npm run build && npm start`, no session cookie, using `curl` with `Transfer-Encoding: chunked` and no `Content-Length`:
    - 5 MB to `/login` with a `Next-Action` header → 413 from Next.
    - 5 MB to `/` and `/login` without that header → the request is answered without the server holding more than 1 MB (proxy limit warning in the log).
    - 5 MB to each upload route → 401.
    - 2 KB to `/device/<token>/position` → 413.

    Signed in, through the UI (skill `run-einsatz`): add a KMZ and a PDF/PNG of about 19 MB, and replace an image overlay's file with one of that size.
    *Proof:* the observed status codes and log lines under `## Left standing`.
10. `npm run check` green.

## Not here
- The CSP, the static headers and the proxy itself: ticket `05-sicherheits-header`. This ticket only adds the upload paths to its matcher if they are missing, and sets `proxyClientMaxBodySize`.
- Which Einsatz a replaced file lands in and the image size limits (AC-20, AC-21): ticket `08-bild-overlay-dateien-absichern`. Carry its behaviour over unchanged.
- The KML import budget, SSRF check and icon embedding: tickets 03 and 04. The KML route calls the same domain code.
- The KML name check is here (file upload and `addKmlUrlAction`, in `createKmlOverlay`), not in ticket `23-kartenobjekte-eingaben`; 23 keeps the KML URL's own checks and may move this check onto its `assertText` helper.
- Type and UUID checks on the uploads' other fields (operation id, overlay id, view): tickets `23-kartenobjekte-eingaben` and `17-kartenobjekte-pruefen`; the completeness test over every server action: `18-eingaben-pruefen`.
- Reading at most 1 KB of a Standortmeldung's body: ticket `22-standortmeldung-begrenzen`.
- Not storing or publishing a Standortmeldung less than 5 s after the last one: ticket `10-aenderungen-buendeln`.
- From *Out of scope*: header and body limits in Caddy (`../drk-barmbek`). The app sets its limits itself and does not count on the reverse proxy.

## Left standing
