---
criteria:  CRITERIA.md
closes:    AC-2, AC-3, AC-4, AC-35
advances:
after:     04-kml-icons-einbetten
status:    done
attempts:  1
---

## Build
Every page is served with a per-request nonce Content-Security-Policy set by a
new `src/proxy.ts`; every response carries the static security headers from
`next.config.ts`, no `X-Powered-By`, and every page is marked `noindex`. In
production the Lagekarte loads tiles only from MapTiler: without
`MAPTILER_API_KEY` the app refuses to start and says why in the log.

## Done when
> **AC-2** Jede Seite wird mit einer Content-Security-Policy ausgeliefert, unter der ein eingeschleustes `<script>` oder Event-Handler-Attribut nicht ausgeführt wird. Darunter funktionieren Lagekarte, KML-Ebenen, Bild-Overlays, Kartensuche, QR-Codes, ETB, Stärke, Nutzerverwaltung und die Geräteansicht mit Standortfreigabe wie heute.

> **AC-3** Keine Seite der App lässt sich in eine fremde Seite einbetten.

> **AC-4** Jede Antwort trägt `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security` mit mindestens einem Jahr und eine `Permissions-Policy`, die Standort nur der App selbst erlaubt; keine trägt `X-Powered-By`; jede Seite ist als `noindex` markiert.

> **AC-35** Ohne `MAPTILER_API_KEY` startet die App in Produktion nicht und sagt im Log, warum; in Produktion lädt kein Browser Kacheln von `tile.openstreetmap.org`. In der Entwicklung bleibt OSM der Ersatz.

## Nudges
> CSP mit Nonce in einer neuen `src/proxy.ts` nach `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`; `style-src` mit `'unsafe-inline'` für Mantine und Leaflet. Die übrigen Header statisch in `next.config.ts`.

> Uploads (KML-Datei, Bild-Overlay hinzufügen und ersetzen) laufen über eigene Route Handler, die den Body als Stream lesen und bei 20 MB abbrechen; `serverActions.bodySizeLimit` geht zurück auf 1 MB. `src/proxy.ts` läuft nicht für Server-Action-Anfragen und Route Handler (Matcher), weil der Proxy jeden Body puffert und bei `proxyClientMaxBodySize` abschneidet.

## Context
- **Next 16.3.6, Proxy.** Middleware is now `proxy.ts` (with `src/`:
  `src/proxy.ts`), exporting `proxy(request)` and `config.matcher`. Read
  `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`
  and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
  first. The guide's recipe: a nonce per request, the CSP set on the
  **request** headers (Next reads the nonce from there and puts it on its own
  scripts during SSR) and on the response, `'unsafe-eval'` only in
  development. Nonces need dynamic rendering: a statically rendered page has
  no nonce on its scripts and breaks under the CSP.
- **Why the matcher matters now.** Proxy buffers every request body it runs
  for and truncates it at `proxyClientMaxBodySize` (10 MB default) without an
  error (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md`).
  Until ticket 09, KML files and Bild-Overlays up to 20 MB are uploaded as
  server actions (POSTs to the page path with a `next-action` header, body
  limit 25 MB in `next.config.ts`); a proxy running for them would silently
  cut those uploads. The route handlers stream SSE (`events`) and take
  position reports; they need no CSP. Today's route handlers:
  `src/app/operations/[id]/events`, `src/app/operations/[id]/overlays/[overlayId]`,
  `src/app/device/[token]/{events,geocode,overlays/[overlayId],position}`,
  `src/app/view/[token]/{events,geocode,overlays/[overlayId]}`.
  `next/experimental/testing/server` exports `unstable_doesMiddlewareMatch({
  config, url, headers, cookies, nextConfig })` to unit-test a matcher, and
  `unstable_getResponseFromNextConfig` to test `next.config.ts` `headers()`.
  The proxy docs call the matcher helper `unstable_doesProxyMatch`, but Next
  16.3.6 does not export that name (checked in
  `node_modules/next/dist/experimental/testing/server/middleware-testing-utils.d.ts`);
  use `unstable_doesMiddlewareMatch`.
- **What the browser loads** after ticket 04: scripts and styles from
  the app; Mantine injects `<style>` tags and Leaflet sets `style` attributes
  (hence `style-src 'unsafe-inline'`, and no nonce in `style-src`, since a
  nonce there makes browsers ignore `'unsafe-inline'`); images from the app
  (Bild-Overlays via the overlay routes, `icon.svg`), `data:` (Kartenzeichen
  icons from `renderSymbolDataUrl`, KML icons embedded by ticket 04, Leaflet
  `divIcon` SVGs) and tiles from `https://api.maptiler.com` (or
  `https://tile.openstreetmap.org` without a key, `src/map/tiles.ts`); fetches
  and EventSource only to the app (geocoding goes through the server, Photon
  is contacted server-side). QR codes are inline SVG (`react-qr-code`).
  Ticket 04 makes `src/map/kml-layer.ts` load only `data:` icons, so no
  `https:` image host is needed for KML.
