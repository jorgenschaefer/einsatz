---
criteria:  CRITERIA.md
closes:    AC-6, AC-7, AC-8, AC-9
advances:
after:     02-kml-ohne-backtracking, 03-kml-abruf-absichern, 21-kml-abruf-budget
status:    ready
attempts:  0
---

## Build
When a KML layer is imported (file or URL) or reloaded, the server fetches
every http(s) icon of its `<IconStyle>`s through the checked, pinned fetch
from ticket 03 and the per-import budget from ticket 21, and embeds it as a `data:` URL. The browser stops loading
icons from http(s) addresses altogether: a point whose icon is not embedded
shows the default marker.

## Done when
> **AC-6** Jedes Einbinden einer KML-Ebene – als Datei oder per URL – und jedes „Neu laden" ruft höchstens 20 Adressen ab (URL, NetworkLinks und Icons zusammen), liest zusammen höchstens 20 MB und bricht eine Antwort ab, sobald sie 20 MB übersteigt, auch ohne `Content-Length`. Übersteigt die Datei oder die URL selbst 20 MB, erscheint „Die KML-Datei ist größer als 20 MB."; NetworkLinks und Icons jenseits der Grenzen werden übersprungen wie ein toter Verweis.

> **AC-7** Kein Abruf beim KML-Import – URL, NetworkLink, Icon – erreicht eine Adresse außerhalb des öffentlichen Unicast-Adressraums, auch wenn ein DNS-Name zwischen Prüfung und Abruf auf eine andere Adresse zeigt. Betrifft es die URL selbst, erscheint „Diese Adresse ist nicht erlaubt."; ein NetworkLink oder Icon wird übersprungen wie ein toter Verweis.

> **AC-8** Nach dem Einbinden oder „Neu laden" einer KML-Ebene lädt kein Browser, der sie zeigt, etwas von einem anderen Host als der App selbst und MapTiler. Icons von http(s)-Adressen sind eingebettet; ein Icon, das sich nicht laden lässt, kein Bild ist oder größer als 256 KB ist, erscheint als Standard-Marker.

> **AC-9** KML- und KMZ-Dateien und -URLs, die heute funktionieren, funktionieren weiter, auch Google „Meine Karten" mit NetworkLink und eigenen Icons. Ausnahme: KML-Ebenen, die vor dieser Änderung eingebunden wurden, zeigen Icons von anderen Hosts als Standard-Marker, bis sie neu geladen (URL) oder neu eingebunden (Datei) werden.

## Nudges
> KML-Icons über denselben SSRF-geprüften Abruf in `src/server/kml/kml-fetch.ts` laden und wie in `inlineKmzAssets` als `data:`-URL einbetten. Die geprüfte IP auch für die Verbindung verwenden (undici-`Agent` mit eigenem `connect.lookup`).

> Keine neuen Abhängigkeiten. Eingabeprüfung in `src/server/validation.ts` erweitern, ohne zod.

## Context
**After 02, 03 and 21.** Read their `## Left standing` first; names below
are the ones their plans chose and may have shifted.

- **From 02:** `src/kml/kmz.ts` scans KML with linear `indexOf` helpers
  (element bodies by tag name, case-insensitive) instead of regexes;
  `inlineKmzAssets` replaces relative `<href>`s with `data:` URLs via
  `bytesToDataUri(bytes, mime)`; `IMAGE_MIME` maps extensions to image types.
- **From 03:** all server-side KML HTTP goes through `pinnedFetch`
  (`src/server/kml/pinned-fetch.ts`, public unicast only, connection pinned
  to the checked IP: one DNS resolution per request, and the socket connects
  only to the addresses that resolution returned) behind
  `fetchFollowingRedirects` in `src/server/kml/kml-fetch.ts`. A non-public
  address fails with `ValidationError("Diese Adresse ist nicht erlaubt.")`.
  `src/server/kml/pinned-fetch.test.ts` shows how to test against a local
  HTTP server on 127.0.0.1 with `node:dns` mocked.
- **From 21:** a per-import `FetchBudget` (20 addresses, 20 MB;
  `src/server/kml/fetch-budget.ts`) is created by the two entry points
  `loadKmlFromUrl(url)` (URL import, "Neu laden") and `resolveKmlFile(content)`
  (file import), which the actions in `src/app/operations/[id]/kml-actions.ts`
  call. `takeAddress` takes an address from the budget; `readCapped` reads a
  body up to a cap and the budget's remaining bytes. A redirect hop does not
  count as a further address. Tests mock `@/server/kml/pinned-fetch` with `scriptedFetch`
  (`src/test/scripted-fetch.ts`), which serves real `Response`s with headers.
