---
criteria:  CRITERIA.md
closes:    AC-13, AC-19
advances:
after:
status:    ready
attempts:  0
---

## Build
Ansichts- and Geräteansicht get no hidden KML-Ebenen or Bild-Overlays,
neither in their data nor through the image route, and address searches
through Ansichts- and Gerätelinks share their own, slower limit in front of
the app's Photon limit; queries over 200 characters never reach Photon.

## Done when
> **AC-13** Eine ausgeblendete KML-Ebene oder ein ausgeblendetes Bild-Overlay ist in Ansichts- und Geräteansicht nicht zu sehen und in den Daten, die der Browser dort bekommt, nicht enthalten; ihre Bildadresse unter `/view/…` bzw. `/device/…` liefert 404. Eingeblendet erscheint sie dort ohne Neuladen.

> **AC-19** Die App fragt Photon höchstens einmal pro Sekunde. Suchen über Ansichts- und Gerätelinks zusammen höchstens einmal in 3 Sekunden, sodass den angemeldeten Nutzern mindestens zwei Drittel bleiben. Eine Suchanfrage über 200 Zeichen ergibt keine Treffer, ohne Photon zu fragen.

## Nudges
> Geocoding: das gemeinsame `RateGate` (1 s) in `src/server/geocoder/geocode-service.ts` bleibt; die Token-Routen gehen zusätzlich durch ein eigenes `RateGate` (3 s).

## Context
- **Token view data:** `src/app/view/[token]/page.tsx` and
  `src/app/device/[token]/page.tsx` resolve access, call
  `loadReadOnlySituationMap(db, operationId, basePath, token)`
  (`src/app/read-only-situation-map.ts`) and pass the result as props to
  `ViewLinkView` / `DeviceView` - those props are what the browser gets.
  The loader maps *all* KML-Ebenen (`listKmlOverlays`, with `content` and
  `visible`) and Bild-Overlays (`listImageOverlays`, with `imageUrl` and
  `visible`); the client only hides the invisible ones. `visible` is part of
  the shared `RenderedKmlOverlay`/`RenderedImageOverlay` types in
  `src/map/SituationMap.tsx`; after filtering it is always `true` in token
  views - keep the field rather than splitting the types.
- **Image routes:** `src/app/view/[token]/overlays/[overlayId]/route.ts` and
  `src/app/device/[token]/overlays/[overlayId]/route.ts` check the token,
  then `overlayImageResponse(db, overlayId, operationId)`
  (`src/server/image-overlays/overlay-response.ts`), which 404s only for a
  foreign Einsatz. The logged-in route
  `src/app/operations/[id]/overlays/[overlayId]/route.ts` uses the same
  function and must keep serving hidden overlays (the Lageansicht shows
  them in the panel and when shown again). `getImageOverlay` returns
  `visible`.
- **"Ohne Neuladen":** `setKmlVisibilityAction` and
  `setImageOverlayVisibilityAction` run through `operationAction`, whose
  `revalidateOperation` publishes on the Einsatz bus; the token views are
  subscribed via their SSE route and `router.refresh()`, which re-runs the
  page and the loader. So showing again needs no new code - pin it in a test.
- **Geocoding today:** `geocodeQuery(query, geocoder = photonGeocoder)` in
  `src/server/geocoder/geocode-service.ts`: trims, `shouldGeocode` (minimum
  length), the shared `geocodeGate = RateGate(1000)` pinned on
  `globalThis`, errors → `[]`. Callers: `geocodeAddressAction`
  (`src/app/operations/[id]/geocode-actions.ts`, logged in) and the token
  routes `src/app/view/[token]/geocode/route.ts`,
  `src/app/device/[token]/geocode/route.ts`. `RateGate.tryAcquire` takes
  the slot when it answers `true`; there is no peek.
- **Order of the two gates (decided here):** a token search tries the
  token gate (3 s) first and the shared gate (1 s) second. The other order
  would let token searches use up shared slots they then don't get to use,
  taking them from logged-in users; this order at worst wastes a token slot
  when the shared gate is busy. The 200-character check comes before both
  gates, so an over-long query uses up no slot.
- **Ruled out in CRITERIA.md:** "Ausgeblendete Ebenen als reine Anzeige
  dokumentieren" and "Getrennte Photon-Grenzen von je einer Anfrage pro
  Sekunde".