- **The one inline script of our own** is Mantine's `ColorSchemeScript` in
  `src/app/layout.tsx`; it accepts a `nonce` prop (it extends
  `ComponentProps<'script'>`). Reading the nonce there with `headers()`
  (`x-nonce`) also makes every page dynamic, which the nonce needs.
- **Static headers.** `next.config.ts` has no `headers()` and no
  `poweredByHeader` yet. Tests only run under `src/**` (`vitest.config.ts`),
  so a header test sits in `src/` and imports `../next.config`.
- **Tiles.** `mapTileConfig()` in `src/map/tiles.ts` (tested in
  `src/map/tiles.test.ts`) returns MapTiler with a key, else OSM, regardless
  of environment. It is called per request by
  `src/app/operations/[id]/page.tsx` and `src/app/read-only-situation-map.ts`.
  There is no `src/instrumentation.ts` yet; `docker-entrypoint.sh` runs
  migrate and seed, then `exec npm run start`; the `Dockerfile` sets
  `NODE_ENV=production` and builds without `MAPTILER_API_KEY`.
- **Browser check.** `.claude/skills/run-einsatz/SKILL.md` drives the app
  with a Playwright REPL against `BASE_URL` (default the dev server on :3000).
  The CSP differs in development (`'unsafe-eval'`, OSM tiles), so AC-2's check
  runs against a production build.

## Plan
1. **Red: the CSP on a page.** New `src/proxy.test.ts`. `await proxy(new
   NextRequest("http://localhost/operations"))`: the response's
   `Content-Security-Policy` has `script-src 'self' 'nonce-…'
   'strict-dynamic'` with no `'unsafe-inline'` and (with `NODE_ENV`
   production, via `vi.stubEnv`) no `'unsafe-eval'`; `style-src 'self'
   'unsafe-inline'`; `img-src 'self' data: blob: https://api.maptiler.com`;
   `connect-src 'self'`; `frame-ancestors 'none'`; `object-src 'none'`;
   `base-uri 'self'`; `form-action 'self'`; `default-src 'self'`. The same
   CSP and `x-nonce` are forwarded on the request (the
   `x-middleware-request-*` headers of `NextResponse.next`). Two requests get
   different nonces. In development `img-src` also has
   `https://tile.openstreetmap.org` and `script-src` `'unsafe-eval'`; in
   production neither. Proof: fails, `src/proxy.ts` does not exist.
2. **Write `src/proxy.ts`** after the guide: nonce from `crypto.randomUUID()`
   (base64), the directives of step 1, set on request and response. Proof:
   step 1 green.