- **The browser today** (`src/map/kml-layer.ts`): `parseKml` turns KML into a
  Leaflet layer with togeojson; for points, `kmlIconOptions(props)` accepts
  `props.icon` if it starts with `http(s)://` or `data:` and makes an
  `L.icon` with that URL - the browser then loads it from any host. Anything
  else becomes `kmlPointCircle(props)`: the round marker in the
  `<IconStyle><color>` (or Leaflet blue). **That circle is the "Standard-Marker"**
  of AC-8/AC-9 - it is what a KML point without a usable icon shows today.
  Popups use `textContent`, so a description's HTML loads nothing.
- **Where icons sit in KML.** togeojson takes a point's `icon` from
  `<IconStyle><Icon><href>` (inline or via `styleUrl` / `StyleMap`). Other
  `<href>`s (NetworkLink `<Link>`/`<Url>`, GroundOverlay `<Icon>`,
  `<ItemIcon>`) are not drawn by `parseKml` and are not fetched by the
  browser. Google „Meine Karten" KML styles points with
  `<IconStyle><Icon><href>https://www.gstatic.com/mapspro/images/stock/…png</href>`,
  often the same URL in a normal and a highlight style.
- **Href text is XML.** An href with a query string arrives as `&amp;` in the
  KML text; it must be unescaped before it is fetched.
- Ruled out in the criteria: embedding icons of existing layers at first start,
  allowing only already-embedded icons, and a CSP that allows images from any
  `https:` host.

**Decided here** (shown at approval):
- Only `<IconStyle>` icon hrefs are embedded - the only icons a browser draws.
- Each distinct icon URL is fetched once per import and counts as one address;
  every occurrence of it is replaced.