## Plan
1. **AC-13 tests first, red.** New `src/app/token-views.hidden-layers.test.ts`
   (real `freshDb()`, `getDb` mocked; `pdf-to-png-converter` mocked as in
   `src/app/read-only-situation-map.test.ts`): an Einsatz with one visible
   and one hidden KML-Ebene and Bild-Overlay, an Ansichtslink and a
   Kartenzeichen with Gerätelink.
   - `await ViewPage({ params })` and `await DevicePage({ params })` return
     an element whose `props.kmlOverlays` / `props.imageOverlays` contain
     only the visible ones (ids), and no hidden KML `content` anywhere in
     the props (`JSON.stringify`).
   - GET of the view and the device overlay route for the hidden overlay →
     404; for the visible one → 200 (file mocked or written into a temp
     upload dir, as the existing overlay route tests do).
   - After `setKmlVisibilityAction(op, id, true)` (mock `next/cache`,
     cookie of a logged-in user): a subscriber via `subscribeOperation`
     was notified, and the next `ViewPage` render contains the KML-Ebene.
   Proof: `npx vitest run src/app/token-views.hidden-layers.test.ts` red on
   the hidden ids / the 200.
2. **Filter the data.** `src/app/read-only-situation-map.ts`: keep only
   `visible` KML-Ebenen and Bild-Overlays. Proof: step 1 data cases green;
   `read-only-situation-map.test.ts` green (add a hidden overlay case there
   too if the loader test is the more natural home).
3. **404 for hidden images.** `overlayImageResponse` gets a way to require
   visibility (e.g. `{ visibleOnly: true }` from the two token routes); the
   operations route stays as is. Proof: step 1 route cases green; existing
   `route.test.ts` of view/device overlays green (their mocked overlay
   needs `visible: true`); the operations overlay route still serves a
   hidden overlay (new case; the route has no test file of its own yet -
   add `route.test.ts` next to it, modelled on the device one). Ticket 09
   also creates `src/app/operations/[id]/overlays/[overlayId]/route.test.ts`
   (for its `PUT`); the two are not ordered, so whichever is built second
   extends the existing file.
4. **AC-19 tests, red.** New `src/app/token-geocode-limits.test.ts`: mock
   `@/server/geocoder/photon` (count calls), `resolveViewAccess` /
   `resolveDeviceAccess` granting access, `requireUser` passing; time via
   `vi.useFakeTimers({ toFake: ["Date"] })`, gates reset in `beforeEach`.
   - view search at t=0 hits Photon; device search at t=1.5 s → `[]`, no
     Photon call; at t=3 s → Photon.
   - with token searches arriving every 0.5 s for 6 s and
     `geocodeAddressAction` every 1 s, Photon is called at most once per
     second overall, at most once per 3 s from token routes, and the
     logged-in calls succeed in at least 4 of 6 seconds.
   - a 201-character query (view route, device route, and the action) →
     `[]` with no Photon call and does not use up a slot: a normal query
     right after it hits Photon.
   - a 200-character query still reaches Photon.
   Proof: red on the device search at 1.5 s and on the 201-character query.
5. **Build it.** `src/server/geocoder/geocode-service.ts`:
   `MAX_GEOCODE_QUERY_LENGTH = 200`, checked in `geocodeQuery` before the
   gate; a second gate `tokenLinkGeocodeGate = new RateGate(3000)` pinned
   on `globalThis` like the first; `geocodeQueryForTokenLink(query,
   geocoder?)` checks length and minimum, then the token gate, then calls
   `geocodeQuery`. The two token routes call it. Update
   `src/app/view/[token]/geocode/route.test.ts` (it mocks `geocodeQuery`).
   Proof: step 4 green; `geocode-service.test.ts` gains the unit cases
   (length bound, gate order, slot not used by an over-long query).
6. `npm run check` green.

## Not here
- Type/UUID/length validation of the geocode *action's* input in general:
  `25-einsatz-und-konten-eingaben` (AC-22 is closed by `18-eingaben-pruefen`).
- Ending Live-Verbindungen of token views and connection limits:
  `15-live-verbindungen-begrenzen`.
- Embedding KML icons: `04-kml-icons-einbetten`.
- Out of scope: "Ablaufdatum für Links und eine Anzeige, wann ein Link
  zuletzt benutzt wurde." and "Gehashte Gerätelink- und
  Ansichtslink-Tokens."

## Left standing