3. **Red, then green: the matcher.** In `src/proxy.test.ts`, with
   `unstable_doesMiddlewareMatch({ config, url, headers })`: the proxy runs for `/operations`, `/operations/<uuid>`,
   `/login`, `/account`, `/admin/users`, `/datenschutz`, `/device/<token>` and
   `/view/<token>`; it does not run for a request with a `next-action`
   header, for prefetches, for `/_next/static/…`, `/_next/image`, `/icon.svg`,
   `/manifest.webmanifest`, nor for any of the route handlers listed in
   Context (`/operations/<id>/events`, `/operations/<id>/overlays/<id>`,
   `/device/<token>/{events,geocode,position,overlays/<id>}`,
   `/view/<token>/{events,geocode,overlays/<id>}`). Write `config.matcher`
   as a negative-lookahead `source` plus `missing: [{ type: "header", key:
   "next-action" }, …prefetch headers from the guide]`. Proof: the tests fail
   on a matcher that is too wide, then pass.
4. **Nonce on our inline script; every page dynamic.** In
   `src/app/layout.tsx`, make `RootLayout` async, read `(await
   headers()).get("x-nonce")` and pass it to `ColorSchemeScript nonce={…}`.
   Proof: `npm run build` lists every page route as dynamic (ƒ), none as
   static (○); `curl -s` of `/login` on `npm start` shows the same nonce on
   every `<script>` as in the `Content-Security-Policy` header.
5. **Red, then green: the static headers.** New
   `src/security-headers.test.ts` importing `nextConfig` from `../next.config`
   and running `unstable_getResponseFromNextConfig` for a page
   (`/operations`), a route handler (`/device/x/position`) and a static asset
   (`/_next/static/x.js`): each has `X-Content-Type-Options: nosniff`,
   `Referrer-Policy: no-referrer`, `Strict-Transport-Security:
   max-age=31536000` (at least a year), `Permissions-Policy:
   geolocation=(self)` and `X-Frame-Options: DENY` (fallback for AC-3 where
   no CSP is sent); and `nextConfig.poweredByHeader` is `false`. Add an
   `async headers()` with `source: "/:path*"` and `poweredByHeader: false` to
   `next.config.ts`. Proof: fails, then passes.
6. **Red, then green: `noindex`.** In a test of `src/app/layout.tsx`'s
   `metadata` (new `src/app/layout.test.ts`), `metadata.robots` is `{ index:
   false, follow: false }`; set it. Proof: fails, then passes; step 9's curl
   shows `<meta name="robots" content="noindex, nofollow">` on every page.
7. **Red, then green: tiles in production.** In `src/map/tiles.test.ts`
   (`vi.stubEnv`): with `NODE_ENV=production` and no key, `mapTileConfig()`
   throws an error whose message names `MAPTILER_API_KEY` and says production
   needs it; with a key it returns MapTiler; with `NODE_ENV=development` and
   no key it stays OSM. Change `mapTileConfig` accordingly. Proof: the
   production case fails, then passes.
8. **Refuse to start.** New `src/instrumentation.ts` whose `register()`
   (only when `process.env.NEXT_RUNTIME === "nodejs"`) calls
   `mapTileConfig()`, so the same rule decides both; on failure it logs the
   message with `console.error` and exits the process with status 1. Proof:
   a unit test of `register` with the env stubbed and `process.exit` spied
   (the exit is the observable outcome); then by hand after `npm run build`:
   `NODE_ENV=production MAPTILER_API_KEY= npx next start -p 3009` exits
   non-zero and prints the message; with a key it serves `/login`. Also
   confirm `npm run build` itself still succeeds without a key (the Docker
   build has none); if it does not, the check must move out of the build path
   and that is a finding for Left standing.
9. **Check every response by hand.** `npm run build && PORT=3001 npm start`
   (with `MAPTILER_API_KEY` from `.env`, or a dummy value — tiles then fail to
   load, which is not a CSP problem). `curl -sI` for `/login`, `/operations`,
   a `/view/<token>`, a `/device/<token>`, an overlay route, `/_next/static/…`
   and a server-action POST: the static headers everywhere, no
   `X-Powered-By` anywhere, the CSP on the pages only.