- An icon that fails (refused address, error status, budget used up, not an
  image, over 256 KB) keeps its original href in the stored KML. The browser
  never loads http(s) icons any more, so it shows the circle - the same rule
  that gives pre-existing layers the default marker (AC-9's exception), with
  no second mechanism.
- "Ist ein Bild" means the response's `Content-Type` (without parameters) is
  one of the image types in `IMAGE_MIME`; that type goes into the `data:` URL.
  A server that labels HTML as `image/png` is not detected.
- The 20 MB size check of the KML content stays where it is, before embedding;
  embedded icons are bounded by the budget (and 256 KB each), so the stored
  content can grow beyond 20 MB by at most the embedded icons.

## Plan
1. **Red: AC-8 and AC-9 at the actions.** In
   `src/app/operations/[id]/kml-actions.document.test.ts` (or a new
   `kml-actions.icons.test.ts` with the same mocks), with the HTTP mock
   serving `image/png` bytes for icon URLs:
   - `addKmlUrlAction` with KML whose `<Style><IconStyle><Icon><href>` is
     `http://93.184.216.34/pin.png` (also one with `&amp;` in the query) ⇒
     the saved content has `data:image/png;base64,…` in its place and no
     `http` icon href; `parseKml` of the saved content gives a marker whose
     `iconUrl` starts with `data:`.
   - The same through `addKmlFileAction` and `reloadKmlAction`.
   - A „Meine Karten"-like URL: KML with a NetworkLink whose target has two
     styles (normal/highlight) with the same icon URL and a second icon ⇒
     merged content with both icons embedded, each URL fetched once.
   - Icons that fail: 404, `text/html`, a 300 KB `image/png` (read is cut
     off at 256 KB), a non-public literal host (`http://100.64.0.1/x.png`) ⇒
     import succeeds, those hrefs stay, `parseKml` draws circles for them.
   *Proof:* fails today (no embedding).
2. **Red: AC-7 for icons.** In a new
   `src/app/operations/[id]/kml-actions.icon-address.test.ts` (own file,
   because it keeps the real `pinnedFetch` and mocks `node:dns` instead, like
   03's resolved-name tests), with a local HTTP server on 127.0.0.1 that
   serves `image/png` for any path and records requests, and the KML itself
   coming from a file import (so no KML fetch is needed):
   - an `<IconStyle>` icon whose host name the DNS mock resolves to
     `127.0.0.1` (pointing at the local server's port) ⇒ the import succeeds,
     the href stays unembedded, and the local server received no request;
   - rebinding: an icon host the DNS mock answers with `127.0.0.1` on its
     first call and with a public address on every later call ⇒ unembedded,
     no request at the local server, and the mock was called exactly once
     for that host - there is no separate check resolution that a rebinding
     DNS could answer differently from the one the socket connects with.
     (That the socket connects only to that one resolution's addresses is
     proven in 03's `pinned-fetch.test.ts`; this case proves icons go
     through it. No test connects to a real public address.)
   - an icon whose URL is a non-public literal (`http://127.0.0.1:<port>/x.png`,
     `http://100.64.0.1/x.png`) ⇒ unembedded, no request.
   *Proof:* red until step 5 for the success assertions (no embedding yet),
   and the "no request" assertions guard that step 5 fetches only through
   `fetchFollowingRedirects` - an icon fetch that bypassed it (e.g. global
   `fetch`) would reach the local server.
3. **Red: AC-6 with icons.** In the budget tests from ticket 21: a URL with 10
   NetworkLinks whose targets reference 15 distinct icons ⇒ at most 20
   requests in total; the icons beyond the budget stay unembedded and the
   import succeeds. Icons and NetworkLinks share the 20 MB: links that use
   19.9 MB leave no room for a 200 KB icon, which then stays unembedded.
   *Proof:* fails until step 4.
4. **Icon href scanning.** In `src/kml/kmz.ts`, with 02's helpers:
   `iconStyleHrefs(kml): string[]` (distinct, unescaped, `http(s)` only, from
   `<IconStyle>` bodies) and `replaceIconStyleHrefs(kml, replacements:
   Map<string, string>)` that rewrites those hrefs and leaves all others.
   Linear, like the rest of 02.
   *Proof:* `src/kml/kmz.test.ts`: finds hrefs in inline and shared styles,
   ignores NetworkLink, GroundOverlay and `<ItemIcon>` hrefs and non-http
   ones, dedupes, unescapes `&amp;`; replacing touches only the mapped
   hrefs. Add one AC-5-style timing case (`<IconStyle>` with `<href>` and
   20,000 spaces) to 02's timing test, since this is a new scan of the same
   input.
5. **Embedding.** New `src/server/kml/kml-icons.ts`:
   `embedKmlIcons(kml, budget): Promise<string>` - for each href from
   `iconStyleHrefs`, take one address from the budget (nothing left ⇒
   skip), fetch through `fetchFollowingRedirects` (so `assertFetchableKmlUrl`
   and `pinnedFetch` apply) and read with `readCapped(…, 256 KB)`, accept image types per the decision above, encode with
   `bytesToDataUri`, then `replaceIconStyleHrefs`. Any failure skips that
   icon, like a dead NetworkLink. Call it inside `loadKmlFromUrl` and
   `resolveKmlFile` after NetworkLinks are resolved, with the same budget.
   *Proof:* steps 1, 2 and 3 green.
6. **Browser: no http(s) icons.** `kmlIconOptions` in `src/map/kml-layer.ts`
   accepts only `data:` icons; update its doc comment.
   *Proof:* `src/map/kml-layer.test.ts`: a point with
   `https://example.com/pin.png` (an existing fixture, line ~81) now renders
   the circle (`.kml-point-circle`) and no `<img>` with an http(s) `src`;
   flip the existing `kmlIconOptions({ icon: "https://x/pin.png" })`
   expectations to `null`; `data:` icons unchanged. This is AC-9's exception
   for layers imported before this change.
7. **Look at it** with the `run-einsatz` skill: import a real Google „Meine
   Karten" link with custom icons and reload it; open the Lageansicht and a
   Ansichtslink with the browser's network panel open and confirm no request
   leaves for a host other than the app and MapTiler (dev may fall back to
   OSM tiles - ignore those); icons show; a layer imported before this change
   shows circles until reloaded.
   *Proof:* observation under `## Left standing`.
8. `npm run check` green.

## Not here
- The CSP that enforces `img-src 'self' data: …` in the browser: ticket
  `05-sicherheits-header`.
- Naming the server-side fetch of KML addresses and icons in the
  Datenschutzerklärung: ticket `20-datenschutzerklaerung`.
- From *Ruled out*: no one-off run that embeds icons of existing layers at
  first start; re-import or "Neu laden" does it.
- The fetch itself: address check and pinning built in ticket
  `03-kml-abruf-absichern`, budget and streaming in `21-kml-abruf-budget`;
  change them here only if embedding needs a hook they lack.

## Left standing