10. **AC-2 in a real browser, against the production build** (`run-einsatz`
    driver with `BASE_URL=http://localhost:3001`): with the console open,
    log in and go through Lagekarte (place, move, edit a Kartenzeichen; draw a
    Bereich), add a KML-Ebene by file and by URL, add and move a Bild-Overlay,
    search the map, show a Gerätelink and an Ansichtslink QR code, write and
    correct an ETB entry, record a Stärkemeldung, open the Nutzerverwaltung,
    and open a Gerätelink on a phone context and allow the location. No CSP
    violation may appear in the console. Then, on a page, inject
    `<img src=x onerror="window.__xss=1">` with `insertAdjacentHTML` and a
    `<script>window.__xss=2</script>` via
    `document.createRange().createContextualFragment`: `window.__xss` stays
    undefined and the console reports the CSP violations. Also load a page
    inside an `<iframe>` from another origin (a `data:` or local file page)
    and see it refused (AC-3). Write down in Left standing what was checked
    this way, since no automated test runs a browser against the CSP.
11. **`npm run check`** green.

Decided here: `'unsafe-eval'` only in development, as the Next guide requires
for React's dev tooling; `X-Frame-Options: DENY` statically on every response
next to `frame-ancestors 'none'` in the page CSP; the start-up check lives in
`src/instrumentation.ts` (it covers `npm start` as well as the container)
rather than in `docker-entrypoint.sh`; `noindex` via the root layout's
`metadata.robots` rather than an `X-Robots-Tag` header.

## Not here
- Moving uploads to route handlers and `serverActions.bodySizeLimit` back to
  1 MB: ticket 09. Its new upload route handlers must be added to this
  ticket's matcher exclusions there.
- Making Kartenzeichen and Bereich labels text (AC-1): ticket 01, which is
  independent of this one in either order (the CSP blocks an injected script
  whether or not the labels are still HTML). Embedding
  KML icons so no foreign image host is needed (AC-8): ticket 04.
- The Datenschutzerklärung's list of contacted services: ticket 20.
- Body-size limits for anonymous requests (AC-14): ticket 09.
- Alles in `../drk-barmbek`: Header und Body-Grenzen im Caddy, Backup des `uploads`-Volumes, Backup auf einen anderen Rechner, das committete `database/.env`. Das wird eine eigene Änderung dort.

## Left standing
- **AC-4 gap: Next's own trailing-slash redirect carries none of the static
  headers.** `/login/` gets a `308 → /login` from Next before `headers()` in
  `next.config.ts` runs, so that one response has no `nosniff`,
  `Referrer-Policy`, HSTS, `Permissions-Policy` or `X-Frame-Options`. All other
  responses checked with curl on `npm start` carry them. These were pages,
  404s, route handlers, a server-action POST, `/_next/static`, `icon.svg` and
  the manifest. The 308 has no body and points to the same origin. Not fixed:
  the only lever in the app is `skipTrailingSlashRedirect`, which changes
  routing for every URL. Adding the headers in Caddy (`../drk-barmbek`, out of
  scope here) would cover it. To decide at acceptance.
- **`npm run check` is red in the working tree, but not because of this
  commit.** The first reviewer left two untracked scratch scripts,
  `.claude/skills/run-einsatz/crit-ref.mjs` and `crit-review.mjs`, and Biome
  fails on them. Deleting them needed an approval that this unattended run
  could not get. Delete them by hand. Excluding them, `tsc`, `biome check` and
  vitest (199 files, 2132 tests) are green.
- **Review nit not fixed: the `run-einsatz` driver's `wait-fn` and
  `wait-tiles` do not work against a production build.** Playwright's string
  `waitForFunction` compiles inside the page, and the production CSP (no
  `'unsafe-eval'`) blocks that. `eval` and `click` still work. Fix: make
  `wait-fn` poll `page.evaluate(js)` in a loop. Do not use `bypassCSP`, which
  would hide CSP violations. Not done because this run had no write
  permission under `.claude/`.
- **Review nit not fixed: the new comments in `leaflet-adapter.ts`,
  `tiles.ts` and `next.config.ts` are German.** They match the comments
  already in those files. The new files (`proxy.ts`, `startup-checks.ts`,
  `instrumentation.ts`) are English.
- **Proxy skipped for `Purpose: prefetch`.** A page request with that header
  gets no CSP; the reviewer confirmed it with curl. This is the exclusion the
  Next guide recommends. A cross-site attacker cannot make a victim's
  navigation send that header, so it is left as is.
- **AC-2 and AC-3 have no automated browser test.** Two fresh reviewers
  checked them against `npm start` (production CSP) in Chromium, at
  1280/1920 desktop and 320×568 to 430×932 phone sizes. No CSP violation and
  no console error appeared in any of these:
  - Lagekarte: tiles load, Kartenzeichen placed.
  - KML/KMZ by file, with icons as `data:`.
  - A 15.6 MB Bild-Overlay uploaded and moved. This also shows that server
    actions bypass the proxy and its 10 MB cut.
  - Kartensuche.
  - Ansichtslink and Gerätelink QR codes.
  - ETB entry, Stärke (a new Stelle), Nutzerverwaltung (create and delete a
    user).
  - Geräteansicht on a phone context with location allowed: the position was
    stored and moved live on the operator map.

  An injected inline `<script>`, `<img onerror>`, `<svg onload>`,
  `<div onclick>` and `javascript:` link did not run, and the violations were
  reported. Framing `/login`, a Gerätelink and an Ansichtslink from another
  origin was refused. **Not checked in a browser:** drawing a Bereich
  (geoman), KML by URL, and browsers other than Chromium. The dev CSP was
  checked once by a reviewer: OSM tiles load without a key and there were no
  violations.
- **AC-35 start-up was checked by hand as well as by the unit test.**
  `MAPTILER_API_KEY= next start` exits with 1 and logs the German reason. With
  the key it serves `/login`. `npm run build` succeeds without a key, as in
  the Docker build. Every page route is `ƒ` (dynamic), and each of the 14
  scripts on `/login` carries the header's nonce.
- **Departed from the plan:**
  - **Tile requests now send the app's origin
    (`referrerPolicy: "strict-origin"` on the Leaflet tile layer,
    `src/map/leaflet-adapter.ts`).** Review found that the new
    `Referrer-Policy: no-referrer` makes MapTiler refuse every tile (403
    "Invalid key"), because the key is restricted to allowed origins. The
    response header stays `no-referrer`, as AC-4 requires. Tiles send only
    the origin, never the path, which can contain a Gerätelink or
    Ansichtslink token. Pinned by `leaflet-adapter.tiles.test.ts`.
  - **The start-up check sits in `src/startup-checks.ts`.**
    `src/instrumentation.ts` imports it dynamically under
    `NEXT_RUNTIME === "nodejs"`. Next also compiles instrumentation for the
    Edge runtime. With `process.exit` in `instrumentation.ts` itself, the
    build warned that `process.exit` is not supported there. This is the
    pattern from Next's instrumentation guide.
  - **The matcher tests derive their page and route-handler cases from
    `src/app/**/page.tsx` and `route.ts`** instead of a hand-written list (a
    review should-fix). A handler that ticket 09 adds without excluding it
    from the matcher fails `proxy.test.ts`. I checked this by dropping
    `geocode` from the matcher: two cases failed.
  - **Step 1's red was an assertion against a stub `proxy.ts`**, not a
    missing module.
  - **No `upgrade-insecure-requests` in the CSP** (the guide has it, the plan
    does not). HSTS covers HTTPS, and the directive would break the local
    `npm start` checks over http.
  - **README and `.env.example` updated:** `MAPTILER_API_KEY` is now required
    in production.
